const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = {
  cash: document.getElementById('cash'), heat: document.getElementById('heat'), rep: document.getElementById('rep'), lives: document.getElementById('lives'),
  objective: document.getElementById('objectiveText'), intro: document.getElementById('intro'), start: document.getElementById('startBtn'), closeIntro: document.getElementById('closeIntro'), nextJob: document.getElementById('nextJob')
};
const mobile = {
  controls: document.getElementById('mobileControls'),
  base: document.getElementById('joystickBase'),
  stick: document.getElementById('joystickStick'),
  action: document.getElementById('mobileAction'),
  active: false,
  pointerId: null,
  x: 0,
  y: 0,
  max: 42
};
const world = { w: 2200, h: 1500 };
const keys = new Set();
const keyMap = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
let running = false;
let camera = {x:0,y:0};
let state = { cash:0, heat:0, rep:0, lives:5, jobIndex:0, messageTimer:0, message:'' };
const player = { x:300, y:300, r:13, speed:2.4, inCar:null, dir:0 };
const car = { x:680, y:420, w:52, h:28, speed:0, angle:0, max:5.8, label:'CIMBA coupe' };
const jobs = [
  { name:'Studio Run', x:520, y:260, reward:250, rep:1, text:'Pick up the demo pack from the studio marker.' },
  { name:'Launch Promo', x:1220, y:360, reward:990, rep:2, text:'Deliver a $0.99 promo drop to the arena.' },
  { name:'Gallery Night', x:1650, y:950, reward:700, rep:2, text:'Reach the gallery and bring people together.' },
  { name:'Family Plan', x:760, y:1180, reward:1200, rep:3, text:'Complete the family plan upgrade mission.' },
  { name:'Legacy Mode', x:1860, y:260, reward:2500, rep:5, text:'Reach the final marker and unlock legacy mode.' }
];
const blocks = [];
for (let x=120; x<world.w; x+=260) for (let y=110; y<world.h; y+=220) {
  if ((x+y)%520!==0) blocks.push({x:x+20,y:y+20,w:150+((x*y)%60),h:100+((x+y)%50)});
}
const pedestrians = Array.from({length:28}, (_,i)=>({x:100+Math.random()*(world.w-200),y:100+Math.random()*(world.h-200),dx:(Math.random()-.5)*.7,dy:(Math.random()-.5)*.7,r:6, hue:i%4}));
function resize(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * devicePixelRatio);
  canvas.height = Math.floor(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
window.addEventListener('resize', resize); resize();
function normalizeKey(e){ const raw = e.key.toLowerCase(); return keyMap[raw] || raw; }
function beginGame(){ running=true; ui.intro.style.display='none'; canvas.focus(); flash('Mission started'); }
window.addEventListener('keydown', e=>{
  const k = normalizeKey(e);
  keys.add(k);
  if([' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(e.key.toLowerCase())) e.preventDefault();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()) && !running) beginGame();
  if(k==='m') nextJob();
});
window.addEventListener('keyup', e=>keys.delete(normalizeKey(e)));
canvas.addEventListener('click', ()=>canvas.focus());

function setJoystickFromPointer(e){
  const rect = mobile.base.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const distance = Math.hypot(dx, dy);
  const limit = mobile.max;
  if(distance > limit){ dx = dx / distance * limit; dy = dy / distance * limit; }
  mobile.x = dx / limit;
  mobile.y = dy / limit;
  mobile.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function resetJoystick(){
  mobile.active = false;
  mobile.pointerId = null;
  mobile.x = 0;
  mobile.y = 0;
  mobile.stick.style.transform = 'translate(-50%, -50%)';
}
mobile.base.addEventListener('pointerdown', e=>{
  e.preventDefault();
  beginGame();
  mobile.active = true;
  mobile.pointerId = e.pointerId;
  mobile.base.setPointerCapture(e.pointerId);
  setJoystickFromPointer(e);
});
mobile.base.addEventListener('pointermove', e=>{
  if(!mobile.active || e.pointerId !== mobile.pointerId) return;
  e.preventDefault();
  setJoystickFromPointer(e);
});
mobile.base.addEventListener('pointerup', e=>{ if(e.pointerId === mobile.pointerId) resetJoystick(); });
mobile.base.addEventListener('pointercancel', e=>{ if(e.pointerId === mobile.pointerId) resetJoystick(); });
mobile.action.addEventListener('click', e=>{ e.preventDefault(); beginGame(); interact(); });

ui.start.onclick=beginGame;
ui.closeIntro.onclick=beginGame;
ui.nextJob.onclick=nextJob;
function nextJob(){ state.jobIndex=(state.jobIndex+1)%jobs.length; updateObjective(); flash('New mission selected'); }
function updateObjective(){ ui.objective.textContent = jobs[state.jobIndex].text; }
function flash(m){ state.message=m; state.messageTimer=150; }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function interact(){
  if (!player.inCar && dist(player, car)<58) { player.inCar=car; flash('Entered the CIMBA coupe'); return; }
  if (player.inCar) { player.inCar=null; player.x = car.x+42; player.y=car.y; flash('Back on foot'); return; }
  const job=jobs[state.jobIndex];
  if (dist(player, job)<48) completeJob();
}
let eLock=false;
function completeJob(){ const job=jobs[state.jobIndex]; state.cash+=job.reward; state.rep+=job.rep; state.heat=Math.max(0,state.heat-1); flash(`${job.name} complete +$${job.reward}`); nextJob(); }
function update(){
  if(keys.has('e')&&!eLock){ interact(); eLock=true; } if(!keys.has('e')) eLock=false;
  if(!running) return;
  const joyActive = Math.hypot(mobile.x, mobile.y) > 0.08;
  if(player.inCar){
    const boost=keys.has('shift')?1.55:1;
    if(keys.has('w') || mobile.y < -0.25) car.speed+=0.12*boost;
    if(keys.has('s') || mobile.y > 0.35) car.speed-=0.1;
    if(keys.has('a') || mobile.x < -0.2) car.angle-=0.045*(Math.abs(car.speed)/2+0.5) * (joyActive ? Math.max(.5, Math.abs(mobile.x)) : 1);
    if(keys.has('d') || mobile.x > 0.2) car.angle+=0.045*(Math.abs(car.speed)/2+0.5) * (joyActive ? Math.max(.5, Math.abs(mobile.x)) : 1);
    if(keys.has(' ')) car.speed*=0.88;
    car.speed=clamp(car.speed,-2.6,car.max*boost); car.speed*=0.985;
    car.x+=Math.cos(car.angle)*car.speed; car.y+=Math.sin(car.angle)*car.speed;
    car.x=clamp(car.x,30,world.w-30); car.y=clamp(car.y,30,world.h-30);
    player.x=car.x; player.y=car.y;
  } else {
    let vx=mobile.x, vy=mobile.y;
    if(keys.has('w'))vy--; if(keys.has('s'))vy++; if(keys.has('a'))vx--; if(keys.has('d'))vx++;
    const len=Math.hypot(vx,vy)||1; const sp=player.speed*(keys.has('shift')?1.7:1);
    const intensity = joyActive && !keys.size ? clamp(len, .25, 1) : 1;
    player.x=clamp(player.x+vx/len*sp*intensity,20,world.w-20); player.y=clamp(player.y+vy/len*sp*intensity,20,world.h-20);
  }
  const job=jobs[state.jobIndex]; if(dist(player,job)<42) completeJob();
  pedestrians.forEach(p=>{ p.x+=p.dx; p.y+=p.dy; if(p.x<30||p.x>world.w-30)p.dx*=-1; if(p.y<30||p.y>world.h-30)p.dy*=-1; if(dist(player,p)<22){ state.heat=Math.min(9,state.heat+0.01); }});
  if(state.heat>=9.5){ state.lives--; state.heat=2; flash('Too much heat. Lost a life.'); if(state.lives<=0){ state.lives=5; state.cash=0; state.rep=0; player.x=300; player.y=300; flash('Reset. Build the city again.'); }}
  state.messageTimer=Math.max(0,state.messageTimer-1);
  updateHud();
}
function updateHud(){ ui.cash.textContent='$'+Math.floor(state.cash); ui.heat.textContent=Math.floor(state.heat); ui.rep.textContent=state.rep; ui.lives.textContent=state.lives; document.querySelector('.brand small').textContent=player.inCar?'driving':'on foot'; }
function drawGrid(){
  ctx.fillStyle='#182533'; ctx.fillRect(0,0,world.w,world.h);
  ctx.strokeStyle='#27394b'; ctx.lineWidth=16;
  for(let x=0;x<world.w;x+=260){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.h);ctx.stroke();}
  for(let y=0;y<world.h;y+=220){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(world.w,y);ctx.stroke();}
  ctx.strokeStyle='#3c5268'; ctx.lineWidth=2;
  for(let x=0;x<world.w;x+=260){ctx.beginPath();ctx.setLineDash([18,20]);ctx.moveTo(x,0);ctx.lineTo(x,world.h);ctx.stroke();}
  for(let y=0;y<world.h;y+=220){ctx.beginPath();ctx.setLineDash([18,20]);ctx.moveTo(0,y);ctx.lineTo(world.w,y);ctx.stroke();}
  ctx.setLineDash([]);
}
function draw(){
  const vw=canvas.width/devicePixelRatio, vh=canvas.height/devicePixelRatio;
  camera.x=clamp(player.x-vw/2,0,world.w-vw); camera.y=clamp(player.y-vh/2,0,world.h-vh);
  ctx.clearRect(0,0,vw,vh); ctx.save(); ctx.translate(-camera.x,-camera.y);
  drawGrid();
  blocks.forEach((b,i)=>{ ctx.fillStyle=i%3?'#233242':'#2b3c50'; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.fillStyle='#42566c'; for(let wx=b.x+18;wx<b.x+b.w-15;wx+=32)for(let wy=b.y+18;wy<b.y+b.h-15;wy+=26)ctx.fillRect(wx,wy,10,10); });
  ctx.fillStyle='#8267ff'; ctx.fillRect(460,210,120,70); label('STUDIO',490,252);
  ctx.fillStyle='#ff7a59'; ctx.fillRect(1160,300,150,100); label('ARENA',1202,357);
  ctx.fillStyle='#ffd166'; ctx.fillRect(1600,890,120,90); label('GALLERY',1624,942);
  ctx.fillStyle='#52d273'; ctx.fillRect(690,1125,150,100); label('HOME',744,1182);
  const job=jobs[state.jobIndex]; ctx.save(); ctx.shadowColor='#b6ff4d'; ctx.shadowBlur=22; ctx.fillStyle='#b6ff4d'; ctx.beginPath(); ctx.arc(job.x,job.y,22+Math.sin(Date.now()/150)*5,0,Math.PI*2); ctx.fill(); ctx.restore(); label('MISSION',job.x-34,job.y-34);
  pedestrians.forEach(p=>{ ctx.fillStyle=['#f2f5ee','#ffd166','#ff8fab','#7bdff2'][p.hue]; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); });
  drawCar();
  if(!player.inCar){ ctx.fillStyle='#f2f5ee'; ctx.beginPath(); ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#0a1016'; ctx.fillRect(player.x-3,player.y-15,6,10); }
  ctx.restore();
  drawMini(vw,vh); drawMessage(vw);
}
function drawCar(){ ctx.save(); ctx.translate(car.x,car.y); ctx.rotate(car.angle); ctx.fillStyle='#101820'; ctx.fillRect(-car.w/2-3,-car.h/2-3,car.w+6,car.h+6); ctx.fillStyle='#b6ff4d'; ctx.fillRect(-car.w/2,-car.h/2,car.w,car.h); ctx.fillStyle='#0b1118'; ctx.fillRect(0,-car.h/2+4,16,car.h-8); ctx.restore(); }
function label(t,x,y){ ctx.fillStyle='#ecf3ef'; ctx.font='12px ui-monospace, monospace'; ctx.fillText(t,x,y); }
function drawMini(vw,vh){ const w=150,h=105,x=18,y=vh-h-18; ctx.fillStyle='#0b1118cc'; ctx.fillRect(x,y,w,h); ctx.strokeStyle='#52677d'; ctx.strokeRect(x,y,w,h); const sx=w/world.w, sy=h/world.h; ctx.fillStyle='#b6ff4d'; ctx.fillRect(x+jobs[state.jobIndex].x*sx-3,y+jobs[state.jobIndex].y*sy-3,6,6); ctx.fillStyle='#f2f5ee'; ctx.fillRect(x+player.x*sx-3,y+player.y*sy-3,6,6); }
function drawMessage(vw){ if(state.messageTimer>0){ ctx.fillStyle='#0b1118dd'; ctx.fillRect(vw/2-190,22,380,44); ctx.strokeStyle='#b6ff4d'; ctx.strokeRect(vw/2-190,22,380,44); ctx.fillStyle='#f2f5ee'; ctx.font='16px ui-monospace, monospace'; ctx.textAlign='center'; ctx.fillText(state.message,vw/2,50); ctx.textAlign='left'; }}
function loop(){ update(); draw(); requestAnimationFrame(loop); }
updateObjective(); updateHud(); loop();
