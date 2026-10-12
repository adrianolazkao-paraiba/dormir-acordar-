"use strict";
/* ============ Exportação ============ */
let downloadsNS, downloadsReady;
function initDownloads(){
  downloadsReady = (window.claude && window.claude.use) ? window.claude.use("downloads").then(d=>downloadsNS=d).catch(()=>null) : Promise.resolve(null);
}
async function saveFile(filename, blob){
  await downloadsReady;
  if(downloadsNS){
    try{ await downloadsNS.save({filename, data:blob}); toast("Arquivo salvo: "+filename); return true; }
    catch(e){ if(e&&e.code==="declined") return false; if(e&&e.code==="rate_limited"){ toast("Já há um download aguardando sua confirmação."); return false; }
      if(e&&e.code==="too_large"){ toast("Arquivo grande demais para salvar daqui. Gere menos formatos por vez."); return false; } }
  }
  if(!window.claude){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},4000); return true; }
  toast("Os downloads não estão disponíveis nesta visualização. Abra a página no claude.ai."); return false;
}
function toBlob(c,type,q){ return new Promise(r=>c.toBlob(r,type,q)); }
async function renderFull(it,fmt,opt){ const c=canvas(fmt.w,fmt.h); renderFormat(c.getContext("2d"),fmt.w,fmt.h,it,fmt,null,null,opt); return toBlob(c,"image/jpeg",.92); }
function fileName(it,fmt,idx,ext,variante){ return `dormir-acordar_${slug(S.P.name)}_${String(idx).padStart(2,"0")}${variante?"_"+variante:""}_${fmt.id}.${ext}`; }
/* nome da variante: frente, frente-e-costas, costas (ou nada para foto sem par) */
function variantOf(it,opt){ if(it.kind!=="photo"||it.example) return ""; if(backOf(it)) return opt&&opt.single? "frente" : "frente-e-costas"; return isBackOfAnother(it)? "costas" : ""; }
async function ensureCuts(list){
  if(!needsCut()) return;
  list.forEach(queueCut); await cutQueue;
}
async function downloadOne(it,fmt,opt){
  if(fmt.forceScene || S.scene!=="original"){ if(!it.cut && it.cutState!=="error"){ toast("Aguarde o recorte terminar."); queueCut(it); return; } }
  const front=S.items.find(o=>o.pair===it && o.kind==="photo"), num=Math.max(1,photoNumber(front||it));
  const name=fileName(it,fmt,num,"jpg",variantOf(it,opt)), blob=await renderFull(it,fmt,opt);
  if(await saveFile(name, blob)) keep(blob, metaFor(it,fmt,"jpg",name));
}
async function zipPhotos(){
  if(S.busy) return;
  const photos=S.items.filter(i=>i.kind==="photo" && !isBackOfAnother(i)); const fmts=FORMATS.filter(f=>f.media.includes("photo")&&S.include.has(f.id));
  if(!photos.length||!fmts.length) return;
  if(!window.JSZip){ await loadScript("vendor/jszip.min.js").catch(()=>{}); }
  if(!window.JSZip){ toast("Não consegui preparar o .zip agora. Use o botão Baixar de cada formato."); return; }
  S.busy=true; renderDock(); progress(0);
  try{
    const working=photos.filter(p=>p.cutState==="queued"||p.cutState==="working"); if(working.length){ toast("Terminando os recortes antes do pacote…"); }
    await ensureCuts(S.items.filter(i=>i.kind==="photo"));
    const zip=new JSZip(), made=[]; let done=0, total=photos.length*fmts.length;
    // cada peça com frente e costas sai em 3 versões: frente, frente e costas, costas
    const versoes=[]; for(const [i,it] of photos.entries()){ const b=backOf(it);
      if(b) versoes.push([i,it,{single:true}],[i,it,{}],[i,b,{single:true}]); else versoes.push([i,it,{single:true}]); }
    total=versoes.length*fmts.length;
    for(const [i,it,opt] of versoes) for(const fmt of fmts){
      const folder = {feed:"instagram-feed",vertical:"reels-stories-tiktok","tts-main":"tiktok-shop","tts-extra":"tiktok-shop",pin:"pinterest",mkt:"marketplace"}[fmt.id]||"outros";
      const name=fileName(it,fmt,i+1,"jpg",variantOf(it,opt)), b=await renderFull(it,fmt,opt);
      zip.file(folder+"/"+name, b); made.push([b,metaFor(it,fmt,"jpg",name)]);
      progress(++done/total*.85); await new Promise(r=>setTimeout(r,0));
    }
    const blob=await zip.generateAsync({type:"blob",compression:"STORE"},m=>progress(.85+m.percent/100*.15));
    if(await saveFile(`dormir-acordar_${slug(S.P.name)}_fotos.zip`, blob)) made.forEach(([b,m])=>keep(b,m));
  } finally { S.busy=false; progress(null); renderDock(); }
}
function progress(p){ $("progWrap").hidden = p==null; if(p!=null) $("prog").style.width=Math.round(p*100)+"%"; }
