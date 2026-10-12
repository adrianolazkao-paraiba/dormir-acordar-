"use strict";
/* ============ Já feitos (histórico guardado) ============ */
/* No claude.ai os arquivos ficam em /_blob/<id>; rodando local, o adaptador (00-plataforma.js) guarda no navegador. */
function blobSrc(id){ return window.__local ? window.__local.blobUrl(id) : Promise.resolve("/_blob/"+id); }
async function blobGet(id){ if(window.__local) return window.__local.blobGet(id); const r=await fetch("/_blob/"+id); if(!r.ok) throw new Error(r.status); return r.blob(); }
const G={db:null, assets:null, docs:[], limit:48, filter:"all", unsub:null, queue:Promise.resolve(), pending:0, armed:null};
async function initGallery(){
  try{ G.filter=localStorage.getItem("da-gal-filter")||"all"; }catch(e){}
  try{ const a=localStorage.getItem("da-gal-auto"); if(a!==null) $("galAuto").checked = a==="1"; }catch(e){}
  renderGalFilter();
  if(!(window.claude&&window.claude.use)){ $("galEmpty").textContent="O histórico funciona quando a página é aberta no claude.ai."; $("galAuto").disabled=true; return; }
  const [db,as]=await Promise.all([window.claude.use("db").catch(()=>null), window.claude.use("assets").catch(()=>null)]);
  G.db=db; G.assets=as;
  if(!db){ $("galEmpty").textContent="O histórico não está disponível nesta visualização."; $("galAuto").disabled=true; return; }
  if(!as){ $("galAuto").disabled=true; $("galNote").textContent="Você pode ver e baixar o que já foi feito. Só quem edita esta página consegue guardar coisas novas."; }
  subscribeGallery(); usage();
}
function subscribeGallery(){
  if(G.unsub) G.unsub();
  G.unsub=G.db.collection("trabalhos").orderBy("criadoEm","desc").limit(G.limit).onSnapshot(
    snap=>{ G.docs=snap.docs.map(d=>Object.assign({_id:d.id},d.data())); renderGallery(); },
    ()=>{ $("galEmpty").hidden=false; $("galEmpty").textContent="Não consegui carregar o histórico agora. Recarregue a página."; });
}
async function usage(){
  if(!G.assets) return;
  try{ const r=await G.assets.list(); const u=r.usage; $("galUsage").textContent=`${(u.bytes/1048576).toFixed(0)} MB usados de ${(u.maxBytes/1048576).toFixed(0)} MB`; }catch(e){}
}
function galStatus(){ const el=$("galStatus"); el.hidden=!G.pending; if(G.pending) el.textContent=`Guardando ${G.pending} arquivo${G.pending===1?"":"s"} em Já feitos…`; }
/* guarda um arquivo pronto: o arquivo vai para o armazenamento da página e os dados para o histórico */
function keep(blob, meta, thumbBlob){
  if(!G.db || !G.assets || !$("galAuto").checked || !blob) return;
  G.pending++; galStatus();
  G.queue=G.queue.then(async()=>{
    try{
      const type = meta.ext==="jpg" ? "image/jpeg" : meta.ext==="mp4" ? "video/mp4" : meta.ext==="webm" ? "video/webm" : undefined;
      const up=await G.assets.upload(blob, type?{type}:undefined);
      let thumb=null; if(thumbBlob){ try{ thumb=(await G.assets.upload(thumbBlob,{type:"image/jpeg"})).id; }catch(e){} }
      await G.db.collection("trabalhos").add(Object.assign({}, meta, {arquivo:up.id, capa:thumb, bytes:up.sizeBytes, criadoEm:new Date().toISOString()}));
    }catch(e){
      const c=e&&e.code;
      toast(c==="quota_or_state"||c==="quota_exceeded" ? "O espaço do histórico acabou. Exclua alguns itens antigos em Já feitos." : c==="too_large" ? "Arquivo grande demais para guardar no histórico (limite de 20 MB)." : "Não consegui guardar um arquivo no histórico.");
    } finally { G.pending--; galStatus(); }
  });
  G.queue.then(usage);
}
function metaFor(it,fmt,ext,filename){
  return { nome:S.P.name||"Sem nome", preco:S.P.price||"", arquivoNome:filename, ext, tipo: ext==="jpg"?"foto":"video",
    formato:fmt.id, plataforma:fmt.plat, formatoNome:fmt.name, largura:fmt.w, altura:fmt.h, cenario: it&&it.kind==="photo" ? (fmt.forceScene||S.scene) : "vídeo" };
}
function renderGalFilter(){ for(const b of $("galFilter").children){ const on=b.dataset.v===G.filter; b.classList.toggle("on",on); b.setAttribute("role","radio"); b.setAttribute("aria-checked",on); } }
function renderGallery(){
  const grid=$("galGrid"); grid.innerHTML="";
  const list=G.docs.filter(d=>G.filter==="all"||d.tipo===G.filter);
  $("galEmpty").hidden=list.length>0;
  if(!list.length) $("galEmpty").textContent = G.docs.length ? "Nada neste filtro." : "Nada guardado ainda. Baixe uma arte ou gere um vídeo e ele aparece aqui.";
  let day="";
  for(const d of list){
    const dt=new Date(d.criadoEm||Date.now()), dl=dt.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
    if(dl!==day){ day=dl; const h=document.createElement("div"); h.className="gal-day"; h.textContent=dl; grid.appendChild(h); }
    const c=document.createElement("article"); c.className="gcard";
    const th=document.createElement("div"); th.className="gthumb";
    const src = d.tipo==="foto" ? d.arquivo : d.capa;
    if(src){ const im=document.createElement("img"); im.loading="lazy"; im.alt=(d.plataforma||"")+" "+(d.formatoNome||""); blobSrc(src).then(u=>{ im.src=u; }); im.onerror=()=>{ im.remove(); th.insertAdjacentHTML("beforeend",'<span class="play">Arquivo removido</span>'); }; th.appendChild(im); }
    if(d.tipo==="video"){ const pl=document.createElement("span"); pl.className="play"; pl.textContent="VÍDEO"; th.appendChild(pl); }
    const t=document.createElement("div"); t.className="t"; t.textContent=d.nome||"Sem nome";
    const m=document.createElement("div"); m.className="m"; m.textContent=`${d.plataforma||""} · ${d.formatoNome||""}
${d.largura||""}×${d.altura||""} · ${dt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`; m.style.whiteSpace="pre-line";
    const a=document.createElement("div"); a.className="a";
    const b1=document.createElement("button"); b1.type="button"; b1.className="btn ghost sm"; b1.textContent="Baixar"; b1.addEventListener("click",()=>galDownload(d,b1));
    a.appendChild(b1);
    if(G.assets){ const b2=document.createElement("button"); b2.type="button"; b2.className="btn ghost sm del"; b2.textContent="Excluir"; b2.addEventListener("click",()=>galDelete(d,b2)); a.appendChild(b2); }
    c.append(th,t,m,a); grid.appendChild(c);
  }
  $("galMore").hidden = G.docs.length < G.limit;
}
async function galDownload(d,btn){
  btn.disabled=true; btn.textContent="Abrindo…";
  try{ const blob=await blobGet(d.arquivo); await saveFile(d.arquivoNome||("dormir-acordar."+(d.ext||"jpg")), blob); }
  catch(e){ toast("Esse arquivo não está mais disponível."); }
  finally{ btn.disabled=false; btn.textContent="Baixar"; }
}
async function galDelete(d,btn){
  if(G.armed!==btn){ if(G.armed){ G.armed.classList.remove("confirm"); G.armed.textContent="Excluir"; }
    G.armed=btn; btn.classList.add("confirm"); btn.textContent="Confirmar"; setTimeout(()=>{ if(G.armed===btn){ btn.classList.remove("confirm"); btn.textContent="Excluir"; G.armed=null; } },4000); return; }
  G.armed=null; btn.disabled=true; btn.textContent="Excluindo…";
  try{
    await G.db.doc("trabalhos/"+d._id).delete();
    for(const id of [d.arquivo,d.capa]) if(id){ try{ await G.assets.delete(id); }catch(e){} }
    toast("Excluído de Já feitos."); usage();
  }catch(e){ btn.disabled=false; btn.textContent="Excluir"; toast("Não consegui excluir agora. Tente de novo."); }
}
