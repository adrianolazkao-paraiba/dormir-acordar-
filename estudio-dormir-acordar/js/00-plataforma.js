"use strict";
/* ============ Plataforma ============
   O Estúdio nasceu como página publicada no claude.ai, que oferece à página:
   downloads (salvar arquivo), db (banco de dados), assets (guardar arquivos) e sample (pedir texto ao Claude).
   Rodando no seu computador (npm start), esse objeto window.claude não existe.
   Este arquivo cria uma versão local equivalente:
   - downloads -> baixa direto pelo navegador
   - db + assets -> guardados no próprio navegador (IndexedDB), para a seção "Já feitos" funcionar
   - sample -> indisponível localmente (a etapa Legendas some). Ver README para ligar com a API da Anthropic.
   Se a página estiver no claude.ai, nada aqui é usado. */
(function(){
  if (window.claude && window.claude.use) return;

  const DB_NAME = "estudio-dormir-acordar", VER = 1;
  let dbp = null;
  function idb(){
    if (dbp) return dbp;
    dbp = new Promise((res, rej)=>{
      const r = indexedDB.open(DB_NAME, VER);
      r.onupgradeneeded = ()=>{ const d=r.result; if(!d.objectStoreNames.contains("docs")) d.createObjectStore("docs"); if(!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs"); };
      r.onsuccess = ()=>res(r.result); r.onerror = ()=>rej(r.error);
    });
    return dbp;
  }
  function tx(store, mode, fn){
    return idb().then(d=>new Promise((res, rej)=>{
      const t=d.transaction(store, mode), s=t.objectStore(store); let out;
      Promise.resolve(fn(s)).then(v=>{ out=v; });
      t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error);
    }));
  }
  const req = r => new Promise((res, rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  /* ---- db: só o que o Estúdio usa (collection, orderBy, limit, onSnapshot, add, doc().delete) ---- */
  const listeners = new Set();
  async function allDocs(col){
    const rows = await tx("docs","readonly", s=>new Promise(res=>{ const out=[]; const c=s.openCursor();
      c.onsuccess=()=>{ const cur=c.result; if(!cur) return res(out); if(cur.value.col===col) out.push({id:cur.key.split("/").pop(), data:cur.value.data}); cur.continue(); }; }));
    return rows;
  }
  function snapshot(rows, q){
    let arr = rows.slice();
    if (q.order){ const [f,dir]=q.order; arr.sort((a,b)=>{ const x=a.data[f], y=b.data[f]; return (x>y?1:x<y?-1:0)*(dir==="desc"?-1:1); }); }
    if (q.lim) arr = arr.slice(0, q.lim);
    const docs = arr.map(r=>({ id:r.id, exists:true, data:()=>r.data, metadata:{fromCache:false, hasPendingWrites:false} }));
    return { docs, size:docs.length, empty:!docs.length, docChanges:()=>[], metadata:{fromCache:false, hasPendingWrites:false} };
  }
  async function notify(col){ for (const l of listeners) if (l.q.col===col) l.next(snapshot(await allDocs(col), l.q)); }
  function docRef(path){
    const parts=path.split("/"), id=parts.pop(), col=parts.join("/");
    return { id, path,
      get: async()=>{ const v=await tx("docs","readonly", s=>req(s.get(path))); return { id, exists:!!v, data:()=>v&&v.data }; },
      set: async(data)=>{ await tx("docs","readwrite", s=>req(s.put({col, data:JSON.parse(JSON.stringify(data))}, path))); notify(col); },
      update: async(data)=>{ const v=await tx("docs","readonly", s=>req(s.get(path))); if(!v) throw {code:"invalid_argument", message:"documento não existe"}; await tx("docs","readwrite", s=>req(s.put({col, data:Object.assign({}, v.data, data)}, path))); notify(col); },
      delete: async()=>{ await tx("docs","readwrite", s=>req(s.delete(path))); notify(col); } };
  }
  function query(q){
    return {
      orderBy:(f,dir)=>query(Object.assign({}, q, {order:[f, dir||"asc"]})),
      limit:(n)=>query(Object.assign({}, q, {lim:n})),
      where:()=>query(q),
      get: async()=>snapshot(await allDocs(q.col), q),
      onSnapshot:(next, err)=>{ const l={q, next}; listeners.add(l); allDocs(q.col).then(r=>next(snapshot(r,q))).catch(e=>err&&err({code:"unavailable", message:String(e)})); return ()=>listeners.delete(l); },
      doc:(id)=>docRef(q.col+"/"+(id||uid())),
      add: async(data)=>{ const ref=docRef(q.col+"/"+uid()); await ref.set(data); return ref; },
    };
  }
  const db = { collection:(col)=>query({col}), doc:(path)=>docRef(path) };

  /* ---- assets: arquivos guardados no navegador ---- */
  const urls = new Map();
  const assets = {
    upload: async(blob, opt)=>{ const id=uid(); const type=(opt&&opt.type)||blob.type||"application/octet-stream"; const b=blob.type===type?blob:new Blob([blob],{type});
      await tx("blobs","readwrite", s=>req(s.put(b, id))); const url=URL.createObjectURL(b); urls.set(id,url); return { id, url, sizeBytes:b.size, contentType:type }; },
    list: async()=>{ const sizes = await tx("blobs","readonly", s=>new Promise(res=>{ const out=[]; const c=s.openCursor(); c.onsuccess=()=>{ const cur=c.result; if(!cur) return res(out); out.push(cur.value.size); cur.continue(); }; }));
      let quota = 1024*1048576; try{ const e=await navigator.storage.estimate(); if(e&&e.quota) quota=e.quota; }catch(e){}
      return { assets:[], usage:{ files:sizes.length, bytes:sizes.reduce((a,b)=>a+b,0), maxFiles:100000, maxBytes:quota } }; },
    delete: async(id)=>{ await tx("blobs","readwrite", s=>req(s.delete(id))); const u=urls.get(id); if(u){ URL.revokeObjectURL(u); urls.delete(id); } return { deleted:true }; },
  };

  /* ---- downloads: baixa direto ---- */
  const downloads = { save: async({filename, data})=>{
    const blob = data instanceof Blob ? data : new Blob([data]);
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 4000); return { status:"saved" }; } };

  const caps = { downloads, db, assets, sample:null };
  window.claude = { use:(name)=>Promise.resolve(caps[name]||null) };
  window.__local = {
    blobUrl: async(id)=>{ if(urls.has(id)) return urls.get(id); const b=await tx("blobs","readonly", s=>req(s.get(id))); if(!b) return ""; const u=URL.createObjectURL(b); urls.set(id,u); return u; },
    blobGet: async(id)=>{ const b=await tx("blobs","readonly", s=>req(s.get(id))); if(!b) throw new Error("arquivo não encontrado"); return b; },
  };
})();
