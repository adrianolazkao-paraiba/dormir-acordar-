"use strict";
/* ============ Montagem: foto de frente + foto de costas + vídeo num vídeo só ============
   Aparece como 7º espaço na tela das fotos quando a foto aberta tem a de costas ligada e há um vídeo enviado.
   Ordem (definida pelo dono): frente (3 s) → costas (3 s) → vídeo (a partir de "Começar em") → cartão da marca.
   Sai em 9:16 (Reels, Stories, TikTok) e 4:5 (Feed). Cenário, marca e estilo de texto iguais aos das fotos. */
const MONT = { PHOTO:3, END:2, XF:.4, FMTS:["vertical","feed"], video:null, card:null, preview:null };

function montageFormats(){ return MONT.FMTS.map(id=>FORMATS.find(f=>f.id===id)); }
/* frente = foto aberta, costas = a ligada a ela, vídeo = o escolhido (ou o primeiro enviado) */
function montageSource(){
  const it=viewItem(); if(!it || it.kind!=="photo" || it.example) return null;
  const back=backOf(it); if(!back) return null;
  const vids=S.items.filter(i=>i.kind==="video"); if(!vids.length) return null;
  return { front:it, back, vid:vids.find(v=>v.id===MONT.video)||vids[0], vids };
}
function montagePlan(src){
  const start=src.vid.trim||0, vlen=Math.max(0,src.vid.dur-start), end=S.endCard?MONT.END:0;
  return { start, vEnd:start+vlen, vlen, end, total:2*MONT.PHOTO+vlen+end };
}
/* foto pronta em duas camadas: base (cenário + modelo, que ganha zoom lento) e texto/marca (parados) */
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
function seekTo(v,t){ return new Promise(r=>{ const k=setTimeout(()=>{ v.removeEventListener("seeked",f); r(); },1500), f=()=>{ clearTimeout(k); r(); }; v.addEventListener("seeked",f,{once:true}); v.currentTime=t; }); }

/* Toca a montagem num canvas em tempo real (para gravar ou só para ver a prévia).
   o: {src, fmt, c, onProg, cancel} — devolve true se chegou ao fim. */
async function runMontage(o){
  const {src,fmt,c}=o, W=c.width, H=c.height, ctx=c.getContext("2d"), plan=montagePlan(src), v=src.vid.el;
  const Lf=photoLayers(src.front,fmt,W,H), Lb=photoLayers(src.back,fmt,W,H);
  const prev=canvas(W,H), pg=prev.getContext("2d"), snap=()=>{ pg.clearRect(0,0,W,H); pg.drawImage(c,0,0); };
  const fadePrev=u=>{ if(u<MONT.XF){ ctx.save(); ctx.globalAlpha=1-u/MONT.XF; ctx.drawImage(prev,0,0,W,H); ctx.restore(); } };
  v.pause(); v.loop=false; await seekTo(v,plan.start);
  drawPhotoFrame(ctx,W,H,Lf,0,MONT.PHOTO);
  if(o.onStart) o.onStart();
  const t0=performance.now(); let phase=0, tp=t0, lastTv=-1, stuck=0;
  return new Promise(resolve=>{
    const finish=okEnd=>{ v.pause(); resolve(okEnd); };
    const step=()=>{
      if(o.cancel && o.cancel()){ finish(false); return; }
      const now=performance.now(), u=(now-tp)/1000;
      if(phase<2){ // fotos: frente e costas
        if(u>=MONT.PHOTO){ snap(); phase++; tp=now;
          if(phase===2) v.play().catch(()=>{ v.muted=true; v.play().catch(()=>{}); }); // Safari: sem som se não deixar tocar
          requestAnimationFrame(step); return; }
        drawPhotoFrame(ctx,W,H,phase?Lb:Lf,u,MONT.PHOTO); if(phase===1) fadePrev(u);
      } else if(phase===2){ // vídeo
        const tv=v.currentTime;
        stuck = tv===lastTv ? stuck+1 : 0; lastTv=tv;
        if(tv>=plan.vEnd-.02 || v.ended || stuck>180){ snap(); v.pause(); phase=3; tp=now;
          if(!plan.end){ finish(true); return; } requestAnimationFrame(step); return; }
        renderFormat(ctx,W,H,src.vid,fmt,tv,null,{noFade:true}); fadePrev(u);
      } else { // cartão da marca sobre o último quadro do vídeo
        if(u>=plan.end){ finish(true); return; }
        ctx.clearRect(0,0,W,H); ctx.drawImage(prev,0,0,W,H); drawEndCard(ctx,W,H,fmt,Math.min(1,u/.5));
      }
      if(o.onProg) o.onProg(Math.min(1,(now-t0)/1000/plan.total));
      requestAnimationFrame(step);
    };
    step();
  });
}

/* grava 9:16 e 4:5, um de cada vez (3 vídeos grandes ao mesmo tempo engasgam o celular) */
async function makeMontage(){
  const src=montageSource(); if(S.busy || !src) return;
  const mime=pickMime(); if(mime===null){ toast("Este navegador não grava vídeo. Use Chrome, Edge ou Safari atualizado."); return; }
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  S.busy=true; await stopPreview(); stopPlayback(); renderDock(); updateMontageCard(); progress(0);
  const box=$("results"); box.innerHTML=""; const v=src.vid.el;
  try{
    if(S.scene!=="original"){ // as fotos precisam estar recortadas para entrar no cenário
      const pend=[src.front,src.back].filter(p=>!p.cut && p.cutState!=="error");
      if(pend.length){ toast("Terminando os recortes das fotos…"); pend.forEach(queueCut); await cutQueue; }
    }
    const audioTrack=await videoAudioTrack(src.vid);
    const fmts=montageFormats(), plan=montagePlan(src), out=[]; let recMime="";
    for(const [k,fmt] of fmts.entries()){
      const c=canvas(fmt.w,fmt.h), stream=c.captureStream(30); if(audioTrack) stream.addTrack(audioTrack.clone());
      const rec=new MediaRecorder(stream, Object.assign({videoBitsPerSecond:9_000_000, audioBitsPerSecond:160_000}, mime?{mimeType:mime}:{}));
      const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
      const done=new Promise(r=>rec.onstop=()=>r(new Blob(chunks,{type:(rec.mimeType||mime||"video/webm").split(";")[0]})));
      v.muted=!audioTrack; v.volume=1;
      if(MONT.card) MONT.card.gen.textContent=`Gravando ${k+1} de ${fmts.length}…`;
      await runMontage({src, fmt, c, onStart:()=>rec.start(1000), onProg:p=>progress((k+p)/fmts.length)});
      rec.stop(); stream.getTracks().forEach(tr=>tr.stop());
      recMime=recMime||rec.mimeType;
      out.push({name:`dormir-acordar_${slug(S.P.name)}_${String(Math.max(1,photoNumber(src.front))).padStart(2,"0")}_video-montagem_${fmt.id}.${ext}`, blob:await done, fmt});
    }
    v.muted=true;
    for(const o of out){ // guarda em Já feitos com a capa da frente e costas
      const cc=canvas(432,o.fmt.h*432/o.fmt.w); renderFormat(cc.getContext("2d"),cc.width,cc.height,src.front,o.fmt,null,null);
      keep(o.blob, Object.assign(metaFor(src.front,o.fmt,ext,o.name),{tipo:"video", formatoNome:"Vídeo frente + costas + vídeo · "+o.fmt.ratio}), await toBlob(cc,"image/jpeg",.82));
    }
    showResults(out, ext, /avc1|h264/i.test(recMime||mime), box, `Vídeo pronto (${fmtTime(plan.total)} s)`, "video-montagem");
  }catch(e){
    console.warn(e); toast("A gravação parou antes do fim. Deixe esta tela aberta e tente de novo.");
  } finally { S.busy=false; progress(null); v.muted=true; if(src.vid.audioGain) src.vid.audioGain.gain.value=1; renderDock(); updateMontageCard(); drawMontageStill(); }
}

/* ---- 7º espaço na tela das fotos ---- */
function montageCard(grid){
  MONT.card=null; const src=montageSource(); if(!src) return;
  const fmt=montageFormats()[0];
  const card=document.createElement("article"); card.className="card mcard";
  const plat=document.createElement("div"); plat.className="plat"; plat.textContent="Reels · Stories · TikTok · Feed";
  const nm=document.createElement("div"); nm.className="nm"; nm.textContent="Vídeo: frente + costas + vídeo";
  const frame=document.createElement("div"); frame.className="frame";
  const cv=canvas(10,10); cv.style.aspectRatio=fmt.w+"/"+fmt.h; frame.appendChild(cv);
  const meta=document.createElement("div"); meta.className="meta";
  const note=document.createElement("p"); note.className="note";
  note.textContent="Frente (3 s), costas (3 s) e o vídeo, com o mesmo cenário, marca e texto. Sai em 9:16 e em 4:5.";
  const foot=document.createElement("div"); foot.className="foot";
  let pick=null;
  if(src.vids.length>1){ pick=document.createElement("select"); pick.className="vpick"; pick.setAttribute("aria-label","Vídeo da montagem");
    src.vids.forEach((v,i)=>{ const o=document.createElement("option"); o.value=v.id; o.textContent="Vídeo "+(i+1)+" ("+fmtTime(v.dur)+" s)"; pick.appendChild(o); });
    pick.value=String(src.vid.id); pick.addEventListener("change",()=>{ MONT.video=+pick.value; stopPreview(); updateMontageCard(); drawMontageStill(); }); }
  const pv=document.createElement("button"); pv.type="button"; pv.className="btn ghost sm"; pv.textContent="Ver prévia"; pv.addEventListener("click",togglePreview);
  const gen=document.createElement("button"); gen.type="button"; gen.className="btn sm"; gen.textContent="Gerar vídeo"; gen.addEventListener("click",makeMontage);
  if(pick) foot.appendChild(pick); foot.append(pv,gen);
  card.append(plat,nm,frame,meta,note,foot); grid.appendChild(card);
  MONT.card={cv,meta,pv,gen,fmt};
  updateMontageCard();
}
function updateMontageCard(){
  const m=MONT.card, src=montageSource(); if(!m || !src) return;
  const p=montagePlan(src);
  m.meta.innerHTML=""; const a=document.createElement("span"), b=document.createElement("span");
  a.textContent=`9:16 e 4:5 · ${MONT.PHOTO} s + ${MONT.PHOTO} s + ${fmtTime(p.vlen)} s${p.end?" + cartão":""} = ${fmtTime(p.total)} s`; b.textContent="MP4"; m.meta.append(a,b);
  m.gen.disabled=S.busy; m.gen.textContent=S.busy?"Gerando…":"Gerar vídeo";
  m.pv.disabled=S.busy; m.pv.textContent=MONT.preview?"Parar prévia":"Ver prévia";
}
/* quadro parado do 7º espaço: a foto de frente como abre o vídeo */
function drawMontageStill(){
  const m=MONT.card, src=montageSource(); if(!m || !src || MONT.preview) return;
  const cv=m.cv, w=Math.min(m.fmt.w,Math.round((cv.clientWidth||240)*Math.min(2,window.devicePixelRatio||1))), h=Math.round(w*m.fmt.h/m.fmt.w);
  if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
  const L=photoLayers(src.front,m.fmt,w,h); drawPhotoFrame(cv.getContext("2d"),w,h,L,0,MONT.PHOTO);
}
async function togglePreview(){
  if(MONT.preview){ stopPreview(); return; }
  const m=MONT.card, src=montageSource(); if(!m||!src||S.busy) return;
  stopPlayback();
  const token={stop:false}; MONT.preview=token; updateMontageCard();
  src.vid.el.muted=true;
  token.done=runMontage({src, fmt:m.fmt, c:m.cv, cancel:()=>token.stop || MONT.card!==m});
  await token.done;
  if(MONT.preview===token) MONT.preview=null;
  updateMontageCard(); drawMontageStill();
}
/* para a prévia e espera ela soltar o vídeo (senão a pausa do fim da prévia atrapalha a gravação) */
function stopPreview(){
  const t=MONT.preview; if(!t) return Promise.resolve();
  t.stop=true; MONT.preview=null; return t.done || Promise.resolve();
}
