"use strict";
/* ============ Item de exemplo (ilustração, já recortada) ============ */
function makeExample(){
  const W=1000,H=1640, c=canvas(W,H), g=c.getContext("2d"), r=rng(5);
  const fabric="#F5E7DE", pipe="#33356B";
  const pants=new Path2D(); pants.moveTo(335,860); pants.lineTo(300,1590); pants.lineTo(478,1600); pants.lineTo(500,1120); pants.lineTo(522,1600); pants.lineTo(700,1590); pants.lineTo(665,860); pants.closePath();
  const shirt=new Path2D(); shirt.moveTo(432,214); shirt.lineTo(300,258); shirt.quadraticCurveTo(230,420,182,648); shirt.lineTo(268,676); shirt.lineTo(350,432); shirt.lineTo(338,946); shirt.quadraticCurveTo(500,962,662,946); shirt.lineTo(650,432); shirt.lineTo(732,676); shirt.lineTo(818,648); shirt.quadraticCurveTo(770,420,700,258); shirt.lineTo(568,214); shirt.quadraticCurveTo(500,250,432,214); shirt.closePath();
  function print(path){
    g.save(); g.clip(path);
    for(let i=0;i<260;i++){ const x=150+r()*700, y=200+r()*1420, a=r()*6.28;
      g.strokeStyle="rgba(176,96,104,.55)"; g.lineWidth=2.2; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*16,y+Math.sin(a)*16); g.stroke();
      g.fillStyle=r()<.5?"rgba(214,124,132,.75)":"rgba(196,160,110,.6)"; g.beginPath(); g.ellipse(x+Math.cos(a)*18,y+Math.sin(a)*18,5,3.2,a,0,6.28); g.fill(); }
    const sh=g.createLinearGradient(150,0,850,0); sh.addColorStop(0,"rgba(110,80,70,.16)"); sh.addColorStop(.5,"rgba(255,255,255,0)"); sh.addColorStop(1,"rgba(110,80,70,.18)"); g.fillStyle=sh; g.fillRect(0,0,W,H);
    g.restore();
  }
  // cabide
  g.strokeStyle="#8C6B49"; g.lineWidth=9; g.lineCap="round"; g.beginPath(); g.moveTo(500,212); g.lineTo(500,150); g.arc(474,150,26,0,Math.PI*1.15,true); g.stroke();
  g.fillStyle=fabric; g.fill(pants); print(pants);
  g.strokeStyle=pipe; g.lineWidth=7; g.beginPath(); g.moveTo(304,1560); g.lineTo(480,1570); g.moveTo(520,1570); g.lineTo(696,1560); g.stroke();
  g.save(); g.shadowColor="rgba(60,40,30,.22)"; g.shadowBlur=26; g.shadowOffsetY=10; g.fillStyle=fabric; g.fill(shirt); g.restore(); print(shirt);
  g.lineWidth=6; g.strokeStyle=pipe; g.beginPath(); g.moveTo(500,372); g.lineTo(500,952); g.moveTo(186,640); g.lineTo(266,668); g.moveTo(814,640); g.lineTo(734,668); g.moveTo(340,940); g.quadraticCurveTo(500,956,660,940); g.stroke();
  const lap=(s)=>{ g.beginPath(); g.moveTo(500+s*68,214); g.lineTo(500+s*130,236); g.lineTo(500+s*118,330); g.lineTo(500,376); g.closePath(); };
  for(const s of [-1,1]){ lap(s); g.fillStyle="#F9EEE7"; g.fill(); g.strokeStyle=pipe; g.lineWidth=5; g.stroke(); }
  g.fillStyle="#FBF5EF"; for(const y of [470,580,690,800]){ g.beginPath(); g.arc(518,y,8,0,6.28); g.fill(); }
  g.strokeStyle=pipe; g.lineWidth=5; g.strokeRect(560,480,78,70);
  return { canvas:c, bbox:{x:182,y:120,w:636,h:1480} };
}
