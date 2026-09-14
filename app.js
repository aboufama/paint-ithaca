import { Watercolor } from './watercolor.js';
import { Bloom } from './bloom.js';
import { CaptureSession } from './capture-session.js';

const $ = id => document.getElementById(id);
const video = $('source-video'), canvas = $('painting'), shutter = $('shutter');
const source = document.createElement('canvas'); source.width = 800; source.height = 1000;
const sourceContext = source.getContext('2d', { alpha: false });
const bloom = new Bloom(), session = new CaptureSession();
let engine, stream, ready = false, generation = 0, facing = 'environment', mirrored = false;
let raf = 0, lastFrame = null, accumulator = 0, lastMaskFrame = 0, disposed = false;
let recorder, recordingStream, recordedBlob, chunks = [], downloadUrl;
const completed = [];

function state(value) { $('studio').dataset.state = value; }
function message(text, retry = false) {
  $('message-text').textContent = text; $('camera-message').hidden = !text; $('retry-camera').hidden = !retry;
}
function stopCamera() { stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; }
function stopRecordingTracks() { recordingStream?.getTracks().forEach(track => track.stop()); recordingStream = null; }
function cancelFrame() { cancelAnimationFrame(raf); raf = 0; lastFrame = null; }
function schedule() { if (!raf && !document.hidden && session.active && !disposed) raf = requestAnimationFrame(frame); }

async function openCamera() {
  if (session.active || disposed) return;
  const token = ++generation; ready = false; shutter.disabled = true; stopCamera();
  session.reset(); video.hidden = false; canvas.setAttribute('aria-hidden', 'true'); state('loading'); message('Allow camera access to begin.');
  $('instruction').textContent = 'Find your little corner of Ithaca.';
  $('again').hidden = true; $('save').hidden = true; $('flip-camera').hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) { state('error'); message('Open this page in Safari or Chrome to use your camera.', true); return; }
  try {
    engine ||= new Watercolor(canvas, { automatic: false });
    const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 }, frameRate: { ideal: 24, max: 30 }
    } });
    if (token !== generation || disposed) { next.getTracks().forEach(track => track.stop()); return; }
    stream = next; video.srcObject = next; await video.play();
    if (token !== generation || disposed) return;
    if (!video.videoWidth || !video.videoHeight) throw new Error('No camera frame');
    const track = next.getVideoTracks()[0];
    mirrored = track.getSettings().facingMode === 'user'; video.classList.toggle('mirrored', mirrored);
    track.addEventListener('ended', () => {
      if (stream !== next || !ready) return;
      ready = false; shutter.disabled = true; state('error'); message('Your camera disconnected. Tap to reconnect.', true);
    }, { once: true });
    ready = true; state('ready'); message(''); shutter.disabled = false;
    $('instruction').textContent = 'Tap to take a photo.';
    // Camera enumeration is optional; the shutter is ready before this resolves.
    navigator.mediaDevices.enumerateDevices?.().then(devices => {
      if (token === generation && ready) $('flip-camera').hidden = devices.filter(device => device.kind === 'videoinput').length < 2;
    }).catch(() => {});
  } catch (error) {
    if (token !== generation || disposed) return;
    stopCamera(); ready = false; state('error');
    const copy = {
      NotAllowedError: 'Allow camera access in your browser, then try again.',
      NotFoundError: 'No camera found. Open this on your phone.',
      NotReadableError: 'Your camera is busy. Close other camera apps and try again.'
    };
    message(copy[error.name] || (engine ? 'Your camera couldn’t start. Try again.' : 'This effect needs a browser with WebGL2. Try Safari or Chrome.'), Boolean(engine));
  }
}
function snapshot() {
  const width = video.videoWidth, height = video.videoHeight;
  if (!width || !height || video.readyState < 2) return false;
  const sw = Math.min(width, height * .8), sh = sw / .8;
  sourceContext.save();
  if (mirrored) { sourceContext.translate(source.width, 0); sourceContext.scale(-1, 1); }
  sourceContext.drawImage(video, (width-sw)/2, (height-sh)/2, sw, sh, 0, 0, source.width, source.height);
  sourceContext.restore(); return true;
}
function capture() {
  if (!ready || shutter.disabled || session.state !== 'ready' || !snapshot()) return false;
  if (!session.begin()) return false;
  ready = false; ++generation; shutter.disabled = true; $('flip-camera').hidden = true;
  recordedBlob = null; chunks = []; URL.revokeObjectURL(downloadUrl); downloadUrl = null;
  bloom.clear(); engine.updateCoverage(bloom.canvas); engine.setLiveSource(source); engine.setWater(.64); engine.setRecording(true);
  // This is the only camera-to-photo copy. All later frames paint this frozen photo.
  stopCamera(); video.hidden = true; canvas.setAttribute('aria-hidden', 'false'); state('painting'); message(''); $('instruction').textContent = 'Let it bloom.';
  $('studio').style.setProperty('--progress', 0);
  beginRecorder(); accumulator = 0; lastFrame = null; lastMaskFrame = 0; schedule(); return true;
}
function beginRecorder() {
  recorder = null; stopRecordingTracks();
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return;
  const mime = ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mime) return;
  try {
    recordingStream = canvas.captureStream(24);
    const current = new MediaRecorder(recordingStream, { mimeType: mime, videoBitsPerSecond: 4000000 }); recorder = current;
    current.ondataavailable = event => { if (event.data.size && recorder === current) chunks.push(event.data); };
    current.onstop = () => {
      if (recorder !== current || disposed) return;
      recordedBlob = chunks.length ? new Blob(chunks, { type: mime }) : null;
      stopRecordingTracks(); showReview();
    };
    current.onerror = () => { if (recorder !== current) return; recorder = null; recordedBlob = null; chunks = []; stopRecordingTracks(); if (session.state === 'review') showReview(); };
    current.start(250);
  } catch { recorder = null; stopRecordingTracks(); }
}
function frame(now) {
  raf = 0;
  if (document.hidden || !session.active || disposed) { lastFrame = null; return; }
  const delta = lastFrame === null ? 0 : Math.min(80, now - lastFrame); lastFrame = now;
  session.advance(delta); accumulator += delta;
  if (now - lastMaskFrame >= 28 || session.progress === 1) {
    bloom.paint(session.progress); engine.updateCoverage(bloom.canvas); lastMaskFrame = now;
  }
  const steps = Math.min(10, Math.floor(accumulator / (1000/120)));
  for (let i = 0; i < steps; i++) engine.step();
  accumulator -= steps * (1000/120);
  if (session.progress === 1 && steps > 0) engine.setRecording(false);
  engine.render(); $('studio').style.setProperty('--progress', session.progress);
  state(session.active ? session.state : 'finishing');
  if (session.state === 'review') {
    cancelFrame();
    if (recorder && ['recording','paused'].includes(recorder.state)) { try { recorder.stop(); } catch { stopRecordingTracks(); showReview(); } }
    else showReview();
  } else schedule();
}
function showReview() {
  if (session.state !== 'review' || disposed) return;
  state('review'); $('instruction').textContent = '';
  $('again').hidden = false; $('save').hidden = false;
  $('save-label').textContent = recordedBlob ? 'Save film' : 'Save photo';
  completed.splice(0).forEach(resolve => resolve({ state: session.state, durationMs: session.elapsed, simulationSteps: engine.steps, recordedBytes: recordedBlob?.size || 0 }));
}
shutter.addEventListener('click', capture);
$('again').addEventListener('click', openCamera);
$('retry-camera').addEventListener('click', openCamera);
$('flip-camera').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; openCamera(); });
$('save').addEventListener('click', async () => {
  if (session.state !== 'review') return;
  try {
    const blob = recordedBlob || await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No painting');
    URL.revokeObjectURL(downloadUrl); downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = downloadUrl;
    link.download = `paint-ithaca-${new Date().toISOString().slice(0,10)}.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('webm') ? 'webm' : 'png'}`; link.click();
  } catch { $('instruction').textContent = 'Couldn’t save. Please try again.'; }
});
function suspend() {
  ++generation; cancelFrame();
  if (recorder?.state === 'recording') recorder.pause();
  stopCamera();
  if (ready || $('studio').dataset.state === 'loading') {
    ready = false; shutter.disabled = true; state('paused'); message('Tap to reopen your camera.', true);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
  else if (session.active) { if (recorder?.state === 'paused') recorder.resume(); schedule(); }
});
window.addEventListener('pagehide', event => {
  suspend();
  if (!event.persisted) {
    disposed = true; if (recorder && recorder.state !== 'inactive') recorder.stop();
    stopRecordingTracks(); engine?.dispose(); URL.revokeObjectURL(downloadUrl);
  }
});
window.addEventListener('pageshow', event => { if (event.persisted && session.active) { if (recorder?.state === 'paused') recorder.resume(); schedule(); } });
// Captures only an already-open camera; permission is always managed by the browser.
if (document.modelContext?.registerTool) {
  try { Promise.resolve(document.modelContext.registerTool({
    name: 'capture_watercolor_photo', description: 'Tap the shutter on an already-open camera and wait for the frozen photo to finish blooming. Keeps the photo on this device.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute() {
      if (!ready || session.state !== 'ready') throw new Error('The camera must be ready.');
      const reviewed = new Promise(resolve => completed.push(resolve));
      if (!capture()) { completed.pop(); throw new Error('No camera frame is available.'); }
      return reviewed;
    }
  })).catch(() => {}); } catch {}
}
openCamera();
