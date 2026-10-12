"use strict";
/* ============ Estado ============ */
const DEFAULT_P = { name:"Pijama Longo Floral", price:"189,90", old:"", eyebrow:"Nova coleção", cta:"Compre pelo link da bio" };
const S = {
  items:[], sel:null, mode:"pair", scene:"studio", layout:"editorial", mark:"logo", vidPos:"bottom", endCard:true, pairLabels:true, zones:true,
  P:{...DEFAULT_P}, include:new Set(FORMATS.map(f=>f.id)), customBg:null, busy:false
};
function loadPrefs(){
  try{
    const raw = localStorage.getItem("da-estudio");
    if(!raw) return;
    const p = JSON.parse(raw);
    if(p.P) S.P = {...DEFAULT_P, ...p.P};
    if(p.scene && SCENES.some(s=>s.id===p.scene) && p.scene!=="custom") S.scene = p.scene; else if(p.scene) S.scene="studio";
    if(["editorial","etiqueta","none"].includes(p.layout)) S.layout = p.layout;
    if(["logo","mono","word","wm","wmword","none"].includes(p.mark)) S.mark = p.mark; else if(p.showLogo===false) S.mark="none";
    // dizeres e logo do vídeo embaixo por padrão (no topo cobriam o rosto da modelo);
    // preferência salva antes dessa mudança (v<2) é ignorada
    if(p.v>=2 && ["top","bottom"].includes(p.vidPos)) S.vidPos = p.vidPos;
    if(typeof p.endCard==="boolean") S.endCard = p.endCard;
  }catch(e){}
}
function savePrefs(){
  try{ localStorage.setItem("da-estudio", JSON.stringify({v:2, P:S.P, scene:S.scene, layout:S.layout, mark:S.mark, vidPos:S.vidPos, endCard:S.endCard})); }catch(e){}
}
