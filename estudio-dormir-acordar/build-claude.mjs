// Monta a versão para publicar no claude.ai: um único HTML com o CSS e os scripts de js/ embutidos,
// na mesma ordem do index.html. vendor/, model/ e assets/ continuam como arquivos ao lado.
// Uso: npm run build:claude   →   dist/estudio-dormir-acordar.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const raiz = new URL(".", import.meta.url);
const ler = p => readFileSync(new URL(p, raiz), "utf8");
let html = ler("index.html");

const css = '<link rel="stylesheet" href="css/estudio.css">';
if (!html.includes(css)) throw new Error("index.html sem o link do css/estudio.css");
html = html.replace(css, () => `<style>\n${ler("css/estudio.css")}\n</style>`);

let n = 0;
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) => {
  const js = ler(p);
  if (/<\/script/i.test(js)) throw new Error(`${p} contém </script> e quebraria o HTML`);
  n++; return `<script>\n${js}\n</script>`;
});
const esperado = readdirSync(new URL("js/", raiz)).filter(f => f.endsWith(".js")).length;
if (n !== esperado) throw new Error(`a pasta js/ tem ${esperado} arquivos, mas o index.html carrega ${n}`);

mkdirSync(new URL("dist/", raiz), { recursive: true });
writeFileSync(new URL("dist/estudio-dormir-acordar.html", raiz), html);
console.log(`dist/estudio-dormir-acordar.html pronto (${n} scripts, ${(html.length / 1024).toFixed(0)} KB)`);
