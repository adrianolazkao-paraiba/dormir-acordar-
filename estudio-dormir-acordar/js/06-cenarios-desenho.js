"use strict";
/* ============ Fundos ============ */
const sceneCache = new Map();
/* ---- luz e acabamento comuns ---- */
function light(ctx,x,y,r,color,alpha,mode){
  ctx.save(); ctx.globalCompositeOperation=mode||"source-over";
  const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,color.replace("A",alpha)); g.addColorStop(1,color.replace("A",0));
  ctx.fillStyle=g; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.restore();
}
function vignette(ctx,W,H,a){
  const g=ctx.createRadialGradient(W*.5,H*.48,Math.min(W,H)*.35,W*.5,H*.5,Math.hypot(W,H)*.62);
  g.addColorStop(0,"rgba(50,38,25,0)"); g.addColorStop(1,`rgba(50,38,25,${a})`); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
/* Fundo infinito de estúdio (parede curva que vira chão), iluminado por uma luz principal suave do alto à esquerda */
function cyclorama(ctx,W,H,p){
  const hz=p.horizon;
  let g=ctx.createLinearGradient(0,0,0,H*hz);
  g.addColorStop(0,p.wallTop); g.addColorStop(1,p.wallLow);
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // curva: faixa clara onde a parede vira chão
  g=ctx.createLinearGradient(0,H*(hz-.10),0,H*(hz+.08));
  g.addColorStop(0,p.wallLow); g.addColorStop(.55,p.cove); g.addColorStop(1,p.floorTop);
  ctx.fillStyle=g; ctx.fillRect(0,H*(hz-.10),W,H*.18+1);
  g=ctx.createLinearGradient(0,H*(hz+.08),0,H);
  g.addColorStop(0,p.floorTop); g.addColorStop(1,p.floorBot);
  ctx.fillStyle=g; ctx.fillRect(0,H*(hz+.08),W,H*(1-hz-.08)+1);
  light(ctx,W*.22,H*.18,Math.max(W,H)*.75,"rgba(255,250,238,A)",.42);          // luz principal
  light(ctx,W*.55,H*(hz+.12),W*.55,"rgba(255,248,232,A)",.28);                  // poça de luz no chão
  light(ctx,W*1.05,H*.55,W*.7,"rgba(70,55,40,A)",.12);                           // queda de luz à direita
  vignette(ctx,W,H,.22);
  addGrain(ctx,W,H,.045);
}
function drawStars(ctx,W,H,maxY,seed){
  // estrelas como no logo: pontos pequenos e estrelas de quatro pontas finas, em três tamanhos,
  // mais densas no alto e com um respiro no centro
  const r=rng(seed), n=Math.round(58*(W*maxY)/(1080*1080));
  const placed=[];
  for(let i=0,tries=0;i<n && tries<n*12;tries++){
    const x=r()*W, y=Math.pow(r(),1.25)*maxY;
    const cx=Math.abs(x/W-.5), cy=y/maxY; if(cx<.22 && cy>.3 && cy<.8 && r()<.8) continue;
    if(placed.some(([px,py])=>Math.hypot(px-x,py-y)<W*.035)) continue;
    placed.push([x,y]); i++;
    const k=r(); ctx.fillStyle=`rgba(251,248,242,${.78+r()*.22})`;
    if(k<.45){ ctx.beginPath(); ctx.arc(x,y,W*(.0016+r()*.0014),0,Math.PI*2); ctx.fill(); }
    else {
      const s=W*(k<.80? .007+r()*.003 : .014+r()*.005), t=s*.16;
      ctx.beginPath(); ctx.moveTo(x,y-s);
      ctx.quadraticCurveTo(x+t,y-t,x+s,y); ctx.quadraticCurveTo(x+t,y+t,x,y+s);
      ctx.quadraticCurveTo(x-t,y+t,x-s,y); ctx.quadraticCurveTo(x-t,y-t,x,y-s); ctx.fill();
    }
  }
}
function paintScene(ctx,W,H,id){
  if(id==="white"){ ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,W,H); return; }
  if(id==="loading"){ const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#E9E0CF"); g.addColorStop(1,"#D9CCB4"); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); return; }
  if(id==="studio"){ cyclorama(ctx,W,H,{horizon:.70,wallTop:"#DCCFB8",wallLow:"#EADFCC",cove:"#F1E8D8",floorTop:"#E8DCC7",floorBot:"#D3C2A5"}); return; }
  if(id==="sage"){ cyclorama(ctx,W,H,{horizon:.70,wallTop:"#B7BC9F",wallLow:"#CACDB6",cove:"#D6D8C4",floorTop:"#C9CBB2",floorBot:"#A9AE90"}); return; }
  if(id==="rose"){ cyclorama(ctx,W,H,{horizon:.70,wallTop:"#DFC3B7",wallLow:"#EDD8CE",cove:"#F3E3DB",floorTop:"#EAD3C8",floorBot:"#D4B4A6"}); return; }
  if(id==="window"){
    cyclorama(ctx,W,H,{horizon:.72,wallTop:"#D2C3AA",wallLow:"#DCCEB6",cove:"#E3D6C0",floorTop:"#DACBB2",floorBot:"#C6B293"});
    // sol da tarde entrando por uma janela de folhas duplas: luz quente na parede e no chão
    const pw=W*.15, ph=H*.20, gap=W*.018, sk=W*.10, x0=W*.06, y0=H*.05;
    const panes=[]; for(let r=0;r<3;r++) for(let c=0;c<2;c++) panes.push([x0+c*(pw+gap)+r*sk*.55, y0+r*(ph*.62+gap)]);
    const paneH=ph*.58;
    ctx.save(); ctx.globalCompositeOperation="screen";
    softShape(ctx,g=>{ g.beginPath(); for(const [x,y] of panes){ g.moveTo(x,y); g.lineTo(x+pw,y); g.lineTo(x+pw+sk*.5,y+paneH); g.lineTo(x+sk*.5,y+paneH); g.closePath(); } },"rgba(255,226,170,.55)",W*.010);
    softShape(ctx,g=>{ g.beginPath(); for(const [x,y] of panes){ g.moveTo(x,y); g.lineTo(x+pw,y); g.lineTo(x+pw+sk*.5,y+paneH); g.lineTo(x+sk*.5,y+paneH); g.closePath(); } },"rgba(255,236,200,.35)",W*.035);
    // continuação da luz no chão
    softShape(ctx,g=>{ g.beginPath(); g.moveTo(W*.30,H*.80); g.lineTo(W*.72,H*.78); g.lineTo(W*1.02,H*1.0); g.lineTo(W*.42,H*1.02); g.closePath(); },"rgba(255,230,185,.40)",W*.03);
    ctx.restore();
    // sombra de um ramo de oliveira no canto direito
    const r=rng(21);
    softShape(ctx,g=>{ g.beginPath();
      for(let b=0;b<3;b++){ const bx=W*(.80+b*.06), by=H*(.08+b*.05), len=H*(.30+r()*.12), ang=1.9+b*.12;
        for(let i=0;i<14;i++){ const t=i/14, px=bx+Math.cos(ang)*len*t, py=by+Math.sin(ang)*len*t, side=i%2?1:-1, la=ang+side*(.75+r()*.3), ll=W*(.035+r()*.02);
          const ex=px+Math.cos(la)*ll, ey=py+Math.sin(la)*ll;
          g.moveTo(px,py); g.quadraticCurveTo(px+Math.cos(la+.4)*ll*.5,py+Math.sin(la+.4)*ll*.5,ex,ey); g.quadraticCurveTo(px+Math.cos(la-.4)*ll*.5,py+Math.sin(la-.4)*ll*.5,px,py); }
        g.moveTo(bx,by); g.lineTo(bx+Math.cos(ang)*len,by+Math.sin(ang)*len+2); g.lineTo(bx+3,by); }
    },"rgba(80,60,40,.16)",W*.012);
    vignette(ctx,W,H,.18); addGrain(ctx,W,H,.045); return;
  }
  if(id==="linen"){
    // cortina de linho cru até o chão, com luz atravessando por trás
    const floorY=H*.86;
    const r=rng(11), waves=[]; for(let i=0;i<9;i++) waves.push([W*(.025+r()*.05), r()*Math.PI*2, .5+r()*.6]);
    for(let x=0;x<W;x+=2){
      let v=0; for(const [len,ph,a] of waves) v+=Math.sin(x/len+ph)*a; v/=waves.length;
      const back = 1 - Math.pow(Math.abs(x/W-.5)*1.6,2)*.35;
      const l=Math.max(0,Math.min(1,.60+v*.95))*back;
      const R=Math.round(196+52*l), G=Math.round(184+50*l), B=Math.round(160+46*l);
      ctx.fillStyle=`rgb(${R},${G},${B})`; ctx.fillRect(x,0,2,floorY+H*.01);
    }
    // trama do tecido
    ctx.save(); ctx.globalAlpha=.06; ctx.strokeStyle="#5A4A35"; ctx.lineWidth=Math.max(1,W/1400);
    const st=W/300; for(let y=0;y<floorY;y+=st*(.8+r()*.5)){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y+(r()-.5)*st); ctx.stroke(); }
    ctx.restore();
    light(ctx,W*.5,H*.35,Math.max(W,H)*.6,"rgba(255,248,230,A)",.30);
    // barra da cortina tocando o chão e piso claro de madeira
    let g=ctx.createLinearGradient(0,floorY,0,H); g.addColorStop(0,"#CDB89A"); g.addColorStop(1,"#B49B78"); ctx.fillStyle=g; ctx.fillRect(0,floorY,W,H-floorY);
    ctx.save(); ctx.globalAlpha=.10; ctx.strokeStyle="#5A4528"; ctx.lineWidth=Math.max(1,W/700);
    for(let i=1;i<6;i++){ const y=floorY+(H-floorY)*Math.pow(i/6,1.4); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();
    g=ctx.createLinearGradient(0,floorY-H*.02,0,floorY+H*.03); g.addColorStop(0,"rgba(60,45,30,0)"); g.addColorStop(.5,"rgba(60,45,30,.18)"); g.addColorStop(1,"rgba(60,45,30,0)"); ctx.fillStyle=g; ctx.fillRect(0,floorY-H*.02,W,H*.05);
    vignette(ctx,W,H,.20); addGrain(ctx,W,H,.045); return;
  }
  if(id==="paris"){
    // apartamento parisiense: parede creme com boiserie e piso de madeira em perspectiva
    const floorY=H*.76;
    let g=ctx.createLinearGradient(0,0,0,floorY); g.addColorStop(0,"#E6DCCB"); g.addColorStop(1,"#EFE7D9"); ctx.fillStyle=g; ctx.fillRect(0,0,W,floorY);
    const relief=(x,y,w,h,d)=>{ // moldura em relevo: luz em cima/esquerda, sombra embaixo/direita
      ctx.lineWidth=Math.max(1.5,W*.003);
      ctx.strokeStyle="rgba(255,252,244,.85)"; ctx.beginPath(); ctx.moveTo(x,y+h); ctx.lineTo(x,y); ctx.lineTo(x+w,y); ctx.stroke();
      ctx.strokeStyle="rgba(120,100,75,.35)"; ctx.beginPath(); ctx.moveTo(x+w,y); ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.stroke();
      ctx.strokeStyle="rgba(120,100,75,.30)"; ctx.beginPath(); ctx.moveTo(x+d,y+h-d); ctx.lineTo(x+d,y+d); ctx.lineTo(x+w-d,y+d); ctx.stroke();
      ctx.strokeStyle="rgba(255,252,244,.8)"; ctx.beginPath(); ctx.moveTo(x+w-d,y+d); ctx.lineTo(x+w-d,y+h-d); ctx.lineTo(x+d,y+h-d); ctx.stroke();
    };
    const d=W*.012, top=H*.10, ph=floorY-H*.10-top-H*.22;
    relief(W*.07,top,W*.38,ph,d); relief(W*.55,top,W*.38,ph,d);
    relief(W*.07,top+ph+H*.035,W*.38,H*.16,d); relief(W*.55,top+ph+H*.035,W*.38,H*.16,d);
    // rodapé
    g=ctx.createLinearGradient(0,floorY-H*.045,0,floorY); g.addColorStop(0,"#F3ECE0"); g.addColorStop(.15,"#E4D9C6"); g.addColorStop(1,"#D9CCB6"); ctx.fillStyle=g; ctx.fillRect(0,floorY-H*.045,W,H*.045);
    ctx.fillStyle="rgba(255,252,244,.8)"; ctx.fillRect(0,floorY-H*.045,W,Math.max(1,H*.002));
    // piso de carvalho
    g=ctx.createLinearGradient(0,floorY,0,H); g.addColorStop(0,"#C4A47C"); g.addColorStop(1,"#A9865D"); ctx.fillStyle=g; ctx.fillRect(0,floorY,W,H-floorY);
    const vx=W*.5, vy=floorY-H*.9;
    ctx.save(); ctx.beginPath(); ctx.rect(0,floorY,W,H-floorY); ctx.clip();
    ctx.strokeStyle="rgba(70,50,30,.18)"; ctx.lineWidth=Math.max(1,W/900);
    for(let i=-14;i<=14;i++){ const bx=vx+i*W*.12; ctx.beginPath(); ctx.moveTo(vx+(bx-vx)*((floorY-vy)/(H-vy)),floorY); ctx.lineTo(bx,H); ctx.stroke(); }
    const r=rng(4); ctx.strokeStyle="rgba(70,50,30,.10)";
    for(let i=0;i<40;i++){ const t=r(), y=floorY+(H-floorY)*t*t, x=r()*W; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+W*.04,y); ctx.stroke(); }
    ctx.restore();
    light(ctx,W*.5,H*.62,W*.75,"rgba(255,246,228,A)",.35);
    light(ctx,W*.15,H*.1,W*.8,"rgba(255,250,238,A)",.25);
    vignette(ctx,W,H,.24); addGrain(ctx,W,H,.045); return;
  }
  if(id==="night"){
    // cenário da marca: igual ao logo, céu azul-noite com estrelas e horizonte curvo em areia
    ctx.fillStyle=C.navy; ctx.fillRect(0,0,W,H);
    const hy=H*.80, peak=H*.745; drawStars(ctx,W,H,hy-H*.03,3);
    ctx.beginPath(); ctx.moveTo(0,hy); ctx.quadraticCurveTo(W*.5,peak-(hy-peak),W,hy); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
    ctx.fillStyle=C.areia; ctx.fill();
    return;
  }
  ctx.fillStyle="#EFE6D5"; ctx.fillRect(0,0,W,H);
}
function sceneCanvas(id,W,H){
  if(id==="custom") return customSceneCanvas(W,H);
  const k=id+":"+W+"x"+H; if(sceneCache.has(k)) return sceneCache.get(k);
  const p=scenePhoto(id);
  if(p && !p.ok){ const c=canvas(W,H), g=c.getContext("2d"); paintScene(g,W,H, p.failed? "studio" : "loading"); return c; } // não guarda: troca quando a foto chegar
  const c=canvas(W,H); if(p) paintPhotoScene(c.getContext("2d"),W,H,p); else paintScene(c.getContext("2d"),W,H,id);
  if(sceneCache.size>40) sceneCache.delete(sceneCache.keys().next().value);
  sceneCache.set(k,c); return c;
}
function customSceneCanvas(W,H){
  const k="custom:"+W+"x"+H+":"+(S.customBg?S.customBg.v:0); if(sceneCache.has(k)) return sceneCache.get(k);
  const c=canvas(W,H), g=c.getContext("2d");
  if(!S.customBg){ paintScene(g,W,H,"studio"); return c; }
  const im=S.customBg.img, s=Math.max(W/im.width,H/im.height);
  // foto de ambiente: encaixa pela base, para o chão continuar onde a modelo pisa
  const tmp=canvas(W,H); tmp.getContext("2d").drawImage(im,(W-im.width*s)/2,H-im.height*s,im.width*s,im.height*s);
  g.drawImage(blurCopy(tmp,W,H,1.8),0,0); // desfoque leve, como profundidade de campo de lente
  sceneCache.set(k,c); return c;
}
function scenePhotoOk(id){ const p=photoImgs[id]; return !!(p&&p.ok); }
function sceneTone(id){ if(id==="night") return "night"; return (SCENES.find(s=>s.id===id)||{tone:"light"}).tone; }
