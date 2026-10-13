// Copia o estúdio (a pasta de cima) para www/, que vai inteiro para dentro do app Android.
// Assim o app funciona sem internet: modelo de recorte, bibliotecas, fontes e logo ficam no celular.
// Uso: npm run preparar   (depois: abrir android/ no Android Studio, ou deixar o GitHub montar o .apk)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const de = new URL("../", import.meta.url), para = new URL("www/", import.meta.url);
rmSync(para, { recursive: true, force: true });
mkdirSync(para);
for (const p of ["index.html", "manifest.webmanifest", "css", "js", "assets", "fonts", "model", "vendor"]) {
  if (!existsSync(new URL(p, de))) throw new Error(`falta ${p} no estúdio`);
  cpSync(new URL(p, de), new URL(p, para), { recursive: true });
}
// ponte com o Android (gravar e compartilhar arquivos), antes dos scripts do estúdio
cpSync(new URL("node_modules/@capacitor/core/dist/capacitor.js", import.meta.url), new URL("vendor/capacitor.js", para));
const html = readFileSync(new URL("index.html", para), "utf8");
const marca = '<script src="js/00-plataforma.js"></script>';
if (!html.includes(marca)) throw new Error("index.html sem js/00-plataforma.js");
writeFileSync(new URL("index.html", para), html.replace(marca, `<script src="vendor/capacitor.js"></script>\n${marca}`));
console.log("www/ pronto");
