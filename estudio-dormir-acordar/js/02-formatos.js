"use strict";
/* ============ Formatos ============ */
const SAFE_V = { t:.13, b:.22, l:.07, r:.07, icons:.16 }; // 9:16: topo, legenda/carrinho embaixo, coluna de botões à direita
const FORMATS = [
  { id:"feed", plat:"Instagram", name:"Feed e carrossel", w:1080, h:1350, ratio:"4:5", media:["photo","video"], text:true, logo:true, mode:"stack", maxDur:20,
    safe:{t:.06,b:.07,l:.07,r:.07}, grid34:true, note:"No seu perfil o post aparece cortado em 3:4. As linhas tracejadas mostram o corte." },
  { id:"vertical", plat:"Reels · Stories · TikTok", name:"Vertical tela cheia", w:1080, h:1920, ratio:"9:16", media:["photo","video"], text:true, logo:true,
    safe:SAFE_V, vertical:true, maxDur:20, note:"Texto, preço e logo ficam fora das áreas cobertas pelos botões do Instagram e do TikTok. Vídeo de até 20 s." },
  { id:"tts-video", plat:"TikTok Shop", name:"Vídeo do produto", w:1080, h:1920, ratio:"9:16", media:["video"], text:true, logo:true,
    safe:SAFE_V, vertical:true, maxDur:15, note:"Limitado a 15 s, a duração recomendada para vídeo de produto na loja." },
  { id:"tts-main", plat:"TikTok Shop", name:"Foto principal da vitrine", w:1080, h:1080, ratio:"1:1", media:["photo"], text:false, logo:false,
    forceScene:"white", fill:.86, note:"Regra da vitrine: fundo branco, peça ocupando a maior parte da foto, sem texto, sem logo e sem marca d’água." },
  { id:"tts-extra", plat:"TikTok Shop", name:"Fotos 2 a 9 do anúncio", w:1080, h:1080, ratio:"1:1", media:["photo"], text:true, logo:true, mode:"stack",
    safe:{t:.06,b:.06,l:.06,r:.06}, note:"Para as fotos seguintes: cenário, detalhe do tecido e preço." },
  { id:"pin", plat:"Pinterest", name:"Pin padrão", w:1000, h:1500, ratio:"2:3", media:["photo"], text:true, logo:true,
    safe:{t:.05,b:.06,l:.06,r:.06}, note:"Formato vertical que o Pinterest destaca no feed." },
  { id:"mkt", plat:"Shopee · Mercado Livre", name:"Foto principal do anúncio", w:1500, h:1500, ratio:"1:1", media:["photo"], text:false, logo:false,
    forceScene:"white", fill:.78, note:"Primeira foto em fundo branco, peça centralizada sem cortes, sem preço, logo ou marca d’água." }
];
