"use strict";
/* ============ Eventos ============ */
function bind(){
  const file=$("file"), drop=$("drop");
  file.addEventListener("change",()=>{ addFiles(file.files); file.value=""; });
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
  $("customBg").addEventListener("change",async e=>{ const f=e.target.files[0]; if(!f) return; try{ const c=await loadImage(f); S.customBg={img:c,v:Date.now()}; S.scene="custom"; onSceneChange(); }catch(err){ toast("Não consegui abrir essa foto de cenário."); } e.target.value=""; });
  const adj=(id,key,out,fmt)=>$(id).addEventListener("input",e=>{ if(!S.sel) return; S.sel.adj[key]=+e.target.value; $(out).textContent=fmt(+e.target.value); schedule(); });
  adj("adjSize","size","oSize",v=>v+"%"); adj("adjX","x","oX",v=>v); adj("adjY","y","oY",v=>v);
  $("trim").addEventListener("input",e=>{ const it=S.sel; if(!it||it.kind!=="video") return; it.trim=+e.target.value; $("oTrim").textContent=fmtTime(it.trim)+" s"; seek(it.trim); });
  $("trim").addEventListener("change",()=>{ renderGrid(); schedule(); });
  const fields={pName:"name",pPrice:"price",pOld:"old",pEyebrow:"eyebrow",pCta:"cta"};
  for(const [id,k] of Object.entries(fields)){ const el=$(id); el.value=S.P[k]||""; el.addEventListener("input",()=>{ S.P[k]=el.value; savePrefs(); schedule(); }); }
  for(const b of $("layoutSeg").children){ b.addEventListener("click",()=>{ S.layout=b.dataset.v; savePrefs(); renderSegs(); schedule(); }); }
  for(const b of $("markSeg").children) b.addEventListener("click",()=>{ S.mark=b.dataset.v; savePrefs(); renderSegs(); schedule(); });
  for(const b of $("vidPosSeg").children) b.addEventListener("click",()=>{ S.vidPos=b.dataset.v; savePrefs(); renderSegs(); videoPanel(); schedule(); });
  $("endCard").checked=S.endCard; $("endCard").addEventListener("change",e=>{ S.endCard=e.target.checked; savePrefs(); videoPanel(); schedule(); });
  $("showZones").addEventListener("change",e=>{ S.zones=e.target.checked; for(const c of cards.values()) drawZones(c.zones,c.fmt); });
  $("playBtn").addEventListener("click",togglePlay);
  $("scrub").addEventListener("input",e=>{ const it=S.sel; if(!it||it.kind!=="video") return; seek(e.target.value/1000*it.dur); it.el.addEventListener("seeked",()=>{ tick(); },{once:true}); });
  $("sound").addEventListener("change",e=>{ const it=S.sel; if(it&&it.kind==="video"&&!S.busy) it.el.muted=!e.target.checked; });
  $("capBtn").addEventListener("click",writeCaptions);
  $("pairSel").addEventListener("change",e=>{ const it=viewItem(); if(!it) return; const o=S.items.find(x=>String(x.id)===e.target.value)||null;
    if(o && o.pair===it) o.pair=null; // evita frente e costas apontando uma para a outra
    it.pair=o; it.solo=!o; if(o){ o.solo=false; if(needsCut()) queueCut(o); } stopPreview(); renderItems(); renderGrid(); renderDock(); schedule(); });
  $("pairLabels").addEventListener("change",e=>{ S.pairLabels=e.target.checked; schedule(); });
  for(const b of $("galFilter").children) b.addEventListener("click",()=>{ G.filter=b.dataset.v; try{ localStorage.setItem("da-gal-filter",G.filter); }catch(e){} renderGalFilter(); renderGallery(); });
  $("galAuto").addEventListener("change",e=>{ try{ localStorage.setItem("da-gal-auto",e.target.checked?"1":"0"); }catch(err){} });
  $("galMore").addEventListener("click",()=>{ G.limit+=48; subscribeGallery(); });
  $("pairSwap").addEventListener("click",swapPair);
  let rt; window.addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(schedule,120); });
  document.addEventListener("visibilitychange",()=>{ if(document.hidden && S.busy) toast("Volte para esta aba: a gravação do vídeo pausa quando a tela fica escondida."); });
}
function renderMarkChips(){
  for(const b of $("markSeg").children){
    const on=b.dataset.v===S.mark; b.classList.toggle("on",on); b.setAttribute("role","radio"); b.setAttribute("aria-checked",on);
    const cv=b.querySelector("canvas"), g=cv.getContext("2d"); g.clearRect(0,0,120,150); g.drawImage(sceneCanvas("studio",120,150),0,0);
    const v=b.dataset.v;
    if(v==="logo"){ if(logoImg.naturalWidth){ const w=84,h=w*logoImg.naturalHeight/logoImg.naturalWidth; g.save(); roundRect(g,18,(150-h)/2,w,h,8); g.clip(); g.drawImage(logoImg,18,(150-h)/2,w,h); g.restore(); } }
    else if(v==="mono") drawMonogram(g,22,37,76,"mono","light");
    else if(v==="wm") drawMonogram(g,22,37,76,"wm","light");
    else if(v==="word") drawMonogram(g,18,33,84,"word","light");
    else if(v==="wmword") drawMonogram(g,18,33,84,"wmword","light");
    else { g.strokeStyle="rgba(36,37,63,.35)"; g.lineWidth=2; g.beginPath(); g.arc(60,75,30,0,Math.PI*2); g.moveTo(39,96); g.lineTo(81,54); g.stroke(); }
  }
}
function renderSegs(){
  renderMarkChips();
  for(const [id,val] of [["layoutSeg",S.layout],["vidPosSeg",S.vidPos]])
    for(const b of $(id).children){ const on=b.dataset.v===val; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); b.setAttribute("role","radio"); }
}
