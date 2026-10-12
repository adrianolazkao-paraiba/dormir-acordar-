"use strict";
/* ============ Vídeo da peça ============
   No item "Frente e costas" da barra, abaixo dos 6 espaços de foto, fica o painel de vídeo:
   - Montagem (ordem definida pelo dono): frente (3 s) → costas (3 s) → vídeo (a partir de "Começar em") → cartão da marca,
     em 9:16 e 4:5.
   - Só o vídeo: Feed 4:5, Reels 9:16 e TikTok Shop 9:16 (até 15 s).
   Tudo é gravado um formato por vez (vários vídeos grandes ao mesmo tempo engasgam o celular) e convertido para MP4 padrão.
   Cenário, marca e estilo de texto são os mesmos das fotos. */
const MONT = { PHOTO:3, END:2, XF:.4, video:null, preview:null, fmt:"vertical" };

/* frente = peça aberta no item "Frente e costas", costas = a ligada a ela, vídeo = o escolhido (ou o primeiro enviado) */
function montageSource(){
  if(!showPair()) return null;
  const it=S.sel, back=backOf(it);
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

/* Toca só o vídeo num formato (de "Começar em" até o fim; TikTok Shop até 15 s), com o cartão da marca no fim. */
async function runClip(o){
  const {vid,fmt,c}=o, W=c.width, H=c.height, ctx=c.getContext("2d"), v=vid.el, start=vid.trim||0;
  const end=fmt.maxDur? Math.min(vid.dur,start+fmt.maxDur) : vid.dur;
  v.pause(); v.loop=false; await seekTo(v,start);
  renderFormat(ctx,W,H,vid,fmt,start,end);
  if(o.onStart) o.onStart();
  await v.play().catch(()=>{ v.muted=true; return v.play().catch(()=>{}); }); // Safari: sem som se não deixar tocar com som
  let lastTv=-1, stuck=0;
  return new Promise(resolve=>{
    const step=()=>{
      if(o.cancel && o.cancel()){ v.pause(); resolve(false); return; }
      const tv=v.currentTime; stuck = tv===lastTv ? stuck+1 : 0; lastTv=tv;
      if(tv>=end-.02 || v.ended || stuck>180){ v.pause(); resolve(true); return; }
      renderFormat(ctx,W,H,vid,fmt,tv,end);
      if(o.onProg) o.onProg(Math.min(1,(tv-start)/Math.max(.1,end-start)));
      requestAnimationFrame(step);
    };
    step();
  });
}

/* ---- o que dá para gerar ---- */
const VOUTS=[
  {id:"m-vertical", grupo:"m", fmt:"vertical", nome:"Reels · Stories · TikTok", ratio:"9:16"},
  {id:"m-feed",     grupo:"m", fmt:"feed",     nome:"Feed e carrossel",         ratio:"4:5"},
  {id:"c-vertical", grupo:"c", fmt:"vertical", nome:"Reels · Stories · TikTok", ratio:"9:16"},
  {id:"c-feed",     grupo:"c", fmt:"feed",     nome:"Feed e carrossel",         ratio:"4:5"},
  {id:"c-tts",      grupo:"c", fmt:"tts-video",nome:"TikTok Shop · produto",    ratio:"9:16 · até 15 s"},
];
const VSEL=new Set(VOUTS.map(o=>o.id));
function outDuration(o, src, vid){
  const f=FORMATS.find(x=>x.id===o.fmt);
  if(o.grupo==="m") return montagePlan(src).total;
  const len=Math.max(0,vid.dur-(vid.trim||0)); return f.maxDur? Math.min(len,f.maxDur) : len;
}

/* ---- gravação em fila: um formato por vez, depois MP4 padrão, Já feitos e lista para baixar ----
   jobs: [{tipo:"m"|"c", fmt, src?, vid, nome}] */
async function recordQueue(jobs, ui){
  if(S.busy || !jobs.length) return;
  const mime=pickMime(); if(mime===null){ toast("Este navegador não grava vídeo. Use Chrome, Edge ou Safari atualizado."); return; }
  let ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  S.busy=true; await stopPreview(); stopPlayback(); renderDock(); ui.busy(true); progress(0);
  const vid=jobs[0].vid, v=vid.el; ui.results.innerHTML="";
  try{
    const src=jobs.find(j=>j.tipo==="m");
    if(src && S.scene!=="original"){ // as fotos precisam estar recortadas para entrar no cenário
      const pend=[src.src.front,src.src.back].filter(p=>!p.cut && p.cutState!=="error");
      if(pend.length){ ui.status("Terminando os recortes das fotos…",0); pend.forEach(queueCut); await cutQueue; }
    }
    const audioTrack=await videoAudioTrack(vid);
    const out=[]; let recMime="";
    for(const [k,j] of jobs.entries()){
      const fmt=FORMATS.find(f=>f.id===j.fmt);
      const c=canvas(fmt.w,fmt.h), stream=c.captureStream(30); if(audioTrack) stream.addTrack(audioTrack.clone());
      const rec=new MediaRecorder(stream, Object.assign({videoBitsPerSecond:9_000_000, audioBitsPerSecond:160_000}, mime?{mimeType:mime}:{}));
      const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
      const done=new Promise(r=>rec.onstop=()=>r(new Blob(chunks,{type:(rec.mimeType||mime||"video/webm").split(";")[0]})));
      v.muted=!audioTrack; v.volume=1;
      const rotulo=`Gravando ${k+1} de ${jobs.length} · ${j.tipo==="m"?"Montagem":"Só o vídeo"} ${fmt.ratio}`;
      const prog=p=>{ const t=(k+p)/jobs.length*.9; progress(t); ui.status(rotulo,t); };
      prog(0);
      const opts={fmt, c, onStart:()=>rec.start(1000), onProg:prog};
      if(j.tipo==="m") await runMontage(Object.assign(opts,{src:j.src})); else await runClip(Object.assign(opts,{vid}));
      rec.stop(); stream.getTracks().forEach(tr=>tr.stop());
      recMime=recMime||rec.mimeType;
      const vo=VOUTS.find(o=>o.grupo===j.tipo && o.fmt===j.fmt);
      out.push({name:j.nome+"."+ext, blob:await done, fmt, tipo:j.tipo, src:j.src, rotulo:`<b>${j.tipo==="m"?"Montagem":"Só o vídeo"}</b> · ${vo?vo.nome:fmt.plat} · ${fmt.ratio}`});
    }
    v.muted=true;
    ui.status("Preparando MP4 para WhatsApp e Instagram…",.9);
    const padrao=await standardize(out, p=>{ progress(.9+p*.1); ui.status("Preparando MP4 para WhatsApp e Instagram…",.9+p*.1); }); if(padrao) ext="mp4";
    for(const o of out){ // guarda em Já feitos, com capa
      const cc=canvas(432,o.fmt.h*432/o.fmt.w), g=cc.getContext("2d");
      if(o.tipo==="m") renderFormat(g,cc.width,cc.height,o.src.front,o.fmt,null,null); else renderFormat(g,cc.width,cc.height,vid,o.fmt,(vid.trim||0)+.6,null);
      keep(o.blob, Object.assign(metaFor(o.tipo==="m"?o.src.front:vid,o.fmt,ext,o.name),{tipo:"video", formatoNome:(o.tipo==="m"?"Montagem frente + costas + vídeo":"Só o vídeo")+" · "+o.fmt.ratio}), await toBlob(cc,"image/jpeg",.82));
    }
    showResults(out, ext, padrao || /avc1|h264/i.test(recMime||mime), ui.results, `${out.length} vídeo${out.length===1?"":"s"} pronto${out.length===1?"":"s"}`, "videos");
    ui.status(null);
  }catch(e){
    console.warn(e); ui.status(null); toast("A gravação parou antes do fim. Deixe esta tela aberta e tente de novo.");
  } finally { S.busy=false; progress(null); v.muted=true; if(vid.audioGain) vid.audioGain.gain.value=1; renderDock(); ui.busy(false); drawPreviews(); }
}
function jobName(o, src, vid){
  const base=`dormir-acordar_${slug(S.P.name)}`;
  if(o.grupo==="m") return `${base}_${String(Math.max(1,photoNumber(src.front))).padStart(2,"0")}_montagem_${o.fmt}`;
  return `${base}_video-${String(S.items.filter(x=>x.kind==="video").indexOf(vid)+1).padStart(2,"0")}_${o.fmt}`;
}

/* ---- painel de vídeo (dentro do item "Frente e costas") ---- */
const VP={el:null};
function videoPanel(){
  const host=$("vpanel"), src=montageSource();
  host.hidden=!src; if(!src){ host.innerHTML=""; VP.el=null; return; }
  const vid=src.vid;
  if(!VP.el || !host.contains(VP.el.root)) buildVideoPanel(host);
  const e=VP.el, p=montagePlan(src);
  // vídeos enviados (quando há mais de um)
  e.vids.hidden=src.vids.length<2;
  if(src.vids.length>1){ e.vids.innerHTML=""; src.vids.forEach((v,i)=>{ const b=document.createElement("button"); b.type="button"; b.className="vp-vid"+(v===vid?" on":"");
    const th=canvas(96,120); try{ drawCover(th.getContext("2d"),v.el,v.w,v.h,96,120,newAdj(),false); }catch(err){} b.append(th, Object.assign(document.createElement("span"),{textContent:"Vídeo "+(i+1)+" · "+fmtTime(v.dur)+" s"}));
    b.addEventListener("click",()=>{ MONT.video=v.id; stopPreview(); videoPanel(); drawVideoStill(); }); e.vids.appendChild(b); }); }
  // formato da prévia
  for(const b of e.fmt.children){ const on=b.dataset.v===MONT.fmt; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); }
  e.screen.style.aspectRatio = MONT.fmt==="feed" ? "4/5" : "9/16";
  // linha do tempo
  const segs=[["Frente",MONT.PHOTO,"f"],["Costas",MONT.PHOTO,"c"],["Vídeo",p.vlen,"v"]].concat(p.end?[["Cartão",p.end,"e"]]:[]);
  e.tl.innerHTML=""; for(const [nm,d,k] of segs){ const s=document.createElement("div"); s.className="vp-seg vp-"+k; s.style.flexGrow=Math.max(.6,d);
    s.innerHTML=`<b></b><span></span>`; s.firstChild.textContent=nm; s.lastChild.textContent=fmtTime(d)+" s"; e.tl.appendChild(s); }
  e.tl.appendChild(e.head);
  e.total.textContent=fmtTime(p.total)+" s";
  // ajustes
  e.trim.max=Math.max(0,vid.dur-1).toFixed(1); e.trim.value=vid.trim||0; e.trimOut.textContent=fmtTime(vid.trim||0)+" s";
  for(const b of e.pos.children){ const on=b.dataset.v===S.vidPos; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); }
  e.end.checked=S.endCard; syncPanelLook();
  // o que gerar
  e.outs.innerHTML="";
  for(const [g,titulo,desc] of [["m","Montagem","Frente, costas e o vídeo"],["c","Só o vídeo","O seu vídeo com texto e marca"]]){
    const h=document.createElement("div"); h.className="vp-group"; h.innerHTML="<b></b><span></span>"; h.firstChild.textContent=titulo; h.lastChild.textContent=desc; e.outs.appendChild(h);
    for(const o of VOUTS.filter(x=>x.grupo===g)){
      const row=document.createElement("label"); row.className="vp-out";
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=VSEL.has(o.id); cb.dataset.id=o.id;
      cb.addEventListener("change",()=>{ cb.checked?VSEL.add(o.id):VSEL.delete(o.id); updateGenButton(); });
      const tx=document.createElement("span"); tx.className="vp-out-t"; tx.innerHTML="<b></b><small></small>"; tx.firstChild.textContent=o.nome; tx.lastChild.textContent=o.ratio;
      const du=document.createElement("span"); du.className="vp-out-d"; du.textContent=fmtTime(outDuration(o,src,vid))+" s";
      row.append(cb,tx,du); e.outs.appendChild(row);
    }
  }
  updateGenButton();
  e.play.disabled=S.busy;
}
function updateGenButton(){
  const e=VP.el; if(!e) return; const n=VOUTS.filter(o=>VSEL.has(o.id)).length;
  e.gen.disabled=S.busy||!n; e.gen.textContent=S.busy?"Gerando…": n? `Gerar ${n} vídeo${n===1?"":"s"}` : "Escolha o que gerar";
  e.cover.disabled=S.busy;
}
function buildVideoPanel(host){
  host.innerHTML=`
  <header class="vp-head">
    <div><div class="eyebrow">Vídeo da peça</div><h2>Frente, costas e o seu vídeo</h2></div>
    <div class="vp-total"><span>Montagem</span><b></b></div>
  </header>
  <div class="vp-vids" role="group" aria-label="Vídeo usado"></div>
  <div class="vp-body">
    <div class="vp-stage">
      <div class="seg vp-fmt" role="radiogroup" aria-label="Formato da prévia"><button type="button" data-v="vertical">9:16</button><button type="button" data-v="feed">4:5</button></div>
      <div class="vp-screen"><canvas></canvas><button type="button" class="vp-play" aria-label="Ver prévia"></button></div>
      <div class="vp-tl" aria-label="Linha do tempo"></div>
      <div class="vp-look">
        <div class="field"><span class="lbl" id="vpLayL">Estilo do texto</span>
          <div class="seg" id="vpLayout" role="radiogroup" aria-labelledby="vpLayL"><button type="button" data-v="editorial">Editorial</button><button type="button" data-v="etiqueta">Etiqueta</button><button type="button" data-v="none">Sem texto</button></div></div>
        <div class="field"><span class="lbl" id="vpMarkL">Marca</span>
          <div class="vp-marks" id="vpMark" role="radiogroup" aria-labelledby="vpMarkL">
            <button type="button" data-v="logo"><canvas width="120" height="150"></canvas><span>Logo</span></button>
            <button type="button" data-v="mono"><canvas width="120" height="150"></canvas><span>D&amp;A com círculo</span></button>
            <button type="button" data-v="word"><canvas width="120" height="150"></canvas><span>D&amp;A</span></button>
            <button type="button" data-v="wm"><canvas width="120" height="150"></canvas><span>Marca d’água com círculo</span></button>
            <button type="button" data-v="wmword"><canvas width="120" height="150"></canvas><span>Marca d’água</span></button>
            <button type="button" data-v="none"><canvas width="120" height="150"></canvas><span>Sem marca</span></button>
          </div></div>
      </div>
      <p class="hint vp-tip">Prévia sem som. O vídeo final sai com o som do seu vídeo.</p>
    </div>
    <div class="vp-side">
      <section class="vp-block"><h3>Ajustes</h3>
        <div class="range"><label for="vpTrim">Começar em</label><input id="vpTrim" type="range" min="0" step="0.1"><output id="vpTrimOut"></output></div>
        <div class="field"><span class="lbl" id="vpPosL">Texto no vídeo</span><div class="seg" id="vpPos" role="radiogroup" aria-labelledby="vpPosL"><button type="button" data-v="top">No topo</button><button type="button" data-v="bottom">Embaixo</button></div></div>
        <label class="check"><input id="vpEnd" type="checkbox"> Terminar com o cartão da marca</label>
      </section>
      <section class="vp-block"><h3>O que gerar</h3><div class="vp-outs"></div></section>
      <div class="vp-actions"><button class="btn" type="button" id="vpGen"></button><button class="btn ghost" type="button" id="vpCover">Capa do Reels</button></div>
      <div class="vp-progress" hidden><span></span><div class="bar"><i></i></div></div>
    </div>
  </div>
  <div class="results vp-results"></div>`;
  const q=s=>host.querySelector(s);
  const e=VP.el={root:host.firstElementChild, vids:q(".vp-vids"), fmt:q(".vp-fmt"), screen:q(".vp-screen"), cv:q(".vp-screen canvas"), play:q(".vp-play"),
    tl:q(".vp-tl"), head:document.createElement("i"), total:q(".vp-total b"), trim:q("#vpTrim"), trimOut:q("#vpTrimOut"), pos:q("#vpPos"), end:q("#vpEnd"),
    outs:q(".vp-outs"), gen:q("#vpGen"), cover:q("#vpCover"), prog:q(".vp-progress"), results:q(".vp-results")};
  e.root=host; e.head.className="vp-head-line";
  renderPlayGlyph(false);
  for(const b of e.fmt.children) b.addEventListener("click",()=>{ MONT.fmt=b.dataset.v; stopPreview(); videoPanel(); drawVideoStill(); });
  e.play.addEventListener("click",togglePreview);
  e.trim.addEventListener("input",()=>{ const src=montageSource(); if(!src) return; src.vid.trim=+e.trim.value; e.trimOut.textContent=fmtTime(src.vid.trim)+" s"; });
  e.trim.addEventListener("change",()=>{ stopPreview(); videoPanel(); });
  for(const b of e.pos.children) b.addEventListener("click",()=>{ S.vidPos=b.dataset.v; savePrefs(); renderSegs(); videoPanel(); });
  e.end.addEventListener("change",()=>{ S.endCard=e.end.checked; $("endCard").checked=S.endCard; savePrefs(); videoPanel(); });
  e.gen.addEventListener("click",generateFromPanel);
  // estilo do texto e marca, logo abaixo da prévia (os mesmos da lateral, valem para fotos e vídeos)
  e.layout=q("#vpLayout"); e.marks=q("#vpMark");
  for(const b of e.layout.children) b.addEventListener("click",()=>{ S.layout=b.dataset.v; savePrefs(); renderSegs(); schedule(); });
  for(const b of e.marks.children) b.addEventListener("click",()=>{ S.mark=b.dataset.v; savePrefs(); renderSegs(); schedule(); });
  for(const b of e.marks.children) paintMarkChip(b.querySelector("canvas"), b.dataset.v);
  e.cover.addEventListener("click",()=>{ const src=montageSource(); if(src) saveCover(src.vid); });
}
function panelUI(){
  const e=VP.el;
  return { results:e.results,
    busy:on=>{ updateGenButton(); e.play.disabled=on; e.prog.hidden=!on; },
    status:(txt,p)=>{ e.prog.hidden=!txt; if(txt){ e.prog.firstElementChild.textContent=txt; e.prog.querySelector("i").style.width=Math.round((p||0)*100)+"%"; } } };
}
function generateFromPanel(){
  const src=montageSource(); if(!src||S.busy) return;
  const jobs=VOUTS.filter(o=>VSEL.has(o.id)).map(o=>({tipo:o.grupo, fmt:o.fmt, src, vid:src.vid, nome:jobName(o,src,src.vid)}));
  VP.el.root.scrollIntoView({behavior:"smooth",block:"start"});
  recordQueue(jobs, panelUI());
}
function renderPlayGlyph(on){
  const b=VP.el&&VP.el.play; if(!b) return;
  b.innerHTML = on ? '<svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
                   : '<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.5v11l9-5.5z"/></svg>';
  b.classList.toggle("playing",on); b.setAttribute("aria-label",on?"Parar prévia":"Ver prévia");
}
/* quadro parado da prévia: a foto de frente, como o vídeo abre */
function drawVideoStill(){
  const e=VP.el, src=montageSource(); if(!e || !src || MONT.preview) return;
  const fmt=FORMATS.find(f=>f.id===MONT.fmt), cv=e.cv;
  const w=Math.min(fmt.w,Math.round((e.screen.clientWidth||280)*Math.min(2,window.devicePixelRatio||1))), h=Math.round(w*fmt.h/fmt.w);
  if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
  drawPhotoFrame(cv.getContext("2d"),w,h,photoLayers(src.front,fmt,w,h),0,MONT.PHOTO);
  e.head.style.left="0%";
}
async function togglePreview(){
  if(MONT.preview){ stopPreview(); return; }
  const e=VP.el, src=montageSource(); if(!e||!src||S.busy) return;
  stopPlayback(); drawVideoStill();
  const token={stop:false}; MONT.preview=token; renderPlayGlyph(true);
  src.vid.el.muted=true;
  token.done=runMontage({src, fmt:FORMATS.find(f=>f.id===MONT.fmt), c:e.cv, cancel:()=>token.stop || VP.el!==e,
    onProg:p=>{ e.head.style.left=(p*100).toFixed(2)+"%"; }});
  await token.done;
  if(MONT.preview===token) MONT.preview=null;
  renderPlayGlyph(false); drawVideoStill();
}
/* para a prévia e espera ela soltar o vídeo (senão a pausa do fim da prévia atrapalha a gravação) */
function stopPreview(){
  const t=MONT.preview; if(!t) return Promise.resolve();
  t.stop=true; MONT.preview=null; renderPlayGlyph(false); return t.done || Promise.resolve();
}

/* marca e estilo do texto do painel acompanham a lateral */
function syncPanelLook(){
  const e=VP.el; if(!e || !e.layout) return;
  if(!e.marksLogo && logoImg.naturalWidth){ e.marksLogo=true; for(const b of e.marks.children) paintMarkChip(b.querySelector("canvas"), b.dataset.v); }
  for(const b of e.layout.children){ const on=b.dataset.v===S.layout; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); }
  for(const b of e.marks.children){ const on=b.dataset.v===S.mark; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); }
  for(const b of e.pos.children){ const on=b.dataset.v===S.vidPos; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); }
  if(!MONT.preview) drawVideoStill();
}
