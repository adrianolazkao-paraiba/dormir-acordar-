"use strict";
/* ============ Início ============ */
loadPrefs(); addExample(); bind(); renderSegs(); initDownloads(); initSample(); initGallery();
renderAll();
logoImg.onload=()=>{ schedule(); renderMarkChips(); }; if(logoImg.complete) renderMarkChips();
if(document.fonts&&document.fonts.load){ Promise.all([document.fonts.load(`300 40px Fraunces`),document.fonts.load(`400 40px Fraunces`),document.fonts.load(`500 20px Inter`),document.fonts.load(`600 20px Inter`)]).then(()=>{ sceneCache.clear(); schedule(); renderMarkChips(); }).catch(()=>{}); }
