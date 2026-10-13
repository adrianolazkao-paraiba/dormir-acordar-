"use strict";
/* ============ App instalado: ícone na tela do celular ============
   Só no site (no claude.ai a página já vive dentro do Claude). O service worker (sw.js) deixa o app
   instalável e abrindo sem internet. O botão "Instalar app" usa o pedido de instalação do Android/Chrome;
   no iPhone/iPad, que não tem esse pedido, mostra o passo a passo do "Adicionar à Tela de Início". */
(function(){
  if(!window.__local || window.__nativo) return; // no app Android já instalado não há o que instalar
  const ua=navigator.userAgent;
  const ios=/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints>0);
  const android=/Android/.test(ua);
  const naTela=()=>matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
  const btn=$("installBtn"), sheet=$("installSheet");
  let pedido=null;

  if("serviceWorker" in navigator && (location.protocol==="https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))){
    addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); });
  }

  const mostrar=()=>{ btn.hidden = naTela() || !(pedido || ios || android); };
  addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); pedido=e; mostrar(); });
  addEventListener("appinstalled",()=>{ pedido=null; btn.hidden=true; fechar(); toast("Pronto! O Estúdio D&A está na tela de início do aparelho."); });

  const passo=html=>{ const li=document.createElement("li"); li.innerHTML=html; return li; };
  const compartilhar='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-label="Compartilhar"><path d="M12 15V3m0 0L8 7m4-4l4 4"/><path d="M6 10H5a1 1 0 00-1 1v9a1 1 0 001 1h14a1 1 0 001-1v-9a1 1 0 00-1-1h-1"/></svg>';
  function abrir(){
    const ol=$("installSteps"), nota=$("installNote"); ol.textContent="";
    if(ios){
      ol.append(passo(`Toque em <b>Compartilhar</b> ${compartilhar} no Safari (embaixo no iPhone, em cima no iPad).`),
        passo("Role a lista e toque em <b>Adicionar à Tela de Início</b>."),
        passo("Toque em <b>Adicionar</b>. O ícone <b>Estúdio D&amp;A</b> aparece na tela."));
      nota.innerHTML="Abriu pelo WhatsApp ou Instagram? Antes, toque em <b>Abrir no Safari</b> (ou ⋯ → Abrir no navegador).";
    } else {
      ol.append(passo("Toque no menu <b>⋮</b> do Chrome (em cima, à direita)."),
        passo("Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>."),
        passo("Confirme em <b>Instalar</b>. O ícone <b>Estúdio D&amp;A</b> aparece na tela."));
      nota.innerHTML="Abriu pelo Instagram? Antes, toque em <b>⋮</b> → <b>Abrir no Chrome</b>.";
    }
    sheet.hidden=false; $("installOk").focus();
  }
  function fechar(){ sheet.hidden=true; }
  btn.addEventListener("click",async()=>{
    if(pedido){ const p=pedido; pedido=null; try{ await p.prompt(); const r=await p.userChoice; if(r.outcome!=="accepted") mostrar(); }catch(e){ abrir(); } return; }
    abrir();
  });
  $("installOk").addEventListener("click",fechar);
  sheet.addEventListener("click",e=>{ if(e.target===sheet) fechar(); });
  addEventListener("keydown",e=>{ if(e.key==="Escape" && !sheet.hidden) fechar(); });
  matchMedia("(display-mode: standalone)").addEventListener?.("change",mostrar);
  mostrar();
})();
