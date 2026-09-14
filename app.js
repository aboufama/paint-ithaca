import TidalBloom from './tidal-bloom.js?v=quick-1';
import { CaptureSession } from './capture-session.js';
import { SubmissionScene } from './submission-scene.js?v=submit-2';

const $ = id => document.getElementById(id);
const video = $('source-video'), preview = $('camera-preview'), canvas = $('painting'), shutter = $('shutter');
video.controls = false; video.disablePictureInPicture = true; video.disableRemotePlayback = true;
const source = document.createElement('canvas'); source.id = 'capture-source'; source.width = 800; source.height = 1000;
const sourceContext = source.getContext('2d', { alpha: false, willReadFrequently: true });
canvas.width = preview.width = source.width; canvas.height = preview.height = source.height;
const paintingContext = canvas.getContext('2d', { alpha: false });
const previewContext = preview.getContext('2d', { alpha: false });
const session = new CaptureSession({ paintDuration: TidalBloom.duration });
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let painting, scene, stream, ready = false, generation = 0, facing = 'environment', mirrored = false;
let raf = 0, previewRaf = 0, previewTime = 0, lastFrame = null, renderedFrames = 0, disposed = false;
let submission = 'idle', submissionElapsed = 0, mosaicPromise, restoreSubmitFocus = false;
const submissionDuration = 2200, completed = [];

function state(value) {
  $('studio').dataset.state = value;
  shutter.hidden = ['painting','settling','review','submitting','submitted'].includes(value);
  preview.setAttribute('aria-hidden', String(value !== 'ready'));
}
function message(text, retry = false) {
  $('message-text').textContent = text; $('camera-message').hidden = !text; $('retry-camera').hidden = !retry;
}
function stopCamera() {
  cancelAnimationFrame(previewRaf); previewRaf = 0;
  stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null;
}
function cancelFrame() { cancelAnimationFrame(raf); raf = 0; lastFrame = null; }
function schedule() { if (!raf && !document.hidden && (session.active || submission === 'joining') && !disposed) raf = requestAnimationFrame(frame); }
function copyVideo(context, target) {
  const width = video.videoWidth, height = video.videoHeight;
  if (!width || !height || video.readyState < 2) return false;
  const sw = Math.min(width, height * .8), sh = sw / .8;
  context.save();
  if (mirrored) { context.translate(target.width, 0); context.scale(-1, 1); }
  context.drawImage(video, (width-sw)/2, (height-sh)/2, sw, sh, 0, 0, target.width, target.height);
  context.restore(); return true;
}
function previewFrame(now) {
  previewRaf = 0;
  if (!ready || !stream || document.hidden || disposed) return;
  if (now - previewTime >= 1000 / 24) { copyVideo(previewContext, preview); previewTime = now; }
  previewRaf = requestAnimationFrame(previewFrame);
}
async function loadMosaicImages() {
  if (!mosaicPromise) mosaicPromise = (async () => {
    try {
      const base = new URL('./assets/mosaic/', import.meta.url);
      const response = await fetch(new URL('manifest.json', base));
      if (!response.ok) throw new Error('Mosaic unavailable');
      const filenames = await response.json();
      const images = await Promise.allSettled(filenames.map(async filename => {
        const image = new Image(); image.src = new URL(filename, base).href; await image.decode(); return image;
      }));
      return images.filter(result => result.status === 'fulfilled').map(result => result.value);
    } catch { return []; }
  })();
  return mosaicPromise;
}

async function openCamera() {
  if (session.active || ['preparing','joining'].includes(submission) || disposed) return;
  const token = ++generation; ready = false; shutter.disabled = true; stopCamera();
  painting?.dispose(); painting = null; scene?.dispose(); scene = null; submission = 'idle';
  session.reset(); canvas.setAttribute('aria-label', 'Your photo blooming into watercolor'); canvas.setAttribute('aria-hidden', 'true'); state('loading'); message('Allow camera access.');
  $('instruction').textContent = ''; $('studio').removeAttribute('aria-busy');
  $('again-label').textContent = 'Retake'; $('again').hidden = true; $('submit').hidden = true; $('submit').disabled = false; $('flip-camera').hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) { state('error'); message('Open this page in Safari or Chrome to use your camera.', true); return; }
  try {
    if (!paintingContext || !sourceContext || !previewContext) throw new Error('Canvas unavailable');
    const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 }, frameRate: { ideal: 24, max: 30 }
    } });
    if (token !== generation || disposed) { next.getTracks().forEach(track => track.stop()); return; }
    stream = next; video.srcObject = next; await video.play();
    if (token !== generation || disposed) return;
    if (!video.videoWidth || !video.videoHeight) throw new Error('No camera frame');
    const track = next.getVideoTracks()[0]; mirrored = track.getSettings().facingMode === 'user';
    track.addEventListener('ended', () => {
      if (stream !== next || !ready) return;
      ready = false; stopCamera(); shutter.disabled = true; state('error'); message('Your camera disconnected. Tap to reconnect.', true);
    }, { once: true });
    copyVideo(previewContext, preview);
    ready = true; state('ready'); message(''); shutter.disabled = false;
    previewTime = performance.now(); previewRaf = requestAnimationFrame(previewFrame);
    void loadMosaicImages();
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
    message(copy[error.name] || 'Your camera couldn’t start. Try again.', true);
  }
}
function capture() {
  if (!ready || shutter.disabled || session.state !== 'ready' || !copyVideo(sourceContext, source)) return false;
  ready = false; ++generation; shutter.disabled = true; $('flip-camera').hidden = true;
  // The immutable, unpainted photograph remains separate from all preview effects.
  stopCamera();
  try {
    painting?.dispose(); painting = null;
    painting = TidalBloom.create({ width: canvas.width, height: canvas.height, photo: source });
    painting.draw(paintingContext, 0);
  } catch {
    painting?.dispose(); painting = null;
    state('error'); message('Couldn’t paint this photo. Tap to try again.', true); return false;
  }
  session.begin(); canvas.setAttribute('aria-hidden', 'false'); state('painting'); message('');
  renderedFrames = 1; lastFrame = null; schedule(); return true;
}
function frame(now) {
  raf = 0;
  if (document.hidden || disposed) { lastFrame = null; return; }
  const delta = lastFrame === null ? 0 : Math.min(80, now - lastFrame); lastFrame = now;
  if (submission === 'joining') {
    submissionElapsed += delta;
    const progress = Math.min(1, submissionElapsed / submissionDuration);
    scene.draw(progress);
    if (progress === 1) finishSubmission(); else schedule();
    return;
  }
  if (!session.active) return;
  session.advance(delta); painting.draw(paintingContext, session.progress); renderedFrames++;
  if (session.state === 'review') { cancelFrame(); showReview(); }
  else { state(session.state); schedule(); }
}
function showReview() {
  if (session.state !== 'review' || disposed) return;
  state('review'); $('instruction').textContent = '';
  $('again').hidden = false; $('submit').hidden = false;
  completed.splice(0).forEach(resolve => resolve({ state: session.state, effect: TidalBloom.name, durationMs: session.elapsed, renderedFrames }));
}
async function submitPhoto() {
  if (session.state !== 'review' || submission !== 'idle' || disposed) return;
  restoreSubmitFocus = $('submit').matches(':focus-visible');
  submission = 'preparing'; state('submitting'); $('studio').setAttribute('aria-busy', 'true');
  $('submit').disabled = true; $('submit').hidden = true; $('again').hidden = true;
  canvas.setAttribute('aria-label', 'Your photo joining a shared reconstruction preview');
  $('instruction').textContent = 'Reconstruction preview';
  try {
    const images = await loadMosaicImages();
    if (disposed) return;
    scene = new SubmissionScene(canvas);
    await scene.prepare(canvas, { images });
    if (disposed) { scene.dispose(); return; }
    submission = 'joining'; submissionElapsed = 0; lastFrame = null;
    scene.draw(reduceMotion.matches ? 1 : 0);
    if (reduceMotion.matches) finishSubmission(); else schedule();
  } catch {
    scene?.dispose(); scene = null; submission = 'idle';
    painting.draw(paintingContext, 1); showReview(); $('submit').disabled = false;
    $('studio').removeAttribute('aria-busy'); $('instruction').textContent = 'Couldn’t prepare the preview. Try again.';
  }
}
function finishSubmission() {
  cancelFrame(); submission = 'complete'; state('submitted'); $('studio').removeAttribute('aria-busy');
  canvas.setAttribute('aria-label', 'Your photo among a collection of Ithaca images');
  $('instruction').textContent = 'Added to preview'; $('again-label').textContent = 'Capture another'; $('again').hidden = false;
  if (restoreSubmitFocus) $('again').focus({ preventScroll: true });
}
shutter.addEventListener('click', capture);
$('again').addEventListener('click', openCamera);
$('retry-camera').addEventListener('click', openCamera);
$('flip-camera').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; openCamera(); });
$('submit').addEventListener('click', submitPhoto);
function suspend() {
  ++generation; cancelFrame(); stopCamera();
  if (ready || $('studio').dataset.state === 'loading') {
    ready = false; shutter.disabled = true; $('flip-camera').hidden = true; state('paused'); message('Tap to reopen your camera.', true);
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else schedule(); });
window.addEventListener('pagehide', event => {
  suspend();
  if (!event.persisted) { disposed = true; painting?.dispose(); scene?.dispose(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) schedule(); });
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
