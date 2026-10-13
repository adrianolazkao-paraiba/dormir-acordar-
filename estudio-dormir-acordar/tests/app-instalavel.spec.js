// App instalável: service worker, manifesto, ícones, funcionamento sem internet e botão "Instalar app".
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const raiz = new URL("../", import.meta.url);
const ler = p => readFileSync(new URL(p, raiz), "utf8");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

test("sw.js guarda todos os arquivos que o index.html carrega", () => {
  const html = ler("index.html"), sw = ler("sw.js");
  const usados = [...html.matchAll(/(?:src|href)="((?:js|css|assets)\/[^"]+|manifest\.webmanifest)"/g)].map(m => m[1]);
  const man = JSON.parse(ler("manifest.webmanifest"));
  for (const f of [...usados, ...man.icons.map(i => i.src)]) expect(sw, f).toContain(`"${f}"`);
});

test.describe("com service worker", () => {
  test.use({ serviceWorkers: "allow" });

  test("instalável no Chrome e abre sem internet", async ({ page, context }) => {
    const erros = []; page.on("pageerror", e => erros.push(String(e)));
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    // o próprio Chrome diz se o app pode ser instalado (sem erros = aparece "Instalar app")
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    expect(installabilityErrors).toEqual([]);
    const man = await cdp.send("Page.getAppManifest");
    expect(man.errors).toEqual([]);

    // ícones existem com o tamanho certo
    const tamanhos = await page.evaluate(async () => {
      const m = await (await fetch("manifest.webmanifest")).json(), out = {};
      for (const i of m.icons) { const b = await createImageBitmap(await (await fetch(i.src)).blob()); out[i.src] = `${b.width}x${b.height}`; if (out[i.src] !== i.sizes) throw new Error(i.src); }
      return out;
    });
    expect(Object.keys(tamanhos).length).toBe(3);

    // sem internet: o app abre do que ficou guardado, desenha as prévias e gera uma arte
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#grid .card")).toHaveCount(6);
    const tam = await page.evaluate(async () => (await renderFull(S.items[0], FORMATS.find(f => f.id === "feed"))).size);
    expect(tam).toBeGreaterThan(20000);
    expect(await page.evaluate(() => typeof JSZip)).toBe("function");
    await context.setOffline(false);
    expect(erros).toEqual([]);
  });

  test("recorte da modelo funciona sem internet depois do primeiro uso", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.evaluate(() => getSession()); // baixa o modelo uma vez (fica guardado)
    await context.setOffline(true);
    await page.reload();
    const ok = await page.evaluate(async () => { const it = S.items[0]; return !!(await cutout(it.src, it.w, it.h)); });
    await context.setOffline(false);
    expect(ok).toBe(true);
  });
});

test.describe("iPhone", () => {
  test.use({ userAgent: IPHONE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("botão Instalar app mostra o passo a passo do Safari", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("#installBtn");
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator("#installSheet")).toBeVisible();
    await expect(page.locator("#installSteps")).toContainText("Adicionar à Tela de Início");
    await expect(page.locator("#installNote")).toContainText("Abrir no Safari");
    const caixa = await page.locator(".sheet").boundingBox();
    expect(caixa.x).toBeGreaterThanOrEqual(0); expect(caixa.x + caixa.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: process.env.FOTOS ? process.env.FOTOS + "/instalar-iphone.png" : test.info().outputPath("instalar-iphone.png") });
    await page.locator("#installOk").click();
    await expect(page.locator("#installSheet")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
  test("aberto pelo ícone (já instalado) o botão some", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await page.goto("/");
    await expect(page.locator("#grid .card")).toHaveCount(6);
    await expect(page.locator("#installBtn")).toBeHidden();
  });
});

test.describe("Android", () => {
  test.use({ userAgent: ANDROID, viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  test("sem o pedido do Chrome, mostra o caminho pelo menu", async ({ page }) => {
    await page.goto("/");
    await page.locator("#installBtn").click();
    await expect(page.locator("#installSteps")).toContainText("Instalar app");
    await page.keyboard.press("Escape");
    await expect(page.locator("#installSheet")).toBeHidden();
  });
  test("com o pedido do Chrome, o botão abre a instalação", async ({ page }) => {
    await page.goto("/");
    const r = await page.evaluate(async () => {
      let chamou = false;
      const e = new Event("beforeinstallprompt", { cancelable: true });
      e.prompt = async () => { chamou = true; }; e.userChoice = Promise.resolve({ outcome: "accepted" });
      dispatchEvent(e);
      $("installBtn").click(); await new Promise(r => setTimeout(r, 50));
      return { chamou, padraoEvitado: e.defaultPrevented, guia: !$("installSheet").hidden };
    });
    expect(r).toEqual({ chamou: true, padraoEvitado: true, guia: false });
  });
});

test("computador: botão só aparece quando o Chrome oferece instalar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#grid .card")).toHaveCount(6);
  await expect(page.locator("#installBtn")).toBeHidden();
  await page.evaluate(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: "dismissed" }); dispatchEvent(e); });
  await expect(page.locator("#installBtn")).toBeVisible();
});
