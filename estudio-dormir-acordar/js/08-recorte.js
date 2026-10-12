"use strict";
/* ============ Recorte da modelo (no aparelho, sem enviar a foto) ============ */
const MODEL_PARTS = ["model/isnet-w8.part0.dat.wasm","model/isnet-w8.part1.dat.wasm","model/isnet-w8.part2.dat.wasm","model/isnet-w8.part3.dat.wasm"];
const MODEL_BYTES = 46732529;
let ortSession=null, ortLoading=null;
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("script")); document.head.appendChild(s); }); }
async function getSession(onProg){
  if(ortSession) return ortSession;
  if(!ortLoading) ortLoading=(async()=>{
    if(!window.ort){ await loadScript("vendor/ort/ort.wasm.min.js").catch(()=>{}); }
    if(!window.ort) throw new Error("runtime");
    ort.env.wasm.numThreads=1; ort.env.wasm.proxy=false;
    ort.env.wasm.wasmPaths={ wasm:new URL("vendor/ort/ort-wasm-simd-threaded.wasm",document.baseURI).href, mjs:new URL("vendor/ort/ort-wasm-simd-threaded.mjs",document.baseURI).href };
    const buf=new Uint8Array(MODEL_BYTES); let off=0;
    for(const p of MODEL_PARTS){
      const res=await fetch(p); if(!res.ok) throw new Error("model "+res.status);
      if(res.body && res.body.getReader){ const rd=res.body.getReader(); for(;;){ const {done,value}=await rd.read(); if(done) break; buf.set(value,off); off+=value.length; onProg && onProg(off/MODEL_BYTES); } }
      else { const b=new Uint8Array(await res.arrayBuffer()); buf.set(b,off); off+=b.length; onProg && onProg(off/MODEL_BYTES); }
    }
    if(off!==MODEL_BYTES) throw new Error("model size");
    ortSession=await ort.InferenceSession.create(buf,{executionProviders:["wasm"], graphOptimizationLevel:"all"});
    return ortSession;
  })();
  try{ return await ortLoading; }catch(e){ ortLoading=null; throw e; }
}
async function cutout(img, w, h){
  const sess=await getSession();
  const N=1024, c=canvas(N,N), g=c.getContext("2d",{willReadFrequently:true}); g.drawImage(img,0,0,N,N);
  const px=g.getImageData(0,0,N,N).data, input=new Float32Array(3*N*N);
  for(let i=0,j=0;i<N*N;i++,j+=4){ input[i]=px[j]/255-.5; input[i+N*N]=px[j+1]/255-.5; input[i+2*N*N]=px[j+2]/255-.5; }
  const feeds={}; feeds[sess.inputNames[0]]=new ort.Tensor("float32",input,[1,3,N,N]);
  const out=(await sess.run(feeds))[sess.outputNames[0]].data;
  let mn=Infinity,mx=-Infinity; for(let i=0;i<N*N;i++){ const v=out[i]; if(v<mn) mn=v; if(v>mx) mx=v; }
  const span=(mx-mn)||1, A=new Float32Array(N*N);
  for(let i=0;i<N*N;i++){ let a=(out[i]-mn)/span; A[i] = a<.08?0 : a>.92?1 : (a-.08)/.84; }
  // limpeza: mantém só as partes grandes (a modelo) e apaga pontinhos soltos do fundo
  const n=256, k=N/n, B=new Uint8Array(n*n), lab=new Int32Array(n*n), areas=[0];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) B[y*n+x] = A[(y*k+(k>>1))*N + x*k+(k>>1)]>.5 ? 1:0;
  const stack=[];
  for(let i=0;i<n*n;i++){ if(!B[i]||lab[i]) continue; const id=areas.length; let area=0; stack.push(i); lab[i]=id;
    while(stack.length){ const j=stack.pop(); area++; const x=j%n, y=(j/n)|0;
      if(x>0&&B[j-1]&&!lab[j-1]){lab[j-1]=id;stack.push(j-1);} if(x<n-1&&B[j+1]&&!lab[j+1]){lab[j+1]=id;stack.push(j+1);}
      if(y>0&&B[j-n]&&!lab[j-n]){lab[j-n]=id;stack.push(j-n);} if(y<n-1&&B[j+n]&&!lab[j+n]){lab[j+n]=id;stack.push(j+n);} }
    areas.push(area); }
  const largest=Math.max(0,...areas); if(!largest) return null;
  const keepId=areas.map(a=>a>=largest*.04);
  const keep=new Uint8Array(n*n); let x0=n,y0=n,x1=-1,y1=-1;
  for(let i=0;i<n*n;i++) if(lab[i]&&keepId[lab[i]]){ keep[i]=1; const x=i%n,y=(i/n)|0; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  const near=new Uint8Array(n*n), R=3; // margem para não cortar as bordas suaves (cabelo, renda)
  for(let i=0;i<n*n;i++) if(keep[i]){ const x=i%n,y=(i/n)|0; for(let dy=-R;dy<=R;dy++) for(let dx=-R;dx<=R;dx++){ const xx=x+dx,yy=y+dy; if(xx>=0&&yy>=0&&xx<n&&yy<n) near[yy*n+xx]=1; } }
  const m=canvas(N,N), mg=m.getContext("2d"), md=mg.createImageData(N,N);
  for(let i=0;i<N*N;i++){ const x=i%N, y=(i/N)|0; md.data[i*4+3] = near[((y/k)|0)*n+((x/k)|0)] ? A[i]*255|0 : 0; }
  mg.putImageData(md,0,0);
  x0*=k; y0*=k; x1=x1*k+k-1; y1=y1*k+k-1;
  const res=canvas(w,h), rg=res.getContext("2d"); rg.drawImage(img,0,0,w,h);
  rg.globalCompositeOperation="destination-in"; rg.imageSmoothingQuality="high"; rg.drawImage(m,0,0,w,h);
  const sx=w/N, sy=h/N;
  return { canvas:res, bbox:{ x:x0*sx, y:y0*sy, w:(x1-x0+1)*sx, h:(y1-y0+1)*sy } };
}
let cutQueue=Promise.resolve();
function needsCut(){ return S.scene!=="original" || [...S.include].some(id=>{ const f=FORMATS.find(x=>x.id===id); return f && f.forceScene; }); }
function queueCut(item){
  if(item.kind!=="photo" || item.cut || item.cutState==="working" || item.cutState==="error") return;
  item.cutState="queued"; renderItems();
  cutQueue=cutQueue.then(async()=>{
    if(!S.items.includes(item)) return;
    item.cutState="working"; renderItems();
    const first=!ortSession;
    setCutStatus(first? "Preparando o recorte (só na primeira vez)…" : "Recortando a modelo…", first?0:null);
    try{
      await getSession(p=>setCutStatus("Baixando o recorte: "+Math.round(p*100)+"% de 47 MB", p));
      setCutStatus("Recortando a modelo…", null);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const res=await cutout(item.src, item.w, item.h);
      if(!res) throw new Error("vazio");
      item.cut=res.canvas; item.bbox=res.bbox; item.cutState="done";
      setCutStatus(null);
    }catch(e){
      console.warn(e); item.cutState="error";
      setCutStatus(e && e.message==="vazio" ? "Não encontrei a modelo nesta foto. Ela aparece com o fundo original." :
        e && /^model (404|403)/.test(e.message) ? "Faltam os arquivos do recorte na pasta model (isnet-w8.part0 a part3). Veja o README." :
        "O recorte não funcionou neste aparelho. Use outro navegador (Chrome ou Safari atualizado) ou envie a foto já recortada em PNG.", null, true);
    }
    renderItems(); schedule();
  });
}
function setCutStatus(text,p,err){
  const el=$("cutStatus"); if(!text){ el.hidden=true; return; }
  el.hidden=false; el.classList.toggle("err",!!err); $("cutText").textContent=text;
  el.querySelector(".bar").hidden = (p==null);
  if(p!=null) $("cutBar").style.width=Math.round(p*100)+"%";
}
