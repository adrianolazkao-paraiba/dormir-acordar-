"use strict";
/* ============ Itens ============ */
let uid=0;
function newAdj(){ return {size:100,x:0,y:0}; }
function addExample(){
  const ex=makeExample();
  S.items.push({ id:++uid, kind:"photo", name:"Exemplo", example:true, src:ex.canvas, w:ex.canvas.width, h:ex.canvas.height, cut:ex.canvas, bbox:ex.bbox, cutState:"done", adj:newAdj() });
  S.sel=S.items[0];
}
function loadImage(file){
  return new Promise((res,rej)=>{ const url=URL.createObjectURL(file), im=new Image();
    im.onload=()=>{ const max=2200, k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)); const c=canvas(im.naturalWidth*k,im.naturalHeight*k);
      c.getContext("2d").drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c); };
    im.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error("img")); }; im.src=url; });
}
/* No iPhone/iPad o Safari só carrega o primeiro quadro quando o vídeo é posicionado, por isso
   o pedido de posição logo depois dos metadados, e um tempo limite para nunca ficar esperando. */
function loadVideo(file){
  return new Promise((res,rej)=>{ const url=URL.createObjectURL(file), v=document.createElement("video");
    v.muted=true; v.playsInline=true; v.setAttribute("playsinline",""); v.preload="auto";
    let done=false;
    const fail=()=>{ if(done) return; done=true; clearTimeout(timer); URL.revokeObjectURL(url); rej(new Error("video")); };
    const ok=async()=>{
      if(done || !v.videoWidth) return; done=true; clearTimeout(timer);
      if(!isFinite(v.duration)){ // alguns WebM chegam sem duração: vai ao fim para o navegador descobrir
        await new Promise(r=>{ const t=setTimeout(r,3000); v.addEventListener("durationchange",function f(){ if(isFinite(v.duration)){ clearTimeout(t); v.removeEventListener("durationchange",f); r(); } }); v.currentTime=1e7; });
        await new Promise(r=>{ const t=setTimeout(r,1500); v.addEventListener("seeked",()=>{ clearTimeout(t); r(); },{once:true}); v.currentTime=0; });
      }
      isFinite(v.duration) ? res({v,url}) : (URL.revokeObjectURL(url), rej(new Error("video")));
    };
    v.onloadedmetadata=()=>{ try{ v.currentTime=Math.min(.05,(isFinite(v.duration)?v.duration:1)/2); }catch(e){} };
    v.onloadeddata=ok; v.onseeked=()=>{ v.onseeked=null; ok(); }; v.onerror=fail;
    const timer=setTimeout(()=>{ v.videoWidth? ok() : fail(); },20000);
    v.src=url; v.load(); });
}
async function addFiles(files){
  const list=[...files]; if(!list.length) return;
  const dropExample=()=>{ if(S.items.length && S.items[0].example){ S.items=S.items.filter(i=>!i.example); } };
  let firstNew=null;
  for(const f of list){
    try{
      if(f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name)){
        const {v,url}=await loadVideo(f);
        const it={ id:++uid, kind:"video", name:f.name, el:v, url, w:v.videoWidth, h:v.videoHeight, dur:v.duration, adj:newAdj(), trim:0 };
        dropExample(); S.items.push(it); firstNew=firstNew||it;
      } else {
        const c=await loadImage(f);
        const it={ id:++uid, kind:"photo", name:f.name, src:c, w:c.width, h:c.height, cut:null, bbox:null, cutState:"none", adj:newAdj() };
        dropExample(); S.items.push(it); firstNew=firstNew||it;
        if(needsCut()) queueCut(it);
      }
    }catch(e){
      toast(/heic|heif/i.test(f.name)? "Este navegador não abre fotos HEIC. Exporte a foto como JPG e envie de novo." : "Não consegui abrir “"+f.name+"”. Envie JPG, PNG, MP4 ou MOV.");
    }
  }
  if(firstNew) select(firstNew);
  renderAll();
}
function removeItem(it){
  stopPlayback();
  if(it.url) URL.revokeObjectURL(it.url);
  S.items=S.items.filter(x=>x!==it); S.items.forEach(o=>{ if(o.pair===it) o.pair=null; });
  if(!S.items.length) addExample();
  if(S.sel===it) S.sel=S.items[0];
  renderAll();
}
function select(it){ stopPlayback(); S.sel=it; syncAdj(); renderAll(); }
