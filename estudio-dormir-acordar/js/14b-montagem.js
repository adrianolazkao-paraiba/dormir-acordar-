"use strict";
/* ============ Montagem: vídeo + foto de frente + foto de costas num vídeo só ============
   Ordem: o vídeo (a partir de "Começar em"), depois a frente e as costas (3 s cada, com zoom lento),
   e o cartão da marca no fim se estiver ligado. Cenário, marca e estilo de texto são os mesmos das fotos.
   No TikTok Shop o total fica em até 15 s: a parte do vídeo é encurtada. */
const MONT = { front:null, back:null, PHOTO:3, END:2, XF:.4 };

/* fotos escolhidas: a de frente (ou a primeira que tenha costas ligada, ou a primeira) e a de costas */
function montagePhotos(){
  const list=S.items.filter(i=>i.kind==="photo" && !i.example);
  const front=list.find(p=>p.id===MONT.front) || list.find(p=>backOf(p)) || list[0] || null;
  let back=null;
  if(MONT.back!=="none") back=list.find(p=>p.id===MONT.back && p!==front) || (front&&backOf(front)) || list.find(p=>p!==front) || null;
  return { list, front, back };
}
function montagePlan(it, fmt){
  const {front, back}=montagePhotos(), segs=[];
  if(front) segs.push({k:"photo", item:front, d:MONT.PHOTO});
  if(back) segs.push({k:"photo", item:back, d:MONT.PHOTO});
  if(S.endCard) segs.push({k:"end", d:MONT.END});
  const tail=segs.reduce((a,s)=>a+s.d,0), start=it.trim||0;
  let vlen=Math.max(0,it.dur-start); if(fmt.maxDur) vlen=Math.max(1,Math.min(vlen,fmt.maxDur-tail));
  return { segs, start, vEnd:start+vlen, vlen, tail, total:vlen+tail };
}
/* foto pronta em duas camadas: base (cenário + modelo, que ganha zoom) e texto/marca (parados) */
function photoLayers(item, fmt, W, H){
  W=W||fmt.w; H=H||fmt.h;
  const base=canvas(W,H), over=canvas(W,H);
  renderFormat(base.getContext("2d"),W,H,item,fmt,null,null,{part:"base",single:true});
  renderFormat(over.getContext("2d"),W,H,item,fmt,null,null,{part:"overlay",single:true});
  return { base, over };
}
function drawPhotoFrame(ctx,W,H,L,u,d){
  const z=1+.045*Math.min(1,u/d), ax=W/2, ay=H*.58;
  ctx.save(); ctx.clearRect(0,0,W,H); ctx.translate(ax,ay); ctx.scale(z,z); ctx.translate(-ax,-ay);
  ctx.imageSmoothingQuality="medium"; ctx.drawImage(L.base,0,0,W,H); ctx.restore();
  ctx.drawImage(L.over,0,0,W,H);
}
/* desenha a parte depois do vídeo no tempo tau (s); devolve false quando terminou */
function drawTail(j, tau){
  const {segs}=j.plan, W=j.c.width, H=j.c.height; let acc=0, idx=-1, u=0;
  for(let i=0;i<segs.length;i++){ if(tau<acc+segs[i].d){ idx=i; u=tau-acc; break; } acc+=segs[i].d; }
  if(idx<0) return false;
  if(idx!==j.seg){ const p=j.prev.getContext("2d"); p.clearRect(0,0,W,H); p.drawImage(j.c,0,0); j.seg=idx; } // último quadro da parte anterior
  const s=segs[idx], ctx=j.ctx;
  if(s.k==="photo"){
    drawPhotoFrame(ctx,W,H,s.L,u,s.d);
    if(u<MONT.XF){ ctx.save(); ctx.globalAlpha=1-u/MONT.XF; ctx.drawImage(j.prev,0,0); ctx.restore(); } // transição suave
  } else {
    ctx.clearRect(0,0,W,H); ctx.drawImage(j.prev,0,0); drawEndCard(ctx,W,H,j.fmt,Math.min(1,u/.5));
  }
  return true;
}

/* grava um formato: o vídeo tocando e depois as fotos, em tempo real */
async function recordMontage(it, j, audioTrack, mime, onProg){
  const v=it.el, {plan}=j, W=j.fmt.w, H=j.fmt.h;
  const stream=j.c.captureStream(30); if(audioTrack) stream.addTrack(audioTrack.clone());
  const rec=new MediaRecorder(stream, Object.assign({videoBitsPerSecond:9_000_000, audioBitsPerSecond:160_000}, mime?{mimeType:mime}:{}));
  const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
  const done=new Promise(r=>rec.onstop=()=>r(new Blob(chunks,{type:(rec.mimeType||mime||"video/webm").split(";")[0]})));
  v.loop=false; v.muted=!audioTrack; v.volume=1;
  await new Promise(r=>{ const t=setTimeout(()=>{ v.onseeked=null; r(); },1500); v.onseeked=()=>{ clearTimeout(t); v.onseeked=null; r(); }; v.currentTime=plan.start; });
  renderFormat(j.ctx,W,H,it,j.fmt,plan.start,null);
  rec.start(1000);
  let phase="video", t0=0; const tStart=performance.now();
  await v.play();
  await new Promise(resolve=>{
    const step=()=>{
      const now=performance.now(), tv=v.currentTime;
      if(phase==="video"){
        if(tv<plan.vEnd-.02 && !v.ended) renderFormat(j.ctx,W,H,it,j.fmt,tv,null);
        else { phase="tail"; t0=now; v.pause(); } // o som do vídeo termina junto com ele
      }
      if(phase==="tail" && !drawTail(j,(now-t0)/1000)){ resolve(); return; }
      onProg(Math.min(1,(now-tStart)/1000/plan.total)); $("time").textContent=fmtTime(tv)+" / "+fmtTime(it.dur)+" s";
      requestAnimationFrame(step);
    };
    step();
  });
  rec.stop(); stream.getTracks().forEach(tr=>tr.stop());
  v.pause(); v.muted=true;
  const blob=await done; blob.recMime=rec.mimeType||mime; return blob;
}

async function makeMontage(it){
  if(S.busy || !it || it.kind!=="video") return;
  if(!montagePhotos().front){ toast("Envie a foto de frente e a de costas da peça no passo 1."); return; }
  const fmts=FORMATS.filter(f=>f.media.includes("video")&&S.include.has(f.id)); if(!fmts.length) return;
  const mime=pickMime(); if(mime===null){ toast("Este navegador não grava vídeo. Use Chrome, Edge ou Safari atualizado."); return; }
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  stopPlayback(); S.busy=true; renderDock(); renderMontage(); progress(0);
  const v=it.el, box=$("mResults"); box.innerHTML="";
  try{
    const {front, back}=montagePhotos();
    if(S.scene!=="original"){ // as fotos precisam estar recortadas para entrar no cenário
      const pend=[front,back].filter(p=>p && !p.cut && p.cutState!=="error");
      if(pend.length){ toast("Terminando os recortes das fotos…"); pend.forEach(queueCut); await cutQueue; }
    }
    const audioTrack=await videoAudioTrack(it);
    // um formato de cada vez: gravar 3 vídeos em alta resolução ao mesmo tempo engasga o celular
    // (no zoom das fotos todos os pontos mudam a cada quadro, o que pesa para o codificador)
    const plans=fmts.map(f=>montagePlan(it,f)), sum=plans.reduce((a,p)=>a+p.total,0), out=[];
    let before=0, recMime="";
    for(const [k,fmt] of fmts.entries()){
      const plan=plans[k];
      for(const s of plan.segs) if(s.k==="photo") s.L=photoLayers(s.item,fmt);
      const c=canvas(fmt.w,fmt.h), j={fmt,c,ctx:c.getContext("2d"),plan,seg:-1,prev:canvas(fmt.w,fmt.h)};
      $("makeMontage").textContent=`Gravando ${k+1} de ${fmts.length}…`;
      const blob=await recordMontage(it,j,audioTrack,mime,p=>progress((before+p*plan.total)/sum));
      recMime=recMime||blob.recMime; before+=plan.total;
      out.push({name:`dormir-acordar_${slug(S.P.name)}_montagem_${fmt.id}.${ext}`, blob, fmt});
      for(const s of plan.segs) s.L=null; // libera memória antes do próximo formato
    }
    for(const o of out){ // guarda em Já feitos com a capa da foto de frente
      const cc=canvas(432,o.fmt.h*432/o.fmt.w); renderFormat(cc.getContext("2d"),cc.width,cc.height,front,o.fmt,null,null,{single:true});
      keep(o.blob, Object.assign(metaFor(it,o.fmt,ext,o.name),{formatoNome:"Montagem · "+o.fmt.name}), await toBlob(cc,"image/jpeg",.82));
    }
    showResults(out, ext, /avc1|h264/i.test(recMime||mime), box, "Montagem pronta", "montagem");
  }catch(e){
    console.warn(e); toast("A montagem parou antes do fim. Deixe esta tela aberta e tente de novo.");
  } finally { S.busy=false; progress(null); v.muted=true; if(it.audioGain) it.audioGain.gain.value=1; renderDock(); renderMontage(); drawPreviews(); }
}

/* ---- interface ---- */
function renderMontage(){
  const sec=$("montage"), it=S.sel, on=!!(it && it.kind==="video");
  sec.hidden=!on; if(!on) return;
  const {list, front, back}=montagePhotos();
  $("mPick").hidden=!list.length;
  const fill=(sel,cur,extra)=>{ sel.innerHTML="";
    if(extra){ const o=document.createElement("option"); o.value="none"; o.textContent=extra; sel.appendChild(o); }
    for(const p of list){ const o=document.createElement("option"); o.value=p.id; o.textContent="Foto "+photoNumber(p)+" ("+p.name.slice(0,24)+")"; sel.appendChild(o); }
    sel.value = cur ? String(cur.id) : (extra ? "none" : ""); };
  fill($("mFront"),front,null); fill($("mBack"),back,"Sem foto de costas");
  const fmts=FORMATS.filter(f=>f.media.includes("video")&&S.include.has(f.id));
  if(!front){ $("mInfo").innerHTML="<strong>Envie também a foto de frente e a de costas da peça</strong> no passo 1 para montar."; }
  else {
    const desc=p=>`${fmtTime(p.vlen)} s de vídeo + frente${back?" + costas":""} (${MONT.PHOTO} s cada)${S.endCard?" + cartão da marca":""} = ${fmtTime(p.total)} s`;
    const ps=fmts.map(f=>montagePlan(it,f)), same=ps.every(p=>Math.abs(p.total-ps[0].total)<.05);
    $("mInfo").textContent = !ps.length ? "Marque pelo menos um formato de vídeo em “No pacote”." :
      same ? `Cada formato: ${desc(ps[0])}.` : fmts.map((f,i)=>`${f.plat}: ${desc(ps[i])}`).join(" · ") + (ps.some((p,i)=>fmts[i].maxDur&&p.total>=fmts[i].maxDur-.05) ? ". No TikTok Shop o vídeo é encurtado para caber em 15 s." : "");
  }
  const b=$("makeMontage"); b.disabled=S.busy||!front||!fmts.length; b.textContent=S.busy?"Gerando…":"Gerar montagem";
  // quadros de amostra no formato vertical
  const board=$("mBoard");
  const parts=[["Vídeo",null],["Frente",front],["Costas",back]].filter(([,p],i)=>i===0||p);
  if(board.dataset.n!==String(parts.length)){ board.innerHTML=""; board.dataset.n=parts.length;
    for(const [nm] of parts){ const f=document.createElement("figure"), c=canvas(10,10), cap=document.createElement("figcaption"); cap.textContent=nm; f.append(c,cap); board.appendChild(f); } }
  [...board.querySelectorAll("figcaption")].forEach((cap,i)=>{ const p=parts[i]; cap.innerHTML=""; cap.append(p[0]+" "); const s=document.createElement("span"); s.textContent=i===0? "" : "· 3 s"; cap.appendChild(s); });
  MONT.boardDirty=true;
}
function drawMontageBoard(t){
  const it=S.sel; if(!it||it.kind!=="video"||$("montage").hidden) return;
  const fmt=FORMATS.find(f=>f.id==="vertical"), {front,back}=montagePhotos();
  const cvs=[...$("mBoard").querySelectorAll("canvas")], items=[null,front,back].filter((p,i)=>i===0||p);
  cvs.forEach((cv,i)=>{
    const w=Math.max(60,Math.round((cv.clientWidth||150)*Math.min(2,window.devicePixelRatio||1))), h=Math.round(w*fmt.h/fmt.w);
    const resized = cv.width!==w||cv.height!==h; if(resized){ cv.width=w; cv.height=h; }
    if(i===0) renderFormat(cv.getContext("2d"),w,h,it,fmt,t,null);
    else if((MONT.boardDirty||resized) && !playing && items[i]) renderFormat(cv.getContext("2d"),w,h,items[i],fmt,null,null,{single:true});
  });
  if(!playing) MONT.boardDirty=false;
}
function bindMontage(){
  $("mFront").addEventListener("change",e=>{ MONT.front=+e.target.value; if(MONT.back===MONT.front) MONT.back=null; renderMontage(); renderItems(); schedule(); });
  $("mBack").addEventListener("change",e=>{ MONT.back= e.target.value==="none" ? "none" : +e.target.value; renderMontage(); renderItems(); schedule(); });
  $("makeMontage").addEventListener("click",()=>makeMontage(S.sel));
}
