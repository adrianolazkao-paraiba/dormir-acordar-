"use strict";
/* ============ Legendas com Claude ============ */
let sampleNS=null, sampleImages=false;
function initSample(){
  if(!(window.claude&&window.claude.use)){ $("capStep").hidden=true; return; }
  window.claude.use("sample").then(async s=>{
    sampleNS=s; if(!s){ $("capStep").hidden=true; return; }
    try{ const l=await s.limits(); sampleImages=!!(l&&l.images); }catch(e){ sampleImages=false; }
  }).catch(()=>{ $("capStep").hidden=true; });
}
async function writeCaptions(){
  if(!sampleNS){ toast("As legendas funcionam quando a página é aberta no claude.ai."); return; }
  const it=S.sel; const btn=$("capBtn"); btn.disabled=true; btn.textContent="Escrevendo…";
  const box=$("caps"); box.innerHTML='<p class="hint">Claude está olhando a peça e escrevendo…</p>';
  try{
    const opts={modelTier:"default"};
    if(sampleImages && it){ const fmt=FORMATS[0]; const c=canvas(720,900); const saveLayout=S.layout; S.layout="none"; renderFormat(c.getContext("2d"),720,900,it,{...fmt,text:false,logo:false},it.kind==="video"?it.el.currentTime:null,null); S.layout=saveLayout; opts.images=[await toBlob(c,"image/jpeg",.85)]; }
    const P=S.P;
    const prompt=`Você é o redator da Dormir & Acordar, marca brasileira de pijamas e camisolas vendida pelo Instagram, TikTok e TikTok Shop.
Tom de voz: calmo, acolhedor e elegante, inspirado em marcas europeias de pijama premium (nada de exageros, sem CAIXA ALTA gritando, no máximo 2 emojis discretos). Português do Brasil.
${opts.images?"A imagem anexada mostra a peça que será vendida (uma modelo vestindo o pijama ou a peça sozinha). Descreva só o que dá para ver: cor, estampa, modelagem, tecido aparente.":"Não há imagem; use só os dados abaixo."}
Dados da peça: nome "${P.name||"pijama"}"; preço ${money(P.price)||"não informado"}${P.old?"; preço antigo "+money(P.old):""}; chamada "${P.eyebrow||""}"; botão "${P.cta||""}".
Responda SOMENTE com JSON neste formato:
{"instagram":"legenda de 3 a 5 linhas com quebra de linha, termina com o preço e o convite de compra","tiktok":"legenda curta de até 150 caracteres","hashtags":["8 a 12 hashtags em português, misturando nicho (pijama, moda dormir) e amplas"],"ganchos":["3 frases de abertura para os 2 primeiros segundos do vídeo, até 40 caracteres cada"]}`;
    const data=await sampleNS.json(prompt,opts);
    renderCaptions(data);
  }catch(e){
    box.innerHTML="";
    if(e&&e.code==="not_granted"){ toast("Sem permissão para usar o Claude nesta página."); $("capStep").hidden=true; }
    else if(e&&e.code==="rate_limited") toast("Muitos pedidos seguidos. Tente de novo em um minuto.");
    else toast("Não consegui escrever as legendas agora. Tente de novo.");
  } finally { btn.disabled=false; btn.textContent="Escrever de novo"; }
}
function copyText(t){
  const done=()=>toast("Copiado.");
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done).catch(()=>fallbackCopy(t)); } else fallbackCopy(t);
}
function fallbackCopy(t){ const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("Copiado."); }catch(e){ toast("Selecione o texto e copie."); } ta.remove(); }
function renderCaptions(d){
  const box=$("caps"); box.innerHTML="";
  const tags=(Array.isArray(d.hashtags)?d.hashtags:[]).map(h=>String(h).startsWith("#")?h:"#"+h).join(" ");
  const block=(title,text,extra)=>{ const c=document.createElement("div"); c.className="cap"; const h=document.createElement("h3"); h.textContent=title; const p=document.createElement("p"); p.textContent=text;
    const a=document.createElement("div"); a.className="acts"; const b=document.createElement("button"); b.className="btn ghost sm"; b.type="button"; b.textContent="Copiar"; b.addEventListener("click",()=>copyText(extra||text)); a.appendChild(b); c.append(h,p,a); box.appendChild(c); };
  if(d.instagram) block("Instagram", d.instagram+(tags?"\n\n"+tags:""), null);
  if(d.tiktok) block("TikTok", d.tiktok+(tags?"\n\n"+tags.split(" ").slice(0,5).join(" "):""), null);
  if(Array.isArray(d.ganchos)&&d.ganchos.length){
    const c=document.createElement("div"); c.className="cap"; const h=document.createElement("h3"); h.textContent="Abertura do vídeo"; c.appendChild(h);
    const list=document.createElement("div"); list.className="hooks";
    for(const g of d.ganchos.slice(0,3)){ const row=document.createElement("div"); row.className="hook"; const s=document.createElement("span"); s.textContent=g;
      const b=document.createElement("button"); b.className="btn ghost sm"; b.type="button"; b.textContent="Usar como chamada";
      b.addEventListener("click",()=>{ S.P.eyebrow=String(g).slice(0,40); $("pEyebrow").value=S.P.eyebrow; savePrefs(); schedule(); toast("Chamada atualizada."); });
      row.append(s,b); list.appendChild(row); }
    c.appendChild(list); box.appendChild(c);
  }
}
