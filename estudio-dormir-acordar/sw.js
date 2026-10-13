/* Service worker do Estúdio: deixa o app instalável (ícone na tela do celular) e abrindo sem internet.
   - Arquivos do app (HTML, CSS, JS, ícones): busca na rede primeiro, para sempre pegar a versão nova;
     sem internet, usa a cópia guardada.
   - Modelo de recorte e bibliotecas (model/, vendor/): grandes e fixos, usa a cópia guardada primeiro.
     Ao trocar algo em model/ ou vendor/, aumente VERSAO para o celular baixar de novo. */
const VERSAO = "v2";
const APP = "estudio-app-" + VERSAO, PESADOS = "estudio-pesados-" + VERSAO;
const BASICOS = [
  "./", "index.html", "manifest.webmanifest", "css/estudio.css", "css/fontes.css",
  "fonts/fraunces-latin-39ce20.woff2", "fonts/fraunces-latin-bf1253.woff2", "fonts/fraunces-latin-ext-796716.woff2", "fonts/fraunces-latin-ext-c50079.woff2", "fonts/inter-latin-567244.woff2", "fonts/inter-latin-ext-395290.woff2",
  "assets/logo.jpg", "assets/icone-180.png", "assets/icone-192.png", "assets/icone-512.png", "assets/icone-maskable-512.png",
  "js/00-plataforma.js", "js/01-marca.js", "js/02-formatos.js", "js/03-cenarios-lista.js", "js/04-estado.js",
  "js/05-utilidades.js", "js/06-cenarios-desenho.js", "js/07-exemplo.js", "js/08-recorte.js", "js/09-composicao.js",
  "js/10-frente-costas.js", "js/11-itens.js", "js/12-interface.js", "js/13-exportacao.js", "js/14-video.js",
  "js/14b-montagem.js", "js/15-ja-feitos.js", "js/16-legendas.js", "js/17-eventos.js", "js/18-inicio.js", "js/19-instalar.js",
];
const PESADOS_INICIO = ["vendor/jszip.min.js", "vendor/ort/ort.wasm.min.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const app = await caches.open(APP);
    await app.addAll(BASICOS.map(u => new Request(u, { cache: "reload" })));
    await (await caches.open(PESADOS)).addAll(PESADOS_INICIO);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const manter = [APP, PESADOS];
    for (const k of await caches.keys()) if (k.startsWith("estudio-") && !manter.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const pesado = url => /\/(model|vendor)\//.test(url.pathname);

async function redePrimeiro(req) {
  const cache = await caches.open(APP);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const salvo = await cache.match(req, { ignoreSearch: true })
      || (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (salvo) return salvo;
    throw err;
  }
}
async function guardadoPrimeiro(req) {
  const cache = await caches.open(PESADOS);
  const salvo = await cache.match(req);
  if (salvo) return salvo;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL("./", location.href).pathname)) return;
  e.respondWith(pesado(url) ? guardadoPrimeiro(req) : redePrimeiro(req));
});
