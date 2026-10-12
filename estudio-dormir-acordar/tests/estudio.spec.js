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

test("frente e costas automáticas e vídeo frente + costas + vídeo (7º espaço)", async ({ page }) => {
  // sem cenário para não depender do recorte: frente vermelha, costas azul
  await page.click('.scene[data-id="original"]');
  const png = cor => page.evaluate(cor => { const c = canvas(400, 600), g = c.getContext("2d"); g.fillStyle = cor; g.fillRect(0, 0, 400, 600); return c.toDataURL("image/png").split(",")[1]; }, cor);
  await page.setInputFiles("#file", [
    { name: "frente.png", mimeType: "image/png", buffer: Buffer.from(await png("#d22"), "base64") },
    { name: "costas.png", mimeType: "image/png", buffer: Buffer.from(await png("#22d"), "base64") },
  ]);
  // 1ª foto = frente, 2ª = costas, ligadas sozinhas; a frente fica aberta
  await page.waitForFunction(() => S.items.filter(i => i.kind === "photo" && !i.example).length === 2);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => S.items[0].pair === S.items[1] && S.sel === S.items[0])).toBe(true);
  await expect(page.locator("#items .tag")).toHaveText([/frente/i, /costas/i]);
  await expect(page.locator("#grid .card")).toHaveCount(6); // sem vídeo, sem o 7º espaço
  // nos 6 espaços: frente à esquerda, costas à direita
  const lados = await page.evaluate(async () => {
    const out = {};
    for (const f of FORMATS.filter(f => f.media.includes("photo"))) {
      const c = canvas(f.w, f.h), g = c.getContext("2d"); renderFormat(g, f.w, f.h, S.items[0], f, null, null);
      const px = (x, y) => [...g.getImageData(Math.round(f.w * x), Math.round(f.h * y), 1, 1).data];
      const e = px(.3, .88), d = px(.75, .88); out[f.id] = e[0] > e[2] && d[2] > d[0];
    }
    return out;
  });
  expect(Object.values(lados).every(Boolean)).toBe(true);
  expect(await page.evaluate(() => S.items.filter(i => i.kind === "photo" && !isBackOfAnother(i)).length)).toBe(1); // costas não sai sozinha
  // inverter frente e costas
  await page.click("#pairSwap");
  expect(await page.evaluate(() => S.sel.name === "costas.png" && S.items[0].name === "costas.png" && backOf(S.items[0]).name === "frente.png")).toBe(true);
  await page.click("#pairSwap");
  // com o vídeo, aparece o 7º espaço na foto de frente
  await page.setInputFiles("#file", FIX + "video-teste.webm");
  await expect(page.locator("#grid .card")).toHaveCount(3); // modo vídeo continua igual
  await page.click(".item >> nth=0");
  await expect(page.locator("#grid .card")).toHaveCount(7);
  await expect(page.locator(".mcard")).toContainText("frente + costas + vídeo");
  const plano = await page.evaluate(() => ({ ...montagePlan(montageSource()), cartao: S.endCard }));
  expect(plano.total).toBeCloseTo(3 + 3 + plano.vlen + (plano.cartao ? 2 : 0), 1);
  await page.click(".mcard .btn:not(.ghost)");
  await expect(page.locator("#results .res", { hasText: "Vídeo pronto" })).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("#results .res .btn.ghost")).toHaveCount(2); // 9:16 e 4:5
  const nomes = [];
  for (let i = 0; i < 2; i++) { const d = page.waitForEvent("download"); await page.locator("#results .res .btn.ghost").nth(i).click(); nomes.push((await d).suggestedFilename()); }
  expect(nomes.join(" ")).toMatch(/video-montagem_vertical\.(mp4|webm).*video-montagem_feed\.(mp4|webm)/);
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
  await expect(page.locator("#sum")).toContainText("1 foto");
});
