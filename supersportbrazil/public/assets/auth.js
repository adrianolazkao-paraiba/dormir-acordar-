// SuperSportBrazil — login (Supabase) e chamadas à API do site.
// Precisa do supabase-js carregado antes (window.supabase).
(function(){
  let clientPromise=null;
  async function client(){
    if(!clientPromise) clientPromise=fetch('/api/config').then(r=>r.json()).then(c=>{
      if(!c.supabaseUrl||!c.supabaseAnonKey) throw new Error('Site ainda não configurado (Supabase).');
      return window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    });
    return clientPromise;
  }
  async function session(){ const sb=await client(); const {data}=await sb.auth.getSession(); return data.session||null; }
  async function api(path,opts={}){
    const s=await session(); const headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
    if(s) headers.Authorization='Bearer '+s.access_token;
    const r=await fetch(path,Object.assign({},opts,{headers}));
    const body=await r.json().catch(()=>({}));
    if(!r.ok) throw Object.assign(new Error(body.error||('Erro '+r.status)),{status:r.status,body});
    return body;
  }
  async function requireLogin(){ const s=await session(); if(!s){ location.href='/entrar.html?volta='+encodeURIComponent(location.pathname); return null; } return s; }
  window.SSB={client,session,api,requireLogin};
})();
