import { Watercolor } from './watercolor.js';
import { Brush } from './brush.js';
import { HoldSession } from './hold-session.js';

const $ = id => document.getElementById(id);
const canvas = $('painting'), video = $('source-video'), hold = $('hold-button');
const source = document.createElement('canvas'); source.width = 640; source.height = 800;
const sourceContext = source.getContext('2d', { alpha: false });
const brush = new Brush(640, 800);
const motionCanvas = document.createElement('canvas'); motionCanvas.width = 32; motionCanvas.height = 40;
const motionContext = motionCanvas.getContext('2d', { willReadFrequently: true });
let previousPixels, motion = { x: 0, y: 0 }, stream, sampleImage, facing = 'environment', mirrored = false;
let sourceType = 'sample', ready = false, generation = 0, raf = 0, lastFrame = 0, settleTimer;
let recorder, recordingStream, recordedBlob, chunks = [], downloadUrl, canFlip = false;
let engine;
const reviewWaiters = [];

function state(value) { $('studio').dataset.state = value; }
function message(content) { $('message-text').textContent = content; $('camera-message').hidden = !content; }
function stopTracks() { stream?.getTracks().forEach(track => track.stop()); stream = null; }
function closeRecordingStream() { recordingStream?.getTracks().forEach(track => track.stop()); recordingStream = null; }
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }

const session = new HoldSession({
  maxDuration: 12000,
  onStart() {
    state('holding'); $('instruction').textContent = 'Let the color find its way.';
    $('use-camera').disabled = true; $('flip-camera').disabled = true;
    brush.clear(); engine.clear(); engine.updateCoverage(brush.canvas); engine.setRecording(true); engine.setPaused(false);
    recordedBlob = null; chunks = []; beginRecorder(); schedule();
  },
  onFinish() {
    engine.setRecording(false); state('settling'); hold.disabled = true;
    $('instruction').textContent = 'A moment to settle.';
    settleTimer = setTimeout(finalize, 2200); schedule();
  },
  onReset() { resetPainting(); }
});

function beginRecorder() {
  recorder = null; closeRecordingStream();
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return;
  const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mime) return;
  try {
    recordingStream = canvas.captureStream(24);
    recorder = new MediaRecorder(recordingStream, { mimeType: mime, videoBitsPerSecond: 4000000 });
    const currentRecorder = recorder; let failed = false;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      if(failed || recorder !== currentRecorder) return;
      recordedBlob = chunks.length ? new Blob(chunks, { type: mime }) : null;
      closeRecordingStream(); showReview();
    };
    recorder.onerror = () => { failed = true; recorder = null; recordedBlob = null; chunks = []; closeRecordingStream(); session.finish(); if (session.state === 'settling') finalize(); };
    recorder.start(250);
  } catch { recorder = null; closeRecordingStream(); }
}
function finalize() {
  if (session.state !== 'settling') return;
  clearTimeout(settleTimer); engine.render(); engine.setPaused(true); cancelAnimationFrame(raf); raf = 0;
  stopTracks();
  if (recorder?.state === 'recording') { try { recorder.stop(); } catch { showReview(); } } else showReview();
}
function showReview() {
  if (session.state !== 'settling') return;
  session.complete(); state('review'); message('');
  $('heading').textContent = 'A moment, in color.';
  $('instruction').textContent = 'Yours to keep.';
  $('again').hidden = false; $('save').hidden = false; $('flip-camera').hidden = true;
  $('save-label').textContent = recordedBlob ? 'Save film' : 'Save image';
  $('use-camera').disabled = false;
  reviewWaiters.splice(0).forEach(resolve => resolve());
}
function resetPainting() {
  recordedBlob = null; chunks = []; URL.revokeObjectURL(downloadUrl); downloadUrl = null;
  brush.clear(); previousPixels = null; motion = { x: 0, y: 0 };
  engine?.setRecording(false); engine?.updateCoverage(brush.canvas); engine?.clear(); engine?.setPaused(true);
  $('heading').textContent = 'Hold a moment.'; $('instruction').textContent = 'Hold to paint. Release to keep.';
  $('elapsed').textContent = '00:00'; $('studio').style.setProperty('--progress', 0);
  $('again').hidden = true; $('save').hidden = true; $('flip-camera').hidden = !canFlip || sourceType !== 'camera';
  $('flip-camera').disabled = false; $('use-camera').disabled = false;
  hold.disabled = !ready; state(ready ? 'ready' : 'loading'); schedule();
}
function cropIntoSource(image) {
  const width = image.videoWidth || image.width, height = image.videoHeight || image.height;
  if (!width || !height) return;
  const sw = Math.min(width, height * .8), sh = sw / .8;
  const sway = sourceType === 'sample' ? Math.sin(performance.now() / 5300) * Math.max(0, (width-sw)*.08) : 0;
  sourceContext.save();
  if (mirrored) { sourceContext.translate(640, 0); sourceContext.scale(-1, 1); }
  sourceContext.drawImage(image, (width-sw)/2+sway, (height-sh)/2, sw, sh, 0, 0, 640, 800);
  sourceContext.restore();
}
function estimateMotion() {
  motionContext.drawImage(source, 0, 0, 32, 40);
  const pixels = motionContext.getImageData(0,0,32,40).data;
  if (previousPixels) {
    let best = Infinity, bx = 0, by = 0;
    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) {
      let difference=0;
      for(let y=3;y<37;y+=2) for(let x=3;x<29;x+=2) difference+=Math.abs(pixels[(y*32+x)*4+1]-previousPixels[((y+dy)*32+x+dx)*4+1]);
      // Prefer no movement in flat scenes rather than arbitrary tied shifts.
      difference += (Math.abs(dx)+Math.abs(dy))*.5;
      if(difference<best){best=difference;bx=dx;by=dy;}
    }
    motion.x=motion.x*.8+bx*.1; motion.y=motion.y*.8+by*.1;
  }
  previousPixels=pixels;
}
function frame(now) {
  raf = 0;
  if (!ready || document.hidden || session.state === 'review') return;
  if (session.state !== 'settling' && now-lastFrame > 55) {
    cropIntoSource(sourceType === 'sample' ? sampleImage : video);
    engine.updateLiveSource(source);
    if (session.state === 'ready') engine.render();
    if (session.state === 'holding') {
      estimateMotion(); const elapsed = session.tick();
      if (session.state === 'holding') { brush.paint(elapsed,motion); engine.updateCoverage(brush.canvas); }
      $('elapsed').textContent = `00:${String(Math.floor(elapsed/1000)).padStart(2,'0')}`;
      $('studio').style.setProperty('--progress', elapsed/session.maxDuration);
    }
    lastFrame = now;
  }
  schedule();
}
async function initializeSource() {
  cropIntoSource(sourceType === 'sample' ? sampleImage : video);
  try {
    engine ||= new Watercolor(canvas); engine.setLiveSource(source); engine.updateCoverage(brush.canvas); engine.setWater(.64);
  } catch (error) {
    console.warn('Watercolor renderer unavailable:', error.message);
    stopTracks(); ready = false; hold.disabled = true; message('This camera needs a browser with WebGL2. Try Safari, Chrome, or Edge.'); return;
  }
  ready = true; message('');
  if (!session.reset()) resetPainting();
  $('source-label').textContent = sourceType === 'sample' ? 'CAYUGA LAKE · SAMPLE' : 'ITHACA · YOUR CAMERA';
  $('photo-credit').hidden = sourceType !== 'sample'; $('private-note').hidden = sourceType === 'sample';
  $('camera-label').textContent = sourceType === 'sample' ? 'Use my camera' : 'My camera';
}
async function sample() {
  const token=++generation; stopTracks(); ready=false; sourceType='sample'; mirrored=false; canFlip=false; hold.disabled=true;
  try {
    if(!sampleImage){sampleImage=new Image();sampleImage.src='assets/cayuga-lake.jpg';await sampleImage.decode();}
    if(token!==generation)return;
    await initializeSource();
  } catch { message('The sample couldn’t load. Try your camera.'); }
}
async function camera() {
  if(session.state==='holding'||session.state==='settling')return;
  const token=++generation; ready=false; hold.disabled=true; stopTracks();
  state('loading'); message('Allow your camera. Find your little corner.');
  if(!navigator.mediaDevices?.getUserMedia){message('Camera access isn’t available here. Open the demo in a secure browser.');return;}
  try {
    const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:1600},frameRate:{ideal:24,max:30}}});
    if(token!==generation){next.getTracks().forEach(track=>track.stop());return;}
    stream=next;video.srcObject=stream;await video.play();
    if(token!==generation){next.getTracks().forEach(track=>track.stop());return;}
    if(!video.videoWidth||!video.videoHeight)throw new Error('Camera has no frame');
    sourceType='camera';mirrored=stream.getVideoTracks()[0].getSettings().facingMode==='user';
    stream.getVideoTracks()[0].addEventListener('ended',()=>{
      if(!ready)return;session.finish();if(session.state==='settling')finalize();ready=false;hold.disabled=true;
      if(session.state!=='review')message('Your camera disconnected. Try it again or use the sample.');
    },{once:true});
    const devices=await navigator.mediaDevices.enumerateDevices();
    if(token!==generation)return;
    canFlip=devices.filter(device=>device.kind==='videoinput').length>1;
    await initializeSource();
  } catch(error) {
    if(token!==generation)return;stopTracks();
    const copy={NotAllowedError:'Camera access is off. Allow it in your browser, or try the sample.',NotFoundError:'No camera found. Try this on your phone, or use the sample.',NotReadableError:'Your camera is busy. Close other camera apps and try again.'};
    message(copy[error.name]||'The camera couldn’t start. Try again, or use the sample.');
  }
}

let pointerId = null, keyHeld = false;
function begin() { if(ready && !hold.disabled)session.begin(); }
function release() { session.finish(); }
hold.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0||pointerId!==null||hold.disabled)return;
  event.preventDefault();pointerId=event.pointerId;hold.setPointerCapture(event.pointerId);begin();
});
hold.addEventListener('pointerup',event=>{if(event.pointerId!==pointerId)return;pointerId=null;release();});
hold.addEventListener('pointercancel',()=>{pointerId=null;release();});
hold.addEventListener('lostpointercapture',()=>{pointerId=null;release();});
hold.addEventListener('contextmenu',event=>event.preventDefault());
document.addEventListener('keydown',event=>{
  if(event.repeat||!['Space','Enter'].includes(event.code))return;
  const target=event.target;
  if(event.code==='Enter'&&target!==hold)return;
  if(event.code==='Space'&&target!==document.body&&target!==hold)return;
  event.preventDefault();keyHeld=true;begin();
});
document.addEventListener('keyup',event=>{if(keyHeld&&['Space','Enter'].includes(event.code)){event.preventDefault();keyHeld=false;release();}});
window.addEventListener('blur',()=>{keyHeld=false;pointerId=null;release();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){++generation;release();if(session.state==='settling')finalize();stopTracks();engine?.setPaused(true);cancelAnimationFrame(raf);raf=0;if(sourceType==='camera'){ready=false;hold.disabled=true;}}
  else if(session.state==='ready'){if(sourceType==='sample'){engine?.setPaused(false);schedule();}else{message('Your camera paused. Tap “Use my camera” to return.');$('camera-label').textContent='Use my camera';}}
});
$('again').addEventListener('click',()=>{session.reset();if(sourceType==='camera')camera();});
$('use-camera').addEventListener('click',camera);$('try-sample').addEventListener('click',sample);
$('flip-camera').addEventListener('click',()=>{facing=facing==='environment'?'user':'environment';camera();});
$('save').addEventListener('click',async()=>{
  if(session.state!=='review')return;
  try {
    const blob=recordedBlob||await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('No painting available');
    URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=downloadUrl;a.download=`paint-ithaca-${new Date().toISOString().slice(0,10)}.${blob.type.includes('mp4')?'mp4':blob.type.includes('webm')?'webm':'png'}`;a.click();
  } catch { $('instruction').textContent='Couldn’t save that moment. Please try again.'; }
});
window.addEventListener('pagehide',event=>{
  ++generation;release();if(session.state==='settling')finalize();
  clearTimeout(settleTimer);stopTracks();closeRecordingStream();
  engine?.setPaused(true);cancelAnimationFrame(raf);raf=0;
  if(!event.persisted){engine?.dispose();URL.revokeObjectURL(downloadUrl);}
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted||session.state!=='ready')return;
  if(sourceType==='sample'){ready=true;schedule();}
  else{ready=false;hold.disabled=true;message('Tap “Use my camera” to return.');$('camera-label').textContent='Use my camera';}
});
// One structured entry point mirrors the one deliberate gesture. It never grants camera access.
if(document.modelContext?.registerTool){
  try {Promise.resolve(document.modelContext.registerTool({name:'paint_sample_moment',description:'Record a watercolor reveal from the sample camera for a bounded duration. Does not access a physical camera or upload anything.',inputSchema:{type:'object',properties:{durationMs:{type:'number',minimum:300,maximum:12000}},required:['durationMs'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){if(!input||!Number.isFinite(input.durationMs)||input.durationMs<300||input.durationMs>12000)throw new Error('Duration must be between 300 and 12000 ms.');if(sourceType!=='sample'||!ready||session.state!=='ready')throw new Error('The sample camera must be ready.');const reviewed=new Promise(resolve=>reviewWaiters.push(resolve));begin();await new Promise(resolve=>setTimeout(resolve,input.durationMs));release();await reviewed;return {state:session.state,durationMs:session.duration,format:recordedBlob?.type||'image/png',recordedBytes:recordedBlob?.size||0,simulationSteps:engine.steps};}})).catch(()=>{});}catch{}
}
sample();
