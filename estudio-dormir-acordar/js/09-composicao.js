"use strict";
/* ============ Composição ============ */
/* Encaixa foto ou vídeo sem cortar a modelo: se a imagem for bem mais alta que o quadro,
   mostra a altura inteira e preenche as laterais com a própria imagem desfocada. */
const _edgeCache=new WeakMap();
/* cor das bordas da foto (em cima e embaixo), para completar o quadro sem repetir a imagem */
function edgeColors(src,sw,sh){
  let e=_edgeCache.get(src); if(e) return e;
  const n=24, c=canvas(n,n), g=c.getContext("2d",{willReadFrequently:true});
  e={top:"#E6DCCB", bottom:"#D8C9B0"};
  try{
    g.drawImage(src,0,0,n,n); const d=g.getImageData(0,0,n,n).data;
    const avg=(pts)=>{ let r=0,gg=0,b=0,al=0,k=0; for(const [x,y] of pts){ const i=(y*n+x)*4; r+=d[i]; gg+=d[i+1]; b+=d[i+2]; al+=d[i+3]; k++; } return {c:[r/k|0,gg/k|0,b/k|0], a:al/k}; };
    const rows=(ys)=>{ const p=[]; for(const y of ys) for(let x=0;x<n;x++) p.push([x,y]); for(let y=0;y<n;y++) for(const x of [0,n-1]) p.push([x,y]); return p; };
    const t=avg(rows([0,1])), bo=avg(rows([n-2,n-1]));
    if(t.a>200 && bo.a>200) e={top:`rgb(${t.c})`, bottom:`rgb(${bo.c})`}; // foto sem transparência
  }catch(err){}
  _edgeCache.set(src,e); return e;
}
function fillEdges(ctx,src,sw,sh,W,H){
  const e=edgeColors(src,sw,sh), g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,e.top); g.addColorStop(1,e.bottom);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
function drawFit(ctx, src, sw, sh, W, H, adj, bbox, region){
  const cover=Math.max(W/sw,H/sh);
  let s=cover, cx=sw/2, cy=sh/2, x, y;
  if(bbox && region){ // modelo encaixada inteira na área livre (fora do texto e da marca)
    const cut=(bbox.y+bbox.h)>=sh*.985, rb = cut && !region.keepUp ? H : region.y1;
    s=Math.min((region.x1-region.x0)/bbox.w, (rb-region.y0)/bbox.h)*(adj.size/100);
    x=(region.x0+region.x1)/2 - (bbox.x+bbox.w/2)*s; y=rb-(bbox.y+bbox.h)*s;
    if(y>0 && y+sh*s<H && !cut){ /* sobra espaço: mantém */ }
  } else {
    if(bbox){ const fitSub=Math.min(W*.94/bbox.w, H*.96/bbox.h); if(fitSub<s) s=fitSub; cx=bbox.x+bbox.w/2; cy=bbox.y+bbox.h/2; }
    else if(sh/sw > (H/W)*1.08){ s=H/sh; }
    s*=adj.size/100;
    const dw0=sw*s, dh0=sh*s;
    x=W/2-cx*s; y=H/2-cy*s;
    x = dw0>=W ? Math.min(0,Math.max(W-dw0,x)) : (W-dw0)/2;
    y = dh0>=H ? Math.min(0,Math.max(H-dh0,y)) : (H-dh0)/2;
  }
  const dw=sw*s, dh=sh*s;
  x+=(adj.x/50)*W*.25; y+=(adj.y/50)*H*.25;
  if(x>0.5||y>0.5||x+dw<W-0.5||y+dh<H-0.5){
    // completa o quadro com a cor das bordas da própria foto (sem repetir a imagem atrás)
    // e esfuma as bordas da foto que ficam dentro do quadro, para não parecer um retângulo colado
    fillEdges(ctx,src,sw,sh,W,H);
    const f=Math.max(2,Math.min(W,H,dw,dh)*.08), t=featherCanvas(W,H), g=t.getContext("2d");
    g.globalCompositeOperation="source-over"; g.clearRect(0,0,W,H); g.drawImage(src,x,y,dw,dh);
    g.globalCompositeOperation="destination-out";
    const fade=(x0,y0,x1,y1)=>{ const gr=g.createLinearGradient(x0,y0,x1,y1); gr.addColorStop(0,"rgba(0,0,0,1)"); gr.addColorStop(1,"rgba(0,0,0,0)"); return gr; };
    if(x>0.5){ g.fillStyle=fade(x,0,x+f,0); g.fillRect(x,y,f,dh); }
    if(x+dw<W-0.5){ g.fillStyle=fade(x+dw,0,x+dw-f,0); g.fillRect(x+dw-f,y,f,dh); }
    if(y>0.5){ g.fillStyle=fade(0,y,0,y+f); g.fillRect(x,y,dw,f); }
    if(y+dh<H-0.5){ g.fillStyle=fade(0,y+dh,0,y+dh-f); g.fillRect(x,y+dh-f,dw,f); }
    ctx.drawImage(t,0,0);
    return;
  }
  ctx.drawImage(src,x,y,dw,dh);
}
/* tela de apoio reaproveitada (o vídeo chama isto a cada quadro; criar uma nova por quadro pesa no celular) */
const _feather=new Map();
function featherCanvas(W,H){
  const k=W+"x"+H; let c=_feather.get(k);
  if(!c){ if(_feather.size>8) _feather.clear(); c=canvas(W,H); _feather.set(k,c); }
  return c;
}
function drawCover(ctx, src, sw, sh, W, H, adj, blurFill){
  const cover=Math.max(W/sw,H/sh), s=cover*(adj.size/100);
  const dw=sw*s, dh=sh*s;
  const maxX=Math.abs(dw-W)/2, maxY=Math.abs(dh-H)/2;
  const x=(W-dw)/2 + (adj.x/50)*maxX, y=(H-dh)/2 + (adj.y/50)*maxY;
  if(s<cover-1e-6 && blurFill){ // foto menor que o quadro: preenche com a própria foto desfocada
    const bs=cover*1.08, bw=sw*bs, bh=sh*bs; const tmp=canvas(W,H); tmp.getContext("2d").drawImage(src,(W-bw)/2,(H-bh)/2,bw,bh);
    ctx.drawImage(blurCopy(tmp,W,H,24),0,0); ctx.fillStyle="rgba(36,37,63,.12)"; ctx.fillRect(0,0,W,H);
  }
  ctx.drawImage(src,x,y,dw,dh);
}
let _mctx=null; function measureCtx(){ return _mctx || (_mctx=canvas(4,4).getContext("2d")); }

/* ============ Plano da arte ============
   Cada formato reserva um espaço para a marca, outro para o texto e o resto para a modelo.
   Formatos altos (9:16, 2:3): marca e texto no topo, modelo embaixo.
   Formatos baixos (4:5, 1:1): texto numa coluna à esquerda, modelo na coluna da direita. */
function markSize(W,mode){
  if(S.mark==="none") return null;
  const w = W*(S.mark==="logo" ? (mode==="stack"? .19 : .16) : (mode==="stack"? .15 : .14));
  const h = S.mark==="logo" ? w*(logoImg.naturalHeight||337)/(logoImg.naturalWidth||360) : w;
  return {w,h};
}
function textBlock(width, unit, mode){
  // mede o bloco de texto e devolve uma função que o desenha em (x,y)
  const P=S.P, ctx=measureCtx(), price=money(P.price), old=money(P.old), et = S.layout==="etiqueta";
  const pad = et? unit*.04 : 0, inner = width-pad*2;
  const es=unit*(et?.022:.024), ts=unit*(et? .05 : mode==="side"? .066 : .076), ps=unit*(et?.044:.046), ph=unit*.07;
  // o botão encolhe a letra se não couber na coluna
  let cs=unit*(et?.023:.026);
  if(P.cta){ ctx.font=`500 ${cs}px ${F.sans}`; const cw0=spacedWidth(ctx,P.cta.toUpperCase(),cs*.06), room=et? inner : width-unit*.08; if(cw0>room) cs*=room/cw0; }
  const tFont = et? `400 ${ts}px ${F.display}` : `300 ${ts}px ${F.display}`;
  ctx.font=tFont; const lines=wrap(ctx,P.name,inner,et?2:3);
  const ops=[]; let y=pad;
  if(P.eyebrow){ y+=es; ops.push({k:"eb",y}); y+=es*.75; }
  for(const ln of lines){ y+=ts*1.08; ops.push({k:"ln",y,t:ln}); }
  if(price){ y+=ps*1.5; ops.push({k:"pr",y}); }
  if(P.cta){ if(et){ y+=cs*2.1; ops.push({k:"ct",y}); } else { y+=unit*.035; ops.push({k:"pill",y}); y+=ph; } }
  y+=pad + (et?0:unit*.005);
  ctx.font=tFont; let tw=Math.max(0,...lines.map(l=>ctx.measureText(l).width));
  if(P.cta){ ctx.font=`500 ${cs}px ${F.sans}`; tw=Math.max(tw,spacedWidth(ctx,P.cta.toUpperCase(),cs*.06)); }
  if(P.eyebrow){ ctx.font=`600 ${es}px ${F.sans}`; tw=Math.max(tw,spacedWidth(ctx,P.eyebrow.toUpperCase(),es*.16)); }
  const w = et ? Math.min(width, Math.max(tw, unit*.34)+pad*2) : width;
  return { h:y, w, draw(c,x,y0,tone,alpha){
    const dark = !et && tone!=="light", ink = et? C.deep : dark? C.areia : C.deep, acc = (dark? C.gold : "#9C7A43");
    c.save(); c.globalAlpha=alpha; c.textBaseline="alphabetic";
    if(et){ c.save(); c.shadowColor="rgba(36,37,63,.18)"; c.shadowBlur=unit*.03; c.shadowOffsetY=unit*.008; roundRect(c,x,y0,w,y,unit*.028); c.fillStyle="rgba(251,248,242,.96)"; c.fill(); c.restore(); }
    const X=x+pad;
    for(const o of ops){
      const Y=y0+o.y;
      if(o.k==="eb"){ c.font=`600 ${es}px ${F.sans}`; c.fillStyle=acc; spaced(c,P.eyebrow.toUpperCase(),X,Y,es*.16); }
      else if(o.k==="ln"){ c.font=tFont; c.fillStyle=ink; c.fillText(o.t,X,Y); }
      else if(o.k==="pr"){ let px=X;
        if(old){ c.font=`400 ${ps*.72}px ${F.sans}`; c.fillStyle=(et||!dark)?"rgba(36,37,63,.5)":"rgba(241,232,212,.7)"; c.fillText(old,px,Y); const ow=c.measureText(old).width; c.fillRect(px,Y-ps*.25,ow,Math.max(1.5,unit*.0025)); px+=ow+unit*.022; }
        c.font=`${et?600:500} ${ps}px ${F.sans}`; c.fillStyle=et? C.navy : ink; c.fillText(price,px,Y); }
      else if(o.k==="ct"){ c.font=`500 ${cs}px ${F.sans}`; c.fillStyle=C.navy; spaced(c,P.cta.toUpperCase(),X,Y,cs*.06); }
      else if(o.k==="pill"){ c.font=`500 ${cs}px ${F.sans}`; const t=P.cta.toUpperCase(), sp=cs*.06, tw2=spacedWidth(c,t,sp), pw=Math.min(width,tw2+unit*.08);
        const lightPill = dark;
        roundRect(c,X,Y,pw,ph,ph/2); c.fillStyle=lightPill? C.areia : C.navy; c.fill();
        c.fillStyle=lightPill? C.deep : C.nuvem; spaced(c,t,X+unit*.04,Y+ph/2+cs*.36,sp); }
    }
    c.restore(); } };
}
function planArt(W,H,fmt,isVideo){
  const safe=fmt.safe||{t:.06,b:.06,l:.07,r:.07};
  const unit=Math.min(W,H*.8), mode = H/W>1.3 ? "stack" : "side", gap=unit*.04;
  const textOn = !!fmt.text && S.layout!=="none";
  const xL=W*safe.l, xR=W-W*(fmt.vertical? .07 : safe.r), yT=H*safe.t, yB=H*(1-safe.b);
  const ms = fmt.logo ? markSize(W,mode) : null;
  const plan={mode,unit,textOn,mark:null,text:null,box:null,textAt:"top"};
  const bottomText = isVideo && S.vidPos==="bottom";
  if(mode==="stack"){
    if(ms) plan.mark={x:xR-ms.w, y:yT, w:ms.w, h:ms.h};
    if(textOn){ const width=(ms? xR-ms.w-gap : xR)-xL; const tb=textBlock(width,unit,mode);
      plan.text={x:xL, y: bottomText? yB-tb.h : yT+unit*.005, tb}; plan.textAt = bottomText? "bottom" : "top"; }
    const tBottom = plan.text && !bottomText ? plan.text.y+plan.text.tb.h : 0;
    const mBottom = plan.mark ? plan.mark.y+plan.mark.h : 0;
    // 9:16: a modelo fica fora da coluna de botões do TikTok/Instagram (curtir, comentar, compartilhar) à direita
    plan.box={x0:W*.06, x1: fmt.vertical ? W*(1-SAFE_V.icons-.01) : W*.94, y0:Math.max(H*.05, tBottom+gap, mBottom+gap)};
  } else {
    const colR=W*.44;
    if(textOn){
      if(ms) plan.mark={x:xL, y:yT, w:ms.w, h:ms.h};
      const tb=textBlock(colR-xL,unit,mode);
      let ty = S.layout==="etiqueta"||bottomText ? yB-tb.h : (plan.mark? plan.mark.y+plan.mark.h+gap : yT);
      plan.text={x:xL, y:ty, tb}; plan.textAt = ty>H*.5? "bottom" : "top";
      plan.box={x0:W*.47, x1:W*.97, y0:H*.05};
    } else {
      if(ms) plan.mark={x:xR-ms.w, y:yT, w:ms.w, h:ms.h};
      plan.box={x0:W*.08, x1:W*.92, y0: plan.mark? plan.mark.y+plan.mark.h+gap : H*.06};
    }
  }
  return plan;
}
function subjectLayout(item, W, H, fmt, plan, sForce){
  const b=item.bbox, adj=item.adj;
  const cutAtBottom = (b.y+b.h) >= item.h*.985;
  // nos formatos verticais o corpo inteiro fica acima da área da legenda e do carrinho do TikTok/Instagram,
  // mesmo quando a foto termina colada nos pés (ou é de meio corpo: aí a borda de baixo é esfumada)
  const floorY = fmt.vertical ? H*(1-SAFE_V.b+.015) : H*(fmt.forceScene? .93 : .925);
  const keepUp = !!fmt.vertical || !!(plan&&plan.pairSlot); // 9:16 e frente/costas lado a lado: todos no mesmo chão
  const bottom0 = cutAtBottom && !keepUp ? H : floorY;
  let x0,x1,y0, availH, availW;
  if(fmt.forceScene){ const f=fmt.fill||.84; availH=H*f; availW=W*f; x0=0; x1=W; }
  else { const bx = (plan&&plan.box) || {x0:W*.08,x1:W*.92,y0:H*.08}; x0=bx.x0; x1=bx.x1; y0=bx.y0; availH=(bottom0-y0)*.98; availW=x1-x0; }
  const s = sForce || Math.max(.01,Math.min(availH/b.h, availW/b.w))*(adj.size/100);
  const cx = (x0+x1)/2 + (adj.x/50)*W*(plan&&plan.pairSlot? .1 : .3);
  const bottom = bottom0 + (adj.y/50)*H*.3;
  const x = cx - (b.x + b.w/2)*s, y = bottom - (b.y+b.h)*s;
  // foto que termina nos pés mas mostra o corpo inteiro (bem mais alta que larga): pés firmes, com sombra no chão;
  // só a de meio corpo ganha o esfumado embaixo
  const fullBody = b.h/b.w >= 1.8, standUp = cutAtBottom && keepUp && fullBody;
  return { s, x, y, cutAtBottom: cutAtBottom && !standUp, fadeBottom: cutAtBottom && keepUp && !fullBody, footX:cx, footY:bottom, fw:b.w*s };
}
function drawSubject(ctx, item, W, H, fmt, sceneId, plan, Lgiven){
  const L=Lgiven||subjectLayout(item,W,H,fmt,plan);
  const iw=item.cut.width*L.s, ih=item.cut.height*L.s;
  if(L.fadeBottom){ // meio corpo no 9:16: some suavemente embaixo, em vez de terminar numa linha reta
    const b=item.bbox, t=canvas(Math.max(1,Math.round(iw)),Math.max(1,Math.round(ih))), g=t.getContext("2d");
    g.drawImage(item.cut,0,0,t.width,t.height);
    const yb=(b.y+b.h)*L.s, f=Math.max(4,b.h*L.s*.12), gr=g.createLinearGradient(0,yb-f,0,yb);
    gr.addColorStop(0,"rgba(0,0,0,0)"); gr.addColorStop(1,"rgba(0,0,0,1)");
    g.globalCompositeOperation="destination-out"; g.fillStyle=gr; g.fillRect(0,yb-f,t.width,t.height-(yb-f));
    ctx.save(); ctx.imageSmoothingQuality="high"; ctx.drawImage(t,L.x,L.y,iw,ih); ctx.restore();
    return;
  }
  if(!L.cutAtBottom){ // sombra de contato no chão
    ctx.save(); const rx=L.fw*.42, ry=Math.max(4,H*.012);
    const g=ctx.createRadialGradient(L.footX,L.footY,0,L.footX,L.footY,rx); g.addColorStop(0, sceneId==="white"?"rgba(36,37,63,.16)":"rgba(36,37,63,.24)"); g.addColorStop(1,"rgba(36,37,63,0)");
    ctx.translate(L.footX,L.footY); ctx.scale(1,ry/rx); ctx.translate(-L.footX,-L.footY); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(L.footX,L.footY,rx,0,6.29); ctx.fill(); ctx.restore();
  }
  ctx.save();
  if(sceneId!=="white"){ ctx.shadowColor="rgba(36,37,63,.13)"; ctx.shadowBlur=W*.035; ctx.shadowOffsetX=W*.005; ctx.shadowOffsetY=W*.004; }
  ctx.imageSmoothingQuality="high"; ctx.drawImage(item.cut, L.x, L.y, iw, ih);
  ctx.restore();
  if(scenePhotoOk(sceneId)){ // leve banho de luz quente para a modelo combinar com a foto do ambiente
    const t=canvas(Math.max(1,Math.round(iw)),Math.max(1,Math.round(ih))), g=t.getContext("2d");
    g.drawImage(item.cut,0,0,t.width,t.height); g.globalCompositeOperation="source-atop"; g.fillStyle="rgba(232,205,160,1)"; g.fillRect(0,0,t.width,t.height);
    ctx.save(); ctx.globalAlpha=.07; ctx.globalCompositeOperation="soft-light"; ctx.drawImage(t,L.x,L.y,iw,ih); ctx.restore();
  }
}
function star4(ctx,x,y,s){ ctx.beginPath(); ctx.moveTo(x,y-s); ctx.quadraticCurveTo(x,y,x+s,y); ctx.quadraticCurveTo(x,y,x,y+s); ctx.quadraticCurveTo(x,y,x-s,y); ctx.quadraticCurveTo(x,y,x,y-s); ctx.fill(); }
/* Monograma D&A: selo cheio (marca) ou só o traço translúcido (marca d'água) */
function drawMonogram(ctx,x,y,d,style,tone){
  const cx=x+d/2, cy=y+d/2, r=d/2;
  ctx.save();
  let ink, amp;
  if(style==="mono"){
    ctx.save(); ctx.shadowColor="rgba(20,20,40,.28)"; ctx.shadowBlur=d*.12; ctx.shadowOffsetY=d*.02;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=C.navy; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx,cy,r*.87,0,Math.PI*2); ctx.strokeStyle="rgba(241,232,212,.55)"; ctx.lineWidth=Math.max(1,d*.012); ctx.stroke();
    ink=C.areia; amp=C.gold;
  } else if(style==="word"){ // só as letras, sem círculo
    ink = tone==="light" ? C.deep : C.areia; amp = tone==="light" ? "#A9823F" : C.gold;
    if(tone!=="light"){ ctx.shadowColor="rgba(20,20,40,.45)"; ctx.shadowBlur=d*.06; }
  } else if(style==="wmword"){ // marca d'água só com as letras
    ink = tone==="light" ? C.deep : "#FFFFFF"; amp=ink; ctx.globalAlpha=.55;
  } else {
    ink = tone==="light" ? C.deep : "#FFFFFF"; amp=ink; ctx.globalAlpha=.55;
    ctx.beginPath(); ctx.arc(cx,cy,r*.96,0,Math.PI*2); ctx.strokeStyle=ink; ctx.lineWidth=Math.max(1,d*.02); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,r*.84,0,Math.PI*2); ctx.lineWidth=Math.max(1,d*.008); ctx.stroke();
  }
  const word = style==="word" || style==="wmword";
  ctx.fillStyle = (style==="wm"||style==="wmword") ? ink : amp; star4(ctx,cx,cy-r*(word? .62 : .55),d*(word? .055 : .05));
  const fs=d*(word? .42 : .32); ctx.textBaseline="alphabetic";
  ctx.font=`400 ${fs}px ${F.display}`; const wD=ctx.measureText("D").width, wA=ctx.measureText("A").width;
  ctx.font=`400 ${fs}px ${F.display}`; const wAmp=ctx.measureText("&").width;
  const tot=wD+wAmp+wA+fs*.04, bx=cx-tot/2, by=cy+fs*.33;
  ctx.font=`400 ${fs}px ${F.display}`; ctx.fillStyle=ink; ctx.fillText("D",bx,by); ctx.fillText("A",bx+wD+wAmp+fs*.04,by);
  ctx.font=`400 ${fs}px ${F.display}`; ctx.fillStyle=amp; ctx.fillText("&",bx+wD+fs*.02,by);
  ctx.font=`600 ${d*.062}px ${F.sans}`; ctx.fillStyle=ink; const t="PIJAMAS", sp=d*.062*.22, tw=spacedWidth(ctx,t,sp); spaced(ctx,t,cx-tw/2,cy+r*(word? .66 : .58),sp);
  ctx.restore();
}
function drawMark(ctx,W,plan,tone,alpha){
  const m=plan.mark; if(!m) return;
  ctx.save(); ctx.globalAlpha=alpha;
  if(S.mark==="logo"){
    if(logoImg.complete && logoImg.naturalWidth){
      ctx.save(); ctx.shadowColor="rgba(20,20,40,.25)"; ctx.shadowBlur=W*.02; ctx.shadowOffsetY=W*.004;
      roundRect(ctx,m.x,m.y,m.w,m.h,m.w*.09); ctx.fillStyle=C.navy; ctx.fill(); ctx.restore();
      ctx.save(); roundRect(ctx,m.x,m.y,m.w,m.h,m.w*.09); ctx.clip(); ctx.drawImage(logoImg,m.x,m.y,m.w,m.h); ctx.restore();
      roundRect(ctx,m.x,m.y,m.w,m.h,m.w*.09); ctx.strokeStyle="rgba(241,232,212,.55)"; ctx.lineWidth=Math.max(1,W*.0018); ctx.stroke();
    }
  } else drawMonogram(ctx,m.x,m.y,m.w,S.mark,tone);
  ctx.restore();
}
/* véu claro atrás do texto quando o cenário é uma foto clara (mantém o texto legível sobre sombras e objetos) */
function lightVeil(ctx,W,H,plan){
  if(!plan.text || S.layout!=="editorial") return;
  const t=plan.text, pad=plan.unit*.06, x0=Math.max(0,t.x-pad), y0=Math.max(0,t.y-pad), x1=Math.min(W,t.x+t.tb.w+pad), y1=Math.min(H,t.y+t.tb.h+pad);
  const cx=(x0+x1)/2, cy=(y0+y1)/2, rx=(x1-x0)*.75, ry=(y1-y0)*.85;
  ctx.save(); ctx.translate(cx,cy); ctx.scale(1,ry/rx);
  const g=ctx.createRadialGradient(0,0,rx*.25,0,0,rx); g.addColorStop(0,"rgba(247,241,231,.82)"); g.addColorStop(.6,"rgba(247,241,231,.55)"); g.addColorStop(1,"rgba(247,241,231,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,rx,0,Math.PI*2); ctx.fill(); ctx.restore();
}
/* céu da marca: apaga as estrelas atrás do texto e da marca (o céu é azul liso, então basta pintar por cima com borda suave) */
function clearSky(ctx,plan){
  const pad=plan.unit*.03, boxes=[];
  if(plan.text) boxes.push([plan.text.x,plan.text.y,plan.text.tb.w,plan.text.tb.h]);
  if(plan.mark) boxes.push([plan.mark.x,plan.mark.y,plan.mark.w,plan.mark.h]);
  if(!boxes.length) return;
  ctx.save(); ctx.fillStyle=C.navy; ctx.shadowColor=C.navy; ctx.shadowBlur=pad;
  for(const [x,y,w,h] of boxes) ctx.fillRect(x-pad,y-pad,w+pad*2,h+pad*2);
  ctx.restore();
}
function scrim(ctx,W,H,plan){
  if(!plan.text || S.layout!=="editorial") return;
  let g;
  if(plan.mode==="side"){ g=ctx.createLinearGradient(0,0,W*.62,0); g.addColorStop(0,"rgba(30,31,56,.62)"); g.addColorStop(1,"rgba(30,31,56,0)"); ctx.fillStyle=g; ctx.fillRect(0,0,W*.62,H); return; }
  if(plan.textAt==="bottom"){ g=ctx.createLinearGradient(0,H*.5,0,H); g.addColorStop(0,"rgba(30,31,56,0)"); g.addColorStop(1,"rgba(30,31,56,.7)"); ctx.fillStyle=g; ctx.fillRect(0,H*.5,W,H*.5); }
  else { g=ctx.createLinearGradient(0,0,0,H*.5); g.addColorStop(0,"rgba(30,31,56,.65)"); g.addColorStop(1,"rgba(30,31,56,0)"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H*.5); }
}
function drawEndCard(ctx,W,H,fmt,k){
  if(k<=0) return;
  ctx.save(); ctx.globalAlpha=Math.min(1,k)*.92; ctx.fillStyle=C.deep; ctx.fillRect(0,0,W,H); ctx.globalAlpha=Math.min(1,k);
  const unit=Math.min(W,H*.8), lw=unit*.46, lh=lw*(logoImg.naturalHeight||337)/(logoImg.naturalWidth||360);
  const cy=H*.42;
  // estrelas só fora da coluna central, onde ficam logo, nome, preço e botão
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,H); ctx.rect(W*.08,cy-lh/2-unit*.04,W*.84,lh+unit*.42); ctx.clip("evenodd");
  drawStars(ctx,W,H,H*.9,9); ctx.restore(); if(logoImg.naturalWidth){ ctx.save(); roundRect(ctx,(W-lw)/2,cy-lh/2,lw,lh,lw*.08); ctx.clip(); ctx.drawImage(logoImg,(W-lw)/2,cy-lh/2,lw,lh); ctx.restore(); }
  ctx.textAlign="center"; let y=cy+lh/2+unit*.1;
  if(S.P.name){ ctx.font=`300 ${unit*.06}px ${F.display}`; ctx.fillStyle=C.areia; ctx.fillText(wrap(ctx,S.P.name,W*.8,1)[0],W/2,y); y+=unit*.075; }
  const pr=money(S.P.price); if(pr){ ctx.font=`500 ${unit*.046}px ${F.sans}`; ctx.fillStyle=C.gold; ctx.fillText(pr,W/2,y); y+=unit*.08; }
  if(S.P.cta){ ctx.font=`500 ${unit*.028}px ${F.sans}`; const t=S.P.cta.toUpperCase(), sp=unit*.028*.06, tw=spacedWidth(ctx,t,sp), ph=unit*.078, pw=tw+unit*.09;
    roundRect(ctx,(W-pw)/2,y,pw,ph,ph/2); ctx.fillStyle=C.areia; ctx.fill(); ctx.fillStyle=C.deep; ctx.textAlign="left"; spaced(ctx,t,(W-tw)/2,y+ph/2+unit*.01,sp); }
  ctx.restore();
}
