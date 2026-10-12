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

test("montagem: vídeo + frente + costas nos 3 formatos", async ({ page }) => {
  // duas fotos (frente e costas) e o vídeo; sem cenário para não depender do recorte
  await page.click('.scene[data-id="original"]');
  await page.evaluate(() => { for (const id of ["tts-main", "mkt"]) S.include.delete(id); });
  await page.setInputFiles("#file", { name: "frente.png", mimeType: "image/png", buffer: Buffer.from(await page.evaluate(() => { const c = canvas(400, 600), g = c.getContext("2d"); g.fillStyle = "#c33"; g.fillRect(0, 0, 400, 600); return c.toDataURL("image/png").split(",")[1]; }), "base64") });
  await page.setInputFiles("#file", { name: "costas.png", mimeType: "image/png", buffer: Buffer.from(await page.evaluate(() => { const c = canvas(400, 600), g = c.getContext("2d"); g.fillStyle = "#33c"; g.fillRect(0, 0, 400, 600); return c.toDataURL("image/png").split(",")[1]; }), "base64") });
  await expect(page.locator("#montage")).toBeHidden(); // só aparece no modo vídeo
  await page.setInputFiles("#file", FIX + "video-teste.webm");
  await expect(page.locator("#montage")).toBeVisible();
  await expect(page.locator("#items .tag", { hasText: /frente/i })).toHaveCount(1);
  await expect(page.locator("#items .tag", { hasText: /costas/i })).toHaveCount(1);
  await expect(page.locator("#mBoard canvas")).toHaveCount(3);
  const plano = await page.evaluate(() => FORMATS.filter(f => f.media.includes("video")).map(f => montagePlan(S.sel, f)));
  expect(plano.every(p => p.segs.filter(s => s.k === "photo").length === 2)).toBe(true);
  const tts = await page.evaluate(() => { const it = S.sel, d = it.dur; it.dur = 40; const p = montagePlan(it, FORMATS.find(f => f.id === "tts-video")); it.dur = d; return p.total; });
  expect(tts).toBeLessThanOrEqual(15); // TikTok Shop nunca passa de 15 s
  await page.selectOption("#mBack", "none");
  await expect(page.locator("#mBoard canvas")).toHaveCount(2);
  await page.selectOption("#mBack", { index: 1 });
  await page.click("#makeMontage");
  await expect(page.locator("#mResults .res", { hasText: "Montagem pronta" })).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("#mResults .res .btn.ghost")).toHaveCount(3);
  const d = page.waitForEvent("download");
  await page.locator("#mResults .res .btn.ghost").first().click();
  expect((await d).suggestedFilename()).toMatch(/_montagem_feed\.(mp4|webm)$/);
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
