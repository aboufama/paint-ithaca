const source = new Image(); source.src = './assets/cayuga-lake.jpg';
const studies = document.getElementById('studies'), status = document.getElementById('status'), playAll = document.getElementById('play-all');
const entries = []; let raf = 0, lastDraw = 0, pausedAt = null;
const waiters = [];
function draw(entry, progress) {
  const { ctx } = entry; ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  try { entry.renderer.draw(ctx, Math.min(1, Math.max(0, progress))); entry.frames++; }
  catch (error) { entry.error = error.message; entry.button.classList.add('failed'); entry.button.setAttribute('aria-label', `${entry.effect.name} could not render`); }
  finally { ctx.restore(); }
}
function notifyCompletion() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (waiters[i].targets.every(entry => entry.start === null)) {
      const [waiter] = waiters.splice(i,1); waiter.resolve(waiter.targets.map(entry => ({id:entry.effect.id,name:entry.effect.name,frames:entry.frames,error:entry.error || null})));
    }
  }
}
function tick(now) {
  raf = 0;
  if (now - lastDraw >= 1000/30) {
    for (const entry of entries) {
      if (entry.start === null) continue;
      const progress = Math.min(1, (now - entry.start) / entry.effect.duration);
      if (entry.visible || progress === 1) draw(entry,progress);
      if (progress === 1) { entry.start = null; entry.card.dataset.playing = 'false'; }
    }
    lastDraw = now;
  }
  notifyCompletion();
  if (entries.some(entry=>entry.start!==null)) raf=requestAnimationFrame(tick);
  else { status.textContent = 'Tap a study to replay it.'; notifyCompletion(); }
}
function play(targets) {
  const now=performance.now();
  for(const entry of targets){entry.start=now;entry.frames=0;entry.card.dataset.playing='true';draw(entry,0);}
  status.textContent=targets.length===1?`Watching ${targets[0].effect.id} · ${targets[0].effect.name}`:'Watching all ten studies.';
  if(!raf&&!document.hidden)raf=requestAnimationFrame(tick);
}
const visibility = new IntersectionObserver(records=>{
  for(const record of records){const entry=entries.find(item=>item.card===record.target);if(entry)entry.visible=record.isIntersecting;}
},{rootMargin:'100px'});
async function initialize() {
  try {
    await source.decode();
    const photo=document.createElement('canvas');photo.width=480;photo.height=360;photo.getContext('2d').drawImage(source,0,0,480,360);
    const modules=await Promise.all(Array.from({length:10},(_,i)=>import(`./variants/${String(i+1).padStart(2,'0')}.js`)));
    for(const {default:effect} of modules){
      const card=document.createElement('article');card.className='study';card.dataset.id=effect.id;
      const button=document.createElement('button');button.className='preview';button.setAttribute('aria-label',`Play ${effect.id}: ${effect.name}`);
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;canvas.setAttribute('aria-label',`${effect.name} preview`);
      const replay=document.createElement('span');replay.className='replay';replay.setAttribute('aria-hidden','true');
      replay.innerHTML='<svg viewBox="0 0 16 16"><path d="M3 7a5 5 0 1 1 1.3 4M3 3v4h4"/></svg> Replay';
      button.append(canvas,replay);
      const caption=document.createElement('div');caption.className='caption';
      const number=document.createElement('span');number.className='number';number.textContent=effect.id;
      const text=document.createElement('div'),name=document.createElement('h2'),description=document.createElement('p');name.textContent=effect.name;description.className='description';description.textContent=effect.description;
      text.append(name,description);caption.append(number,text);card.append(button,caption);studies.append(card);
      const entry={effect,card,button,canvas,ctx:canvas.getContext('2d'),renderer:effect.create({width:480,height:360,photo}),start:null,visible:true,frames:0};
      entries.push(entry);visibility.observe(card);draw(entry,1);button.addEventListener('click',()=>play([entry]));
    }
    playAll.disabled=false;status.textContent='Tap a study to replay it.';
  }catch(error){status.textContent='The studies couldn’t load. Please refresh.';console.error(error);}
}
playAll.addEventListener('click',()=>play(entries));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){pausedAt=performance.now();cancelAnimationFrame(raf);raf=0;}
  else {if(pausedAt!==null){const shift=performance.now()-pausedAt;for(const entry of entries)if(entry.start!==null)entry.start+=shift;}pausedAt=null;if(entries.some(entry=>entry.start!==null)&&!raf)raf=requestAnimationFrame(tick);}
});
window.addEventListener('pagehide',event=>{cancelAnimationFrame(raf);raf=0;if(!event.persisted){visibility.disconnect();entries.forEach(entry=>entry.renderer.dispose?.());}});
window.addEventListener('pageshow',event=>{if(event.persisted&&entries.some(entry=>entry.start!==null)&&!raf)raf=requestAnimationFrame(tick);});
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'play_paint_studies',description:'Replay selected paint studies using the included demo photograph and return render status. No camera access.',inputSchema:{type:'object',properties:{ids:{type:'array',items:{type:'string',enum:['01','02','03','04','05','06','07','08','09','10']},minItems:1,maxItems:10,uniqueItems:true}},additionalProperties:false},async execute(input){if(entries.length!==10)throw new Error('Studies are still loading.');const targets=input?.ids?entries.filter(entry=>input.ids.includes(entry.effect.id)):entries;if(!targets.length)throw new Error('No studies selected.');const finished=new Promise(resolve=>waiters.push({targets,resolve}));play(targets);return finished;}})).catch(()=>{});}catch{}
}
initialize();

// Deterministic rendering checks are exposed only as a structured review action.
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'check_paint_studies',description:'Check all ten demo renderers for errors, deterministic replay, opaque finished images and visible animation. Does not open a camera.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute(){
    if(entries.length!==10)throw new Error('Studies are still loading.');
    if(entries.some(entry=>entry.start!==null))throw new Error('Wait for the animations to finish.');
    const fingerprints=[];
    const results=entries.map(entry=>{
      const pixels=()=>entry.ctx.getImageData(0,0,entry.canvas.width,entry.canvas.height).data;
      const digest=data=>{let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);return hash>>>0;};
      draw(entry,0);const empty=digest(pixels());
      draw(entry,.35);const midway=digest(pixels());
      draw(entry,1);const full=pixels(),finish=digest(full);let sum=0,squared=0,opaque=true;
      for(let i=0;i<full.length;i+=4){const luminance=(full[i]+full[i+1]+full[i+2])/3;sum+=luminance;squared+=luminance*luminance;if(full[i+3]!==255)opaque=false;}
      const count=full.length/4,deviation=Math.sqrt(Math.max(0,squared/count-(sum/count)**2));
      fingerprints.push(new Uint8ClampedArray(full));
      draw(entry,.35);const repeated=digest(pixels());draw(entry,1);
      return {id:entry.effect.id,name:entry.effect.name,deterministic:midway===repeated,animated:empty!==midway&&midway!==finish,opaque,contrast:Math.round(deviation*10)/10,error:entry.error||null};
    });
    let closest={difference:Infinity};
    for(let a=0;a<10;a++)for(let b=a+1;b<10;b++){let distance=0,count=0;for(let i=0;i<fingerprints[a].length;i+=16){for(let c=0;c<3;c++){distance+=Math.abs(fingerprints[a][i+c]-fingerprints[b][i+c]);count++;}}distance/=count;if(distance<closest.difference)closest={ids:[entries[a].effect.id,entries[b].effect.id],difference:distance};}
    return {passed:results.every(r=>r.deterministic&&r.animated&&r.opaque&&r.contrast>8&&!r.error),results,closestFinishedPair:closest};
  }})).catch(()=>{});}catch{}
}
