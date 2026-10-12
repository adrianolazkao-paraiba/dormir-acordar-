"use strict";
/* ============ Cenários ============ */
/* Cenários fotográficos: fs = altura (0 a 1) onde o chão começa na foto, fx = centro de interesse na horizontal */
const SCENES = [
  { id:"original", name:"Foto original", tone:"photo" },
  { id:"studio", name:"Estúdio areia", tone:"light" },
  { id:"window", name:"Luz de janela", tone:"light" },
  { id:"linen", name:"Cortina de linho", tone:"light" },
  { id:"paris", name:"Apartamento Paris", tone:"light" },
  { id:"night", name:"Cenário da marca", tone:"dark" },
  { id:"sage", name:"Sálvia", tone:"light" },
  { id:"rose", name:"Rosa pó", tone:"light" },
  { id:"custom", name:"Seu cenário", tone:"photo" }
];
const photoImgs = {};
function scenePhoto(id){
  const sc=SCENES.find(x=>x.id===id); if(!sc||!sc.photo) return null;
  let p=photoImgs[id];
  if(!p){ const im=new Image(); p=photoImgs[id]={img:im, ok:false, sc};
    im.onload=()=>{ p.ok=true; for(const k of [...sceneCache.keys()]) if(k.startsWith(id+":")) sceneCache.delete(k); renderScenesThumbs(); schedule(); };
    im.onerror=()=>{ p.failed=true; };
    im.src=sc.photo; }
  return p;
}
/* desenha a foto do cenário cobrindo o quadro, presa pela base, garantindo chão visível acima da linha dos pés */
function paintPhotoScene(ctx,W,H,p){
  const im=p.img, sc=p.sc, iw=im.naturalWidth, ih=im.naturalHeight;
  const vertical = H/W>1.7, floorY = vertical ? H*(1-SAFE_V.b+.015) : H*.925;
  let s=Math.max(W/iw,H/ih), dh=ih*s;
  const need=(H*1.05-floorY)/(1-sc.fs); if(dh<need){ s*=need/dh; dh=ih*s; }
  const dw=iw*s; let x=W/2-sc.fx*dw; x=Math.min(0,Math.max(W-dw,x));
  ctx.imageSmoothingQuality="high"; ctx.drawImage(im,x,H-dh,dw,dh);
}
