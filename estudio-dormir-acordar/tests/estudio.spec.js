// Testes de ponta a ponta do Estúdio Dormir & Acordar.
// Rodar: npm test   (a primeira vez: npm install && npx playwright install chromium)
import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const MODELO = ["modelo.jpg", "modelo.png"].map(f => FIX + f).find(existsSync);

test.beforeEach(async ({ page }) => {
  const erros = [];
  page.on("pageerror", e => erros.push(String(e)));
  page.__erros = erros;
  await page.goto("/");
  await page.waitForTimeout(800);
});
test.afterEach(async ({ page }) => {
  expect(page.__erros, "erros de JavaScript na página").toEqual([]);
});

test("abre com o exemplo e os 6 formatos de foto", async ({ page }) => {
  await expect(page.locator("#grid .card")).toHaveCount(6);
  await expect(page.locator("#itemHint")).toContainText("exemplo");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test("todas as medidas exportadas batem com as plataformas", async ({ page }) => {
  const medidas = await page.evaluate(async () => {
    const it = S.items[0], out = {};
    for (const f of FORMATS.filter(f => f.media.includes("photo"))) {
      const blob = await renderFull(it, f);
      const bmp = await createImageBitmap(blob);
      out[f.id] = [bmp.width, bmp.height];
    }
    return out;
  });
  expect(medidas).toEqual({ feed: [1080, 1350], vertical: [1080, 1920], "tts-main": [1080, 1080], "tts-extra": [1080, 1080], pin: [1000, 1500], mkt: [1500, 1500] });
});

test("todos os cenários e marcas desenham sem erro", async ({ page }) => {
  for (const id of ["original", "studio", "window", "linen", "paris", "night", "sage", "rose"]) {
    await page.click(`.scene[data-id="${id}"]`);
  }
  for (const m of ["logo", "mono", "word", "wm", "wmword", "none"]) {
    await page.click(`#markSeg button[data-v="${m}"]`);
    expect(await page.evaluate(() => S.mark)).toBe(m);
  }
  for (const l of ["editorial", "etiqueta", "none"]) await page.click(`#layoutSeg button[data-v="${l}"]`);
});

test("preço formatado em reais", async ({ page }) => {
  expect(await page.evaluate(() => [money("189"), money("1.299,9"), money("")])).toEqual(["R$ 189,00", "R$ 1.299,90", ""]);
});

test("baixar arte e pacote .zip guardam em Já feitos", async ({ page }) => {
  const d1 = page.waitForEvent("download");
  await page.click("#grid .card:nth-child(1) .btn");
  expect((await d1).suggestedFilename()).toMatch(/_feed\.jpg$/);
  await expect(page.locator("#galGrid .gcard")).toHaveCount(1, { timeout: 15_000 });

  const d2 = page.waitForEvent("download");
  await page.click("#zipAll");
  expect((await d2).suggestedFilename()).toMatch(/_fotos\.zip$/);
  await expect(page.locator("#galGrid .gcard")).toHaveCount(7, { timeout: 30_000 });

  // filtro e exclusão em dois toques
  await page.click('#galFilter button[data-v="video"]');
  await expect(page.locator("#galGrid .gcard")).toHaveCount(0);
  await page.click('#galFilter button[data-v="all"]');
  const del = page.locator("#galGrid .gcard").first().locator(".del");
  await del.click(); await expect(del).toHaveText(/confirmar/i); await del.click();
  await expect(page.locator("#galGrid .gcard")).toHaveCount(6);

  // continua guardado depois de recarregar a página
  await page.reload(); await page.waitForTimeout(800);
  await expect(page.locator("#galGrid .gcard")).toHaveCount(6);
});

test("vídeo: prévia, 3 formatos e gravação", async ({ page }) => {
  await page.setInputFiles("#file", FIX + "video-teste.webm");
  await expect(page.locator("#makeVideos")).toBeVisible();
  await expect(page.locator("#grid .card")).toHaveCount(3);
  await page.click("#makeVideos");
  await expect(page.locator(".res", { hasText: "Vídeos prontos" })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".res .btn.ghost")).toHaveCount(3);
});

test("barra Frente | Frente e costas | Costas e painel Vídeo da peça", async ({ page }) => {
  // sem cenário para não depender do recorte: frente vermelha, costas azul
  await page.click('.scene[data-id="original"]');
  const png = cor => page.evaluate(cor => { const c = canvas(400, 600), g = c.getContext("2d"); g.fillStyle = cor; g.fillRect(0, 0, 400, 600); return c.toDataURL("image/png").split(",")[1]; }, cor);
  await page.setInputFiles("#file", [
    { name: "frente.png", mimeType: "image/png", buffer: Buffer.from(await png("#d22"), "base64") },
    { name: "costas.png", mimeType: "image/png", buffer: Buffer.from(await png("#22d"), "base64") },
  ]);
  await page.waitForFunction(() => S.items.filter(i => i.kind === "photo" && !i.example).length === 2);
  await page.waitForTimeout(200);
  // 1ª foto = frente, 2ª = costas; a barra tem só os 3 itens e abre em "Frente e costas"
  expect(await page.evaluate(() => S.items[0].pair === S.items[1] && S.sel === S.items[0] && showPair())).toBe(true);
  await expect(page.locator("#items .tag")).toHaveText([/^frente$/i, /frente e costas/i, /^costas$/i]);
  await expect(page.locator("#items .item.on .tag")).toHaveText(/frente e costas/i);
  await expect(page.locator("#grid .card")).toHaveCount(6);
  await expect(page.locator("#vpanel")).toBeHidden(); // sem vídeo, sem painel
  // frente e costas: frente à esquerda, costas à direita nos 6 espaços
  const lados = await page.evaluate(() => FORMATS.filter(f => f.media.includes("photo")).every(f => {
    const c = canvas(f.w, f.h), g = c.getContext("2d"); renderFormat(g, f.w, f.h, S.items[0], f, null, null, viewOpt());
    const px = (x, y) => [...g.getImageData(Math.round(f.w * x), Math.round(f.h * y), 1, 1).data];
    const e = px(.3, .88), d = px(.75, .88); return e[0] > e[2] && d[2] > d[0]; }));
  expect(lados).toBe(true);
  // Frente: só a frente (vermelho dos dois lados); Costas: só as costas (azul)
  const so = async i => { await page.locator(".item").nth(i).click(); return page.evaluate(() => { const f = FORMATS[0], c = canvas(f.w, f.h), g = c.getContext("2d"); renderFormat(g, f.w, f.h, S.sel, f, null, null, viewOpt());
    const px = x => [...g.getImageData(Math.round(f.w * x), Math.round(f.h * .88), 1, 1).data]; return [px(.3), px(.75)].map(p => p[0] > p[2] ? "v" : "a").join(""); }); };
  expect(await so(0)).toBe("vv");
  expect(await so(2)).toBe("aa");
  await page.locator(".item").nth(1).click();
  // inverter frente e costas
  await page.click("#pairSwap");
  expect(await page.evaluate(() => S.sel.name === "costas.png" && backOf(S.sel).name === "frente.png" && showPair())).toBe(true);
  await page.click("#pairSwap");
  // vídeo enviado: some da barra (fica no painel) e o painel aparece em "Frente e costas"
  await page.setInputFiles("#file", FIX + "video-teste.webm");
  await expect(page.locator("#vpanel")).toBeVisible();
  await expect(page.locator("#items .item")).toHaveCount(3);
  await expect(page.locator("#toast")).toContainText("Vídeo da peça");
  await page.locator(".item").nth(0).click(); await expect(page.locator("#vpanel")).toBeHidden(); // Frente: só fotos
  await page.locator(".item").nth(1).click(); await expect(page.locator("#vpanel")).toBeVisible();
  await expect(page.locator(".vp-seg")).toHaveCount(4); // frente, costas, vídeo, cartão
  await expect(page.locator(".vp-out input")).toHaveCount(5);
  // gera só 2 (montagem 9:16 e só o vídeo 4:5) para o teste ser rápido
  for (const id of ["m-feed", "c-vertical", "c-tts"]) await page.locator(`.vp-out input[data-id="${id}"]`).uncheck();
  await expect(page.locator("#vpGen")).toHaveText(/gerar 2 vídeos/i);
  await page.click("#vpGen");
  await expect(page.locator(".vp-results .res", { hasText: "2 vídeos prontos" })).toBeVisible({ timeout: 180_000 });
  const nomes = [];
  for (let i = 0; i < 2; i++) { const d = page.waitForEvent("download"); await page.locator(".vp-results .res .btn.ghost").nth(i).click(); nomes.push((await d).suggestedFilename()); }
  expect(nomes[0]).toMatch(/_montagem_vertical\.(mp4|webm)$/);
  expect(nomes[1]).toMatch(/_video-01_feed\.(mp4|webm)$/);
});

test("vídeo: dizeres e logo embaixo por padrão, numa faixa só, fora das áreas do app; fotos não mudam", async ({ page }) => {
  expect(await page.evaluate(() => S.vidPos)).toBe("bottom"); // padrão: embaixo, longe do rosto da modelo
  // nas fotos o texto continua em cima
  expect(await page.evaluate(() => FORMATS.filter(f => f.text).every(f => planArt(f.w, f.h, f, false).text.y < f.h * .2))).toBe(true);
  const r = await page.evaluate(() => {
    const prob = [];
    S.vidPos = "bottom";
    for (const id of ["vertical", "feed", "tts-video"]) for (const lay of ["editorial", "etiqueta", "none"]) for (const mk of ["logo", "mono", "none"]) {
      S.layout = lay; S.mark = mk; const f = FORMATS.find(x => x.id === id), W = f.w, H = f.h, plan = planArt(W, H, f, true);
      const caixas = [plan.text && [plan.text.x, plan.text.y, plan.text.tb.w, plan.text.tb.h], plan.mark && [plan.mark.x, plan.mark.y, plan.mark.w, plan.mark.h]].filter(Boolean);
      for (const [x, y, w, h] of caixas) {
        if (y < H * (f.vertical ? .55 : .6)) prob.push(`${id}/${lay}/${mk}: subiu demais (pode cobrir o rosto)`);
        if (y + h > (f.vertical ? H * (1 - SAFE_V.b) : H) + 1) prob.push(`${id}/${lay}/${mk}: na faixa de legenda`);
        if (f.vertical && x + w > W * (1 - SAFE_V.icons) + 1) prob.push(`${id}/${lay}/${mk}: nos botões da direita`);
      }
      if (plan.text && plan.mark) { const t = plan.text, m = plan.mark; if (!(m.x >= t.x + t.tb.w || m.x + m.w <= t.x || m.y >= t.y + t.tb.h || m.y + m.h <= t.y)) prob.push(`${id}/${lay}/${mk}: logo em cima do texto`); }
    }
    return prob;
  });
  expect(r).toEqual([]);
});

test("MP4 padrão para WhatsApp: MP4 fragmentado vira MP4 inteiro H.264 + AAC", async ({ page }) => {
  // o navegador grava MP4 fragmentado (o WhatsApp recusa como "formato incomum"); o estúdio reorganiza o arquivo
  const r = await page.evaluate(async () => {
    const entrada = await (await fetch("tests/fixtures/fragmentado-h264.mp4")).blob();
    const saida = await toStandardMp4(entrada);
    const caixas = b => { const d = new DataView(b), o = []; for (let i = 0; i < d.byteLength - 8;) { const s = d.getUint32(i); o.push(String.fromCharCode(...new Uint8Array(b, i + 4, 4))); i += s >= 8 ? s : d.byteLength; } return o; };
    return { antes: caixas(await entrada.arrayBuffer()), depois: caixas(await saida.arrayBuffer()), tipo: saida.type, semSom: saida.semSom };
  });
  expect(r.antes).toContain("moof");
  expect(r.depois).toEqual(["ftyp", "moov", "mdat"]); // inteiro, índice no começo
  expect(r.tipo).toBe("video/mp4");
  expect(r.semSom).toBe(false);
});

test("arquivo quebrado avisa e não entra na lista", async ({ page }) => {
  await page.setInputFiles("#file", { name: "quebrado.jpg", mimeType: "image/jpeg", buffer: Buffer.from("não é imagem") });
  await expect(page.locator("#toast")).toContainText("Não consegui abrir");
  expect(await page.evaluate(() => S.items.every(i => i.example))).toBe(true);
});

test("celular: sem rolagem lateral e prévia antes do enquadramento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload(); await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.evaluate(() => document.querySelector(".stage").getBoundingClientRect().top < document.getElementById("st3").getBoundingClientRect().top)).toBe(true);
});

test("recorte da modelo e frente e costas (precisa de tests/fixtures/modelo.jpg)", async ({ page }) => {
  test.skip(!MODELO, "Coloque uma foto de modelo em tests/fixtures/modelo.jpg para rodar este teste.");
  await page.setInputFiles("#file", [MODELO, MODELO]);
  await expect.poll(() => page.evaluate(() => S.items.length === 2 && S.items.every(i => ["done", "error"].includes(i.cutState))), { timeout: 200_000 }).toBe(true);
  expect(await page.evaluate(() => S.items.map(i => i.cutState))).toEqual(["done", "done"]);

  // 9:16: modelo inteira, entre o texto e a faixa de legenda, fora da coluna de botões da direita
  const v = await page.evaluate(() => {
    const it = S.items[0], fmt = FORMATS.find(f => f.id === "vertical"), W = fmt.w, H = fmt.h, out = [];
    for (const layout of ["editorial", "etiqueta", "none"]) for (const mark of ["logo", "none"]) {
      S.layout = layout; S.mark = mark;
      const plan = planArt(W, H, fmt, false), L = subjectLayout(it, W, H, fmt, plan), b = it.bbox;
      const topo = L.y + b.y * L.s, base = L.y + (b.y + b.h) * L.s, dir = L.x + (b.x + b.w) * L.s, esq = L.x + b.x * L.s;
      const textoBase = plan.text ? plan.text.y + plan.text.tb.h : 0;
      out.push(topo >= textoBase && topo >= 0 && base <= H * (1 - SAFE_V.b + .016) && esq >= 0 && dir <= W * (1 - SAFE_V.icons));
    }
    return out;
  });
  expect(v.every(Boolean)).toBe(true);
  await page.click(".item >> nth=0");
  await page.selectOption("#pairSel", { index: 1 });
  expect(await page.evaluate(() => !!backOf(S.items[0]))).toBe(true);
  await expect(page.locator("#sum")).toContainText("1 peça"); // frente, frente e costas, costas
});
