"use strict";
/* ============ Frente e costas: duas fotos da mesma peça lado a lado ============ */
function backOf(item){ const b=item.pair; return (b && b!==item && S.items.includes(b) && b.kind==="photo") ? b : null; }
function isBackOfAnother(it){ return S.items.some(o=>o!==it && o.pair===it && o.kind==="photo"); }
/* o que a tela mostra: com a foto de costas aberta, mostra a peça inteira (a frente com as costas ao lado) */
function viewItem(){ const it=S.sel; if(it && it.kind==="photo"){ const f=S.items.find(o=>o!==it && o.pair===it && o.kind==="photo"); if(f) return f; } return it; }
function pairSlots(W,H,fmt,plan){
  const unit=Math.min(W,H*.8), lab=S.pairLabels? unit*.055 : 0;
  const box = fmt.forceScene ? {x0:W*.05,x1:W*.95,y0:H*.07} : (plan.box||{x0:W*.06,x1:W*.94,y0:H*.06});
  const gap=W*.025, mid=(box.x0+box.x1)/2;
  return { unit, lab,
    a:{x0:box.x0, x1:mid-gap/2, y0:box.y0+lab},
    b:{x0:mid+gap/2, x1:box.x1, y0:box.y0+lab} };
}
function drawPairLabels(ctx,P,tone,ya,yb){
  if(!S.pairLabels) return;
  const fs=P.unit*.024, sp=fs*.22;
  ctx.save(); ctx.font=`600 ${fs}px ${F.sans}`; ctx.fillStyle = tone==="light" ? "rgba(36,37,63,.72)" : "rgba(241,232,212,.9)";
  for(const [t,sl,y] of [["FRENTE",P.a,ya],["COSTAS",P.b,yb]]){ const w=spacedWidth(ctx,t,sp), cx=(sl.x0+sl.x1)/2;
    if(tone==="night"){ ctx.save(); ctx.fillStyle=C.navy; ctx.shadowColor=C.navy; ctx.shadowBlur=fs; ctx.fillRect(cx-w/2-fs*.6,y-fs*1.2,w+fs*1.2,fs*1.7); ctx.restore(); } // sem estrela em cima da palavra
    spaced(ctx,t,cx-w/2,y,sp); }
  ctx.restore();
}
function drawSubjectPair(ctx,front,back,W,H,fmt,scene,plan,tone){
  const P=pairSlots(W,H,fmt,plan), f2={...fmt, forceScene:null};
  const La=subjectLayout(front,W,H,f2,{box:P.a,pairSlot:true}), Lb=subjectLayout(back,W,H,f2,{box:P.b,pairSlot:true});
  const sa=La.s/(front.adj.size/100), sb=Lb.s/(back.adj.size/100);
  // mesma escala nas duas fotos, para a peça ter o mesmo tamanho de frente e de costas
  const ha=front.bbox.h*sa, hb=back.bbox.h*sb, hh=Math.min(ha,hb);
  const A=subjectLayout(front,W,H,f2,{box:P.a,pairSlot:true}, hh/front.bbox.h*(front.adj.size/100));
  const B=subjectLayout(back,W,H,f2,{box:P.b,pairSlot:true}, hh/back.bbox.h*(back.adj.size/100));
  drawSubject(ctx,front,W,H,f2,scene,null,A); drawSubject(ctx,back,W,H,f2,scene,null,B);
  const ya=Math.max(P.a.y0-P.lab*.35, A.y+front.bbox.y*A.s-P.lab*.35), yb=Math.max(P.b.y0-P.lab*.35, B.y+back.bbox.y*B.s-P.lab*.35);
  drawPairLabels(ctx,P,tone,ya,yb);
}
function drawPhotoPair(ctx,front,back,W,H,fmt,plan){
  // sem recorte: tela dividida em duas colunas, cada foto encaixada inteira na sua
  fillEdges(ctx,front.src,front.w,front.h,W,H);
  const P=pairSlots(W,H,fmt,{box:plan.box||{x0:0,x1:W,y0:0}});
  const x0=Math.max(0,P.a.x0-W*.02), x1=Math.min(W,P.b.x1+W*.02), mid=(P.a.x1+P.b.x0)/2;
  for(const [it,c0,c1] of [[front,x0,mid],[back,mid,x1]]){
    const cw=c1-c0; ctx.save(); ctx.beginPath(); ctx.rect(c0,0,cw,H); ctx.clip(); ctx.translate(c0,0);
    const reg = it.bbox ? {x0:cw*.04,x1:cw*.96,y0:(plan.box?plan.box.y0:H*.06)+P.lab, y1: fmt.vertical? H*(1-SAFE_V.b+.015) : H*.96, keepUp:!!fmt.vertical} : null;
    drawFit(ctx,it.src,it.w,it.h,cw,H,it.adj,it.bbox,reg); ctx.restore();
  }
  ctx.fillStyle="rgba(241,232,212,.9)"; ctx.fillRect(mid-Math.max(1,W*.002),0,Math.max(2,W*.004),H);
  drawPairLabels(ctx,P,"photo",(plan.box?plan.box.y0:H*.06)+P.lab*.6,(plan.box?plan.box.y0:H*.06)+P.lab*.6);
}

/* Desenha um formato inteiro. t/endAt só valem para vídeo.
   opt (só fotos): part "base" = cenário e modelo, "overlay" = só texto e marca (a montagem anima a base
   e mantém o texto parado); single = ignora a foto de costas ligada a esta. */
function renderFormat(ctx, W, H, item, fmt, t, endAt, opt){
  opt=opt||{};
  ctx.save(); ctx.clearRect(0,0,W,H);
  const plan=planArt(W,H,fmt,item.kind==="video");
  let tone="photo", warn=null;
  if(item.kind==="video"){
    drawFit(ctx,item.el,item.w,item.h,W,H,item.adj,null);
    scrim(ctx,W,H,plan);
    const fade = t==null||opt.noFade ? 1 : Math.min(1,Math.max(0,(t-(item.trim||0))/.5));
    const k = (S.endCard && endAt!=null && t!=null) ? Math.min(1,Math.max(0,(t-(endAt-1.6))/.5)) : 0;
    if(plan.text) plan.text.tb.draw(ctx,plan.text.x,plan.text.y,"photo",fade*(1-k));
    if(k<1) drawMark(ctx,W,plan,"photo",1-k);
    if(k>0) drawEndCard(ctx,W,H,fmt,k);
    ctx.restore(); return null;
  }
  const scene = fmt.forceScene || S.scene;
  const back = opt.single ? null : backOf(item);
  const cutScene = scene!=="original" && item.cut;
  tone = cutScene && scene!=="custom" ? sceneTone(scene) : "photo";
  if(opt.part!=="overlay"){
    if(cutScene){
      ctx.drawImage(sceneCanvas(scene,W,H),0,0);
      if(scene==="night") clearSky(ctx,plan);
      if(back && back.cut) drawSubjectPair(ctx,item,back,W,H,fmt,scene,plan,tone);
      else { drawSubject(ctx,item,W,H,fmt,scene,plan); if(back) warn="Recortando a foto de costas…"; }
      if(scene==="custom") scrim(ctx,W,H,plan);
      else if(scenePhotoOk(scene)) lightVeil(ctx,W,H,plan);
    } else if(back){
      drawPhotoPair(ctx,item,back,W,H,fmt,plan); scrim(ctx,W,H,plan);
    } else {
      const region = (item.bbox && plan.box && !fmt.forceScene) ? {x0:plan.box.x0, x1:plan.box.x1, y0:plan.box.y0, y1: fmt.vertical? H*(1-SAFE_V.b+.015) : H*.96, keepUp:!!fmt.vertical} : null;
      drawFit(ctx,item.src,item.w,item.h,W,H,item.adj,item.bbox,region);
      scrim(ctx,W,H,plan);
      if(scene!=="original") warn = item.cutState==="error" ? "Sem recorte nesta foto: o fundo original foi mantido." : "Recortando a modelo para trocar o fundo…";
    }
  }
  if(opt.part!=="base"){
    if(plan.text) plan.text.tb.draw(ctx,plan.text.x,plan.text.y,tone,1);
    drawMark(ctx,W,plan,tone,1);
  }
  ctx.restore();
  return warn;
}
