"use strict";
/* ============ Interface ============ */
function photoNumber(it){ return S.items.filter(i=>i.kind==="photo"&&!i.example).indexOf(it)+1; }
function renderPair(){
  const it=S.sel, box=$("pairBox"), others=S.items.filter(o=>o!==it && o.kind==="photo" && !o.example);
  // aparece na frente (ou foto sem par); na foto de costas não, para não ligar costas às costas
  box.hidden = !(it && it.kind==="photo" && !it.example && others.length && !isBackOfAnother(it));
  if(box.hidden) return;
  const sel=$("pairSel"); sel.innerHTML="";
  const o0=document.createElement("option"); o0.value=""; o0.textContent="Só esta foto"; sel.appendChild(o0);
  for(const o of others){ const op=document.createElement("option"); op.value=o.id; op.textContent="Costas: Foto "+photoNumber(o)+" ("+o.name.slice(0,24)+")"; sel.appendChild(op); }
  sel.value = backOf(it) ? String(it.pair.id) : "";
  $("pairSwap").hidden = !backOf(it);
  $("pairLabels").checked=S.pairLabels;
}
/* barra do Material: para cada peça, 3 itens — Frente, Frente e costas, Costas. Foto sem par: 1 item.
   Vídeos só aparecem na barra quando não há fotos (senão ficam no painel "Vídeo da peça"). */
function barEntries(){
  const ph=S.items.filter(i=>i.kind==="photo"), out=[];
  for(const p of ph){
    if(p.example){ out.push({item:p, mode:"single", tag:"Exemplo"}); continue; }
    if(isBackOfAnother(p)) continue;
    const b=backOf(p);
    if(b) out.push({item:p, mode:"single", tag:"Frente"}, {item:p, mode:"pair", tag:"Frente e costas", back:b}, {item:b, mode:"single", tag:"Costas"});
    else out.push({item:p, mode:"single", tag:"Foto "+photoNumber(p)});
  }
  if(!ph.some(i=>!i.example)) for(const v of S.items.filter(i=>i.kind==="video")) out.push({item:v, mode:"single", tag:fmtTime(v.dur)+" s"});
  return out;
}
function entryOn(e){ return e.item===S.sel && (e.mode==="pair") === showPair(); }
function renderItems(){
  const box=$("items"); box.innerHTML="";
  for(const e of barEntries()){
    const it=e.item, on=entryOn(e);
    const b=document.createElement("button"); b.type="button"; b.className="item"+(e.mode==="pair"?" duo":"")+(on?" on":""); b.setAttribute("aria-pressed",on); b.setAttribute("aria-label",e.tag+(it.kind==="video"?" · vídeo":""));
    const W=e.mode==="pair"?256:128, th=canvas(W,160), g=th.getContext("2d");
    const cover=(x,p)=>{ if(p.kind==="video"){ try{ drawCover(g,p.el,p.w,p.h,128,160,newAdj(),false); }catch(err){ g.fillStyle=C.navy; g.fillRect(0,0,128,160); } return; }
      g.save(); g.translate(x,0); if(p.example){ g.drawImage(sceneCanvas("studio",128,160),0,0); const L=subjectLayout(p,128,160,{},null); g.drawImage(p.cut,L.x,L.y,p.cut.width*L.s,p.cut.height*L.s); } else drawCover(g,p.src,p.w,p.h,128,160,newAdj(),false); g.restore(); };
    cover(0,it); if(e.back){ cover(128,e.back); g.fillStyle="rgba(241,232,212,.95)"; g.fillRect(127,0,2,160); }
    b.appendChild(th);
    const tag=document.createElement("span"); tag.className="tag"; tag.textContent=e.tag; b.appendChild(tag);
    const busy=[it,e.back].find(p=>p&&(p.cutState==="working"||p.cutState==="queued"));
    if(busy){ const st=document.createElement("span"); st.className="st"; st.textContent=busy.cutState==="working"?"Recortando":"Na fila"; b.appendChild(st); }
    if(!it.example && e.mode!=="pair"){ const x=document.createElement("span"); x.className="x"; x.textContent="×"; x.setAttribute("role","button"); x.setAttribute("aria-label","Remover "+e.tag+" ("+it.name+")");
      x.addEventListener("click",ev=>{ ev.stopPropagation(); removeItem(it); }); b.appendChild(x); }
    b.addEventListener("click",()=>select(it,e.mode));
    box.appendChild(b);
  }
  const ph=S.items.filter(i=>i.kind==="photo"&&!i.example).length, vd=S.items.filter(i=>i.kind==="video").length;
  $("itemHint").innerHTML = S.items[0]&&S.items[0].example
    ? "Mostrando um <strong>exemplo ilustrado</strong>. Envie suas fotos e vídeos para trocar."
    : `<strong>${ph}</strong> foto${ph===1?"":"s"} e <strong>${vd}</strong> vídeo${vd===1?"":"s"}.`
      + (ph>1 ? " A 1ª foto é a frente e a 2ª as costas (e assim por diante)." : " Toque em um item para ver e ajustar.")
      + (ph>1&&vd ? " O vídeo fica em <strong>Frente e costas</strong>, abaixo das fotos." : "");
}
function renderScenesThumbs(){
  for(const cv of document.querySelectorAll('#scenes canvas[data-scene]')){ const id=cv.dataset.scene, p=photoImgs[id]; if(p&&p.ok){ const g=cv.getContext("2d"); g.clearRect(0,0,120,150); g.drawImage(sceneCanvas(id,120,150),0,0); } }
  if(typeof renderMarkChips==="function") renderMarkChips();
}
function renderScenes(){
  const box=$("scenes"); if(!box.childElementCount){
    for(const sc of SCENES){
      const b=document.createElement("button"); b.type="button"; b.className="scene"; b.dataset.id=sc.id; b.setAttribute("role","radio");
      const cv=canvas(120,150); const g=cv.getContext("2d");
      if(sc.id==="original"){ g.fillStyle="#C9B9A0"; g.fillRect(0,0,120,150); g.fillStyle="#A8977C"; g.fillRect(0,96,120,54); g.fillStyle="#E7DCC8"; g.fillRect(12,14,40,58); }
      else if(sc.id==="custom"){ g.fillStyle="#E6DCCB"; g.fillRect(0,0,120,150); g.strokeStyle=C.navy; g.lineWidth=2; g.setLineDash([5,4]); g.strokeRect(10,10,100,130); g.setLineDash([]); g.fillStyle=C.navy; g.font=`500 30px ${F.sans}`; g.textAlign="center"; g.fillText("+",60,86); }
      else g.drawImage(sceneCanvas(sc.id,120,150),0,0);
      cv.dataset.scene=sc.id;
      const sp=document.createElement("span"); sp.textContent=sc.name;
      b.append(cv,sp);
      b.addEventListener("click",()=>{
        if(sc.id==="custom" && !S.customBg){ $("customBg").click(); return; }
        S.scene=sc.id; savePrefs(); onSceneChange();
      });
      box.appendChild(b);
    }
  }
  for(const b of box.children){ const on=b.dataset.id===S.scene; b.classList.toggle("on",on); b.setAttribute("aria-checked",on); }
  $("customBgBtn").hidden = S.scene!=="custom";
  const v=S.sel&&S.sel.kind==="video";
  $("sceneHint").textContent = v ? "Vídeos mantêm o cenário gravado. O cenário escolhido vale para as fotos." : "Nas fotos, a modelo é recortada no próprio aparelho e colocada no cenário. A foto não sai do seu celular ou computador.";
}
function onSceneChange(){ renderScenes(); if(needsCut()) S.items.forEach(queueCut); schedule(); }
function syncAdj(){
  const it=S.sel; if(!it) return;
  $("adjSize").value=it.adj.size; $("adjX").value=it.adj.x; $("adjY").value=it.adj.y;
  $("oSize").textContent=it.adj.size+"%"; $("oX").textContent=it.adj.x; $("oY").textContent=it.adj.y;
  const v=it.kind==="video"; $("trimRow").hidden=!v; $("player").hidden=!v; $("vidPosField").hidden=!v;
  if(v){ const t=$("trim"); t.max=Math.max(0,(it.dur-1)).toFixed(1); t.value=it.trim; $("oTrim").textContent=fmtTime(it.trim)+" s"; }
}
function formatsFor(it){ return FORMATS.filter(f=>f.media.includes(it.kind)); }
let cards=new Map();
function renderGrid(){
  const grid=$("grid"); grid.innerHTML=""; cards.clear();
  const it=viewItem(); if(!it){ grid.innerHTML='<p class="empty">Envie uma foto ou vídeo para começar.</p>'; return; }
  for(const fmt of formatsFor(it)){
    const card=document.createElement("article"); card.className="card";
    const plat=document.createElement("div"); plat.className="plat"; plat.textContent=fmt.plat;
    const nm=document.createElement("div"); nm.className="nm"; nm.textContent=fmt.name;
    const frame=document.createElement("div"); frame.className="frame";
    const cv=canvas(10,10); cv.style.aspectRatio=fmt.w+"/"+fmt.h; frame.appendChild(cv);
    const zones=document.createElement("div"); zones.className="zones"; frame.appendChild(zones);
    const warn=document.createElement("div"); warn.className="warn"; warn.hidden=true; frame.appendChild(warn);
    const meta=document.createElement("div"); meta.className="meta";
    const dur = it.kind==="video" ? " · "+fmtTime(fmt.maxDur? Math.min(fmt.maxDur,it.dur-it.trim) : it.dur-it.trim)+" s" : "";
    meta.innerHTML=`<span>${fmt.w} × ${fmt.h} · ${fmt.ratio}${dur}</span><span>${it.kind==="video"?"MP4":"JPG"}</span>`;
    const note=document.createElement("p"); note.className="note"; note.textContent=fmt.note||"";
    const foot=document.createElement("div"); foot.className="foot";
    const inc=document.createElement("label"); inc.className="check"; const cb=document.createElement("input"); cb.type="checkbox"; cb.id="inc-"+fmt.id; cb.checked=S.include.has(fmt.id);
    cb.addEventListener("change",()=>{ cb.checked?S.include.add(fmt.id):S.include.delete(fmt.id); if(needsCut()) S.items.forEach(queueCut); renderDock(); });
    inc.append(cb,document.createTextNode(" No pacote"));
    foot.appendChild(inc);
    if(it.kind==="photo"){ const dl=document.createElement("button"); dl.type="button"; dl.className="btn ghost sm"; dl.textContent="Baixar"; dl.addEventListener("click",()=>downloadOne(it,fmt,viewOpt())); foot.appendChild(dl); }
    card.append(plat,nm,frame,meta,note,foot);
    grid.appendChild(card);
    cards.set(fmt.id,{cv,zones,warn,fmt});
    drawZones(zones,fmt);
  }
  videoPanel(); // painel "Vídeo da peça" (só no item Frente e costas, com vídeo enviado)
}
function drawZones(el,fmt){
  el.innerHTML=""; if(!S.zones) return;
  if(fmt.vertical){
    const add=(st,label)=>{ const z=document.createElement("div"); z.className="z"; Object.assign(z.style,st); if(label){ const b=document.createElement("b"); b.textContent=label; z.appendChild(b);} el.appendChild(z); };
    add({left:0,right:0,top:0,height:(SAFE_V.t*100)+"%"},"Topo do app");
    add({left:0,right:0,bottom:0,height:(SAFE_V.b*100)+"%"},"Legenda e carrinho");
    add({right:0,top:"45%",bottom:(SAFE_V.b*100)+"%",width:(SAFE_V.icons*100)+"%"},"");
  }
  if(fmt.grid34){ const cut=(1-(3/4)/(4/5))/2; // post 4:5 mostrado em 3:4 no perfil perde um pouco das laterais
    const g=document.createElement("div"); g.className="g34"; Object.assign(g.style,{left:(cut*100)+"%",right:(cut*100)+"%"}); el.appendChild(g);
  }
}
let rafPending=false;
function schedule(){ if(rafPending) return; rafPending=true; requestAnimationFrame(()=>{ rafPending=false; drawPreviews(); }); }
function drawPreviews(){
  const it=viewItem(); if(!it) return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const t = it.kind==="video" ? it.el.currentTime : null;
  for(const {cv,warn,fmt} of cards.values()){
    const cssW=cv.clientWidth||240, w=Math.min(fmt.w,Math.round(cssW*dpr)), h=Math.round(w*fmt.h/fmt.w);
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
    const endAt = it.kind==="video" ? (fmt.maxDur? Math.min(it.trim+fmt.maxDur,it.dur) : it.dur) : null;
    const msg=renderFormat(cv.getContext("2d"),w,h,it,fmt,t,endAt,it.kind==="photo"?viewOpt():undefined);
    warn.hidden=!msg; if(msg) warn.textContent=msg;
  }
  if(it.kind==="photo") drawVideoStill();
}
function renderDock(){
  const it=S.sel, acts=$("dockActs"); acts.innerHTML="";
  const pecas=S.items.filter(i=>i.kind==="photo" && !isBackOfAnother(i));
  const pf=FORMATS.filter(f=>f.media.includes("photo")&&S.include.has(f.id)).length;
  const vf=FORMATS.filter(f=>f.media.includes("video")&&S.include.has(f.id)).length;
  const n=pecas.reduce((a,p)=>a+(backOf(p)?3:1),0)*pf; // frente, frente e costas, costas
  if(it && it.kind==="video"){
    $("sum").innerHTML=`<b>${vf} vídeo${vf===1?"":"s"} deste item</b><span>Gravados um de cada vez: deixe esta tela aberta até terminar.</span>`;
    const b=document.createElement("button"); b.className="btn"; b.type="button"; b.id="makeVideos"; b.textContent=S.busy?"Gerando…":"Gerar vídeos"; b.disabled=S.busy||!vf; b.addEventListener("click",()=>makeVideos(it)); acts.appendChild(b);
    const c=document.createElement("button"); c.className="btn sec"; c.type="button"; c.textContent="Salvar capa do Reels"; c.disabled=S.busy; c.addEventListener("click",()=>saveCover(it)); acts.appendChild(c);
  } else {
    const comPar=pecas.some(p=>backOf(p));
    $("sum").innerHTML=`<b>${n} ${n===1?"imagem":"imagens"} no pacote</b><span>${pecas.length} peça${pecas.length===1?"":"s"}${comPar?" (frente, frente e costas, costas)":""} × ${pf} formato${pf===1?"":"s"}</span>`;
    const b=document.createElement("button"); b.className="btn"; b.type="button"; b.id="zipAll"; b.textContent=S.busy?"Preparando…":"Baixar tudo (.zip)"; b.disabled=S.busy||!n; b.addEventListener("click",zipPhotos); acts.appendChild(b);
    if(montageSource()){ const m=document.createElement("button"); m.className="btn sec"; m.type="button"; m.id="dockVideo"; m.textContent="Vídeos"; m.title="Ir para o painel Vídeo da peça"; m.disabled=S.busy;
      m.addEventListener("click",()=>$("vpanel").scrollIntoView({behavior:"smooth",block:"start"})); acts.appendChild(m); }
  }
}
function renderAll(){ renderItems(); renderPair(); renderScenes(); syncAdj(); renderGrid(); renderDock(); renderPlayIcon(); schedule(); }
