"use strict";
/* ============ Vídeo ============ */
let playing=false, frameHandle=null;
function renderPlayIcon(){
  const b=$("playBtn"); b.innerHTML = playing ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>';
  b.setAttribute("aria-label",playing?"Pausar":"Reproduzir");
}
function tick(){
  const it=S.sel; if(!it||it.kind!=="video") return;
  const v=it.el; $("scrub").value=Math.round(v.currentTime/(it.dur||1)*1000); $("time").textContent=fmtTime(v.currentTime)+" / "+fmtTime(it.dur)+" s";
  drawPreviews();
  if(playing){ frameHandle = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick); }
}
async function togglePlay(){
  const it=S.sel; if(!it||it.kind!=="video"||S.busy) return;
  const v=it.el;
  if(playing){ stopPlayback(); return; }
  if(v.currentTime>=it.dur-.05||v.currentTime<it.trim) v.currentTime=it.trim;
  v.muted=!$("sound").checked; v.loop=true;
  try{ await v.play(); playing=true; renderPlayIcon(); tick(); }catch(e){ toast("Não consegui reproduzir este vídeo neste navegador."); }
}
function stopPlayback(){
  const it=S.sel; playing=false; if(it&&it.kind==="video"&&!S.busy){ it.el.pause(); it.el.loop=false; } renderPlayIcon();
}
function seek(t){ const it=S.sel; if(!it||it.kind!=="video") return; it.el.currentTime=Math.max(0,Math.min(it.dur,t)); }
let audioCtx=null;
function pickMime(){
  const opts=["video/mp4;codecs=avc1.640028,mp4a.40.2","video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4;codecs=avc1,mp4a.40.2","video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
  if(!window.MediaRecorder) return null; return opts.find(m=>{ try{ return MediaRecorder.isTypeSupported(m); }catch(e){ return false; } })||"";
}
async function makeVideos(it){
  if(S.busy) return;
  const fmts=FORMATS.filter(f=>f.media.includes("video")&&S.include.has(f.id)); if(!fmts.length) return;
  const mime=pickMime(); if(mime===null){ toast("Este navegador não grava vídeo. Use Chrome, Edge ou Safari atualizado."); return; }
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  S.busy=true; await stopPreview(); stopPlayback(); renderDock(); progress(0);
  const v=it.el; const res=$("results"); res.innerHTML="";
  try{
    const audioTrack=await videoAudioTrack(it);
    const start=it.trim||0;
    const jobs=fmts.map(fmt=>{
      const c=canvas(fmt.w,fmt.h), ctx=c.getContext("2d");
      const stream=c.captureStream(30); if(audioTrack) stream.addTrack(audioTrack.clone());
      const rec=new MediaRecorder(stream, Object.assign({videoBitsPerSecond:9_000_000, audioBitsPerSecond:160_000}, mime?{mimeType:mime}:{}));
      const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
      const end=Math.min(it.dur, fmt.maxDur? start+fmt.maxDur : it.dur);
      const done=new Promise(r=>rec.onstop=()=>r(new Blob(chunks,{type:(rec.mimeType||mime||"video/webm").split(";")[0]})));
      return {fmt,c,ctx,rec,stream,end,done,stopped:false};
    });
    v.loop=false; v.muted=!audioTrack; v.volume=1; // o som vai só para a gravação, não para o alto-falante
    await new Promise(r=>{ const t=setTimeout(()=>{ v.onseeked=null; r(); },1500); v.onseeked=()=>{ clearTimeout(t); v.onseeked=null; r(); }; v.currentTime=start; });
    for(const j of jobs) renderFormat(j.ctx,j.fmt.w,j.fmt.h,it,j.fmt,start,j.end);
    for(const j of jobs) j.rec.start(1000);
    const maxEnd=Math.max(...jobs.map(j=>j.end));
    await v.play().catch(()=>{ v.muted=true; return v.play(); }); // Safari: grava sem som se não deixar tocar com som
    await new Promise(resolve=>{
      const step=()=>{
        const t=v.currentTime;
        for(const j of jobs){ if(j.stopped) continue; renderFormat(j.ctx,j.fmt.w,j.fmt.h,it,j.fmt,t,j.end);
          if(t>=j.end-0.02||v.ended){ j.stopped=true; j.rec.stop(); j.stream.getTracks().forEach(tr=>tr.stop()); } }
        progress((t-start)/(maxEnd-start)); $("scrub").value=Math.round(t/(it.dur||1)*1000); $("time").textContent=fmtTime(t)+" / "+fmtTime(it.dur)+" s";
        if(jobs.every(j=>j.stopped)){ v.pause(); resolve(); return; }
        v.requestVideoFrameCallback ? v.requestVideoFrameCallback(step) : requestAnimationFrame(step);
      };
      v.onended=()=>{ for(const j of jobs) if(!j.stopped){ j.stopped=true; j.rec.stop(); j.stream.getTracks().forEach(tr=>tr.stop()); } v.pause(); resolve(); };
      step();
    });
    v.onended=null; v.muted=true;
    const blobs=await Promise.all(jobs.map(j=>j.done));
    const out=jobs.map((j,i)=>({name:fileName(it,j.fmt,S.items.filter(x=>x.kind==="video").indexOf(it)+1,ext), blob:blobs[i], fmt:j.fmt}));
    for(const o of out){ // guarda cada vídeo com uma capa para a lista
      const cc=canvas(432,o.fmt.h*432/o.fmt.w); renderFormat(cc.getContext("2d"),cc.width,cc.height,it,o.fmt,start+.6,null);
      keep(o.blob, metaFor(it,o.fmt,ext,o.name), await toBlob(cc,"image/jpeg",.82));
    }
    showResults(out, ext, /avc1|h264/i.test(jobs[0].rec.mimeType||mime));
  }catch(e){
    console.warn(e); toast("A gravação parou antes do fim. Deixe esta tela aberta e tente de novo.");
  } finally { S.busy=false; progress(null); v.muted=true; if(it.audioGain) it.audioGain.gain.value=1; renderDock(); drawPreviews(); }
}
/* som do vídeo só para a gravação (o alto-falante fica mudo enquanto grava) */
async function videoAudioTrack(it){
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    await audioCtx.resume();
    if(!it.audioNode){ it.audioNode=audioCtx.createMediaElementSource(it.el); it.audioDest=audioCtx.createMediaStreamDestination(); it.audioGain=audioCtx.createGain(); it.audioNode.connect(it.audioDest); it.audioNode.connect(it.audioGain); it.audioGain.connect(audioCtx.destination); }
    it.audioGain.gain.value=0;
    return it.audioDest.stream.getAudioTracks()[0]||null;
  }catch(e){ return null; }
}
function showResults(out, ext, h264, box, title, zipTag){
  const res=box||$("results"); res.innerHTML="";
  const h=document.createElement("div"); h.className="res";
  const warn = ext==="webm" ? " Este navegador não grava MP4. Para Instagram e TikTok, gere os vídeos no Chrome, Edge ou Safari." : (!h264 ? " Este navegador gravou em um formato que o Instagram pode recusar. Se der erro ao postar, gere no Chrome ou Safari atualizado." : "");
  h.innerHTML=`<span><b>${title||"Vídeos prontos"}</b> · ${ext.toUpperCase()}.${warn}</span>`;
  const all=document.createElement("button"); all.className="btn sm"; all.type="button"; all.textContent="Baixar todos (.zip)";
  all.addEventListener("click",async()=>{ if(!window.JSZip) await loadScript("vendor/jszip.min.js").catch(()=>{}); if(!window.JSZip){ toast("Use o botão de cada vídeo."); return; } const z=new JSZip(); out.forEach(o=>z.file(o.name,o.blob)); await saveFile(`dormir-acordar_${slug(S.P.name)}_${zipTag||"videos"}.zip`, await z.generateAsync({type:"blob",compression:"STORE"})); });
  h.appendChild(all); res.appendChild(h);
  for(const o of out){
    const r=document.createElement("div"); r.className="res";
    r.innerHTML=`<span><b>${o.fmt.plat}</b> · ${o.fmt.name} · ${(o.blob.size/1048576).toFixed(1).replace(".",",")} MB</span>`;
    const b=document.createElement("button"); b.className="btn ghost sm"; b.type="button"; b.textContent="Baixar"; b.addEventListener("click",()=>saveFile(o.name,o.blob)); r.appendChild(b); res.appendChild(r);
  }
  res.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function saveCover(it){
  const fmt=FORMATS.find(f=>f.id==="vertical"); const c=canvas(fmt.w,fmt.h);
  renderFormat(c.getContext("2d"),fmt.w,fmt.h,it,fmt,null,null);
  const name=`dormir-acordar_${slug(S.P.name)}_capa-reels.jpg`, blob=await toBlob(c,"image/jpeg",.92);
  if(await saveFile(name, blob)) keep(blob, Object.assign(metaFor(it,fmt,"jpg",name),{formatoNome:"Capa do Reels"}));
}
