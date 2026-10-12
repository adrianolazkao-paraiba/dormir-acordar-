"use strict";
/* ============ Utilidades ============ */
const $ = id => document.getElementById(id);
function rng(seed){ let a = seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function canvas(w,h){ const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; }
function slug(s){ return (s||"peca").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40) || "peca"; }
function fmtTime(t){ return (Math.max(0,t)||0).toFixed(1).replace(".",","); }
function money(v){
  v = (v||"").trim(); if(!v) return "";
  const n = parseFloat(v.replace(/\s|R\$/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."));
  if(!isFinite(n)) return v;
  return "R$ " + n.toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2});
}
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, 3600); }
function roundRect(ctx,x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
/* desfoque compatível com Safari antigo: sombra deslocada da forma desenhada fora da tela */
function softShape(ctx, drawPath, color, blur){
  ctx.save(); ctx.shadowColor=color; ctx.shadowBlur=blur; const off=100000; ctx.shadowOffsetX=off;
  ctx.translate(-off,0); ctx.fillStyle="#000"; drawPath(ctx); ctx.fill(); ctx.restore();
}
function blurCopy(src, w, h, factor){ // desfoque barato por redução
  const sw=Math.max(8,Math.round(w/factor)), sh=Math.max(8,Math.round(h/factor));
  const small=canvas(sw,sh); const s=small.getContext("2d"); s.imageSmoothingQuality="high"; s.drawImage(src,0,0,sw,sh);
  const out=canvas(w,h); const o=out.getContext("2d"); o.imageSmoothingQuality="high"; o.drawImage(small,0,0,w,h); return out;
}
let grainTile=null;
function grain(){
  if(grainTile) return grainTile;
  const c=canvas(192,192), g=c.getContext("2d"), d=g.createImageData(192,192), r=rng(7);
  for(let i=0;i<d.data.length;i+=4){ const v=r()*255|0; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255; }
  g.putImageData(d,0,0); return grainTile=c;
}
function addGrain(ctx,W,H,alpha){
  ctx.save(); ctx.globalAlpha=alpha; ctx.globalCompositeOperation="overlay";
  const pat=ctx.createPattern(grain(),"repeat"); const sc=Math.max(1,W/1080);
  ctx.scale(sc,sc); ctx.fillStyle=pat; ctx.fillRect(0,0,W/sc,H/sc); ctx.restore();
}
function spaced(ctx, text, x, y, spacing){
  if("letterSpacing" in ctx){ ctx.letterSpacing = spacing+"px"; ctx.fillText(text,x,y); ctx.letterSpacing="0px"; return ctx.measureText(text).width + spacing*text.length; }
  let cx=x; for(const ch of text){ ctx.fillText(ch,cx,y); cx+=ctx.measureText(ch).width+spacing; } return cx-x;
}
function spacedWidth(ctx,text,spacing){ return ctx.measureText(text).width + spacing*Math.max(0,text.length); }
function wrap(ctx, text, maxW, maxLines){
  const words=(text||"").split(/\s+/).filter(Boolean), lines=[]; let cur="";
  for(const w of words){ const t=cur?cur+" "+w:w; if(ctx.measureText(t).width<=maxW||!cur){ cur=t; } else { lines.push(cur); cur=w; } }
  if(cur) lines.push(cur);
  if(lines.length>maxLines){ const keep=lines.slice(0,maxLines); let last=keep[maxLines-1]; while(last.length>1 && ctx.measureText(last+"…").width>maxW) last=last.slice(0,-1); keep[maxLines-1]=last.replace(/\s+$/,"")+"…"; return keep; }
  return lines;
}
