import TidalBloom from './tidal-bloom.js?v=clip-4';
import { CaptureSession } from './capture-session.js';
import { SubmissionScene } from './submission-scene.js?v=submit-2';

const $ = id => document.getElementById(id);
const video = $('source-video'), preview = $('camera-preview'), canvas = $('painting'), shutter = $('shutter');
const flip = $('flip-camera'), buttonBloom = shutter.querySelector('.button-bloom');
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
let cameraTransitions = [];
let capturePreparation, captureTransition, buttonBloomAnimation, buttonPressAnimation;
let controlAnimations = [];
const cameraControlAnimations = new Map();
let hasMultipleCameras = false;
let buttonInkURL;
const submissionDuration = 1800, completed = [];
const buttonInkReady = prepareButtonInk();

async function prepareButtonInk() {
  const originalURL = buttonBloom.src;
  const raster = document.createElement('canvas');
  try {
    await buttonBloom.decode();
    if (disposed) return;
    // Rasterize once before capture: animated ink is a transparent bitmap,
    // with no SVG filter or mask for the compositor to rebuild mid-press.
    raster.width = raster.height = 360;
    raster.getContext('2d').drawImage(buttonBloom, 0, 0, 360, 360);
    const png = await new Promise(resolve => raster.toBlob(resolve, 'image/png'));
    if (!png || disposed) return;
    buttonInkURL = URL.createObjectURL(png); buttonBloom.src = buttonInkURL;
    await buttonBloom.decode();
  } catch {
    if (buttonInkURL) { URL.revokeObjectURL(buttonInkURL); buttonInkURL = null; }
    buttonBloom.src = originalURL;
  } finally { raster.width = raster.height = 0; }
}

function state(value) {
  $('studio').dataset.state = value;
  const capturing = ['ready','preparing','painting','settling','reviewing'].includes(value);
  setCameraControlVisible(shutter, capturing);
  setCameraControlVisible(flip, capturing && hasMultipleCameras);
  shutter.setAttribute('aria-label', ['preparing','painting','settling','reviewing'].includes(value) ? 'Painting photo' : 'Take photo');
  preview.setAttribute('aria-hidden', String(!['ready','returning'].includes(value)));
}
function message(text, retry = false) {
  $('message-text').textContent = text; $('camera-message').hidden = !text; $('retry-camera').hidden = !retry;
}
function stopCamera() {
  cancelCameraTransitions();
  cancelAnimationFrame(previewRaf); previewRaf = 0;
  stream?.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null;
}
function cancelCameraTransitions() {
  cameraTransitions.forEach(animation => animation.cancel()); cameraTransitions = [];
}
function cancelControlAnimations() {
  controlAnimations.forEach(animation => animation.cancel()); controlAnimations = [];
}
function setCameraControlVisible(button, visible) {
  const previous = cameraControlAnimations.get(button);
  if (previous?.visible === visible) return previous.finished;
  const from = button.hidden ? 0 : Number(getComputedStyle(button).opacity);
  previous?.animation?.cancel();
  const transition = { visible, animation: null, finished: Promise.resolve() };
  cameraControlAnimations.set(button, transition);
  if (reduceMotion.matches || (!visible && button.hidden)) {
    button.hidden = !visible; return transition.finished;
  }
  button.hidden = false;
  const animation = button.animate([{ opacity: from }, { opacity: visible ? 1 : 0 }], {
    duration: visible ? 90 : 140, easing: visible ? 'ease-out' : 'ease-in-out', fill: 'both'
  });
  transition.animation = animation;
  transition.finished = animation.finished.catch(() => {}).then(() => {
    if (cameraControlAnimations.get(button) !== transition) return;
    button.hidden = !visible;
    animation.cancel(); transition.animation = null;
  });
  return transition.finished;
}
function fadeIn(elements, duration = 180) {
  if (reduceMotion.matches) return;
  controlAnimations.push(...elements.filter(element => !element.hidden).map(element =>
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' })
  ));
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
  if (session.active || ['preparing','joining'].includes(submission) || ['preparing','reviewing','reopening','returning'].includes($('studio').dataset.state) || disposed) return;
  const returning = ['review','submitted'].includes($('studio').dataset.state);
  const focusShutter = $('again').matches(':focus-visible');
  const token = ++generation; ready = false; shutter.disabled = true; stopCamera();
  capturePreparation?.abort(); captureTransition?.cancel(); cancelControlAnimations();
  buttonBloomAnimation?.cancel(); buttonPressAnimation?.cancel();
  shutter.classList.remove('is-blooming'); flip.disabled = true;
  painting?.dispose(); painting = null; scene?.dispose(); scene = null; submission = 'idle';
  session.reset(); canvas.setAttribute('aria-hidden', String(!returning)); state(returning ? 'reopening' : 'loading'); message(returning ? '' : 'Allow camera access.');
  $('instruction').textContent = ''; $('studio').removeAttribute('aria-busy');
  $('again-label').textContent = 'Retake'; $('again').hidden = true; $('submit').hidden = true; $('submit').disabled = false;
  if (!navigator.mediaDevices?.getUserMedia) { state('error'); message('Open this page in Safari or Chrome to use your camera.', true); return; }
  try {
    if (!paintingContext || !sourceContext || !previewContext) throw new Error('Canvas unavailable');
    const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 }, frameRate: { ideal: 24, max: 30 }
    } });
    if (token !== generation || disposed) { next.getTracks().forEach(track => track.stop()); return; }
    stream = next; video.srcObject = next; await Promise.all([video.play(), buttonInkReady]);
    if (token !== generation || disposed) return;
    if (!video.videoWidth || !video.videoHeight) throw new Error('No camera frame');
    const track = next.getVideoTracks()[0]; mirrored = track.getSettings().facingMode === 'user';
    track.addEventListener('ended', () => {
      if (stream !== next || !ready) return;
      ready = false; stopCamera(); shutter.disabled = true; state('error'); message('Your camera disconnected. Tap to reconnect.', true);
    }, { once: true });
    copyVideo(previewContext, preview);
    ready = true; message('');
    previewTime = performance.now(); previewRaf = requestAnimationFrame(previewFrame);
    if (returning && !reduceMotion.matches) {
      state('returning');
      const timing = { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
      cameraTransitions = [
        canvas.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.025)' }], timing),
        preview.animate([{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'scale(1)' }], timing)
      ];
      await Promise.all(cameraTransitions.map(animation => animation.finished.catch(() => {})));
      if (token !== generation || disposed || !ready) return;
    }
    state('ready'); canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('aria-label', 'Your photo blooming into watercolor');
    cancelCameraTransitions(); shutter.disabled = false; flip.disabled = false;
    if (returning && focusShutter) shutter.focus({ preventScroll: true });
    void loadMosaicImages();
    navigator.mediaDevices.enumerateDevices?.().then(devices => {
      if (token === generation && ready) {
        hasMultipleCameras = devices.filter(device => device.kind === 'videoinput').length > 1;
        setCameraControlVisible(flip, hasMultipleCameras);
      }
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
function bloomButton(event) {
  const bounds = shutter.getBoundingClientRect();
  const x = event?.detail ? Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) : bounds.width / 2;
  const y = event?.detail ? Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)) : bounds.height / 2;
  shutter.style.setProperty('--bloom-x', `${x}px`); shutter.style.setProperty('--bloom-y', `${y}px`);
  shutter.classList.add('is-blooming');
  // A fresh animation owns every press, including the first one after Retake.
  // CSS animation state can otherwise survive while the button is hidden.
  buttonBloomAnimation?.cancel(); buttonPressAnimation?.cancel();
  if (reduceMotion.matches) return;
  buttonBloomAnimation = buttonBloom.animate([
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.03) rotate(-12deg)', offset: 0 },
    { opacity: 1, offset: .12 },
    { opacity: .95, offset: .72 },
    { opacity: .68, transform: 'translate(-50%,-50%) scale(1) rotate(12deg)', offset: 1 }
  ], { duration: 560, easing: 'cubic-bezier(.16,.68,.25,1)', fill: 'both' });
  buttonPressAnimation = shutter.animate([
    { transform: getComputedStyle(shutter).transform },
    { transform: 'scale(.96)', offset: .25 },
    { transform: 'scale(1)' }
  ], { duration: 260, easing: 'ease-out' });
}
function capture(event) {
  if (!ready || shutter.disabled || session.state !== 'ready' || !copyVideo(sourceContext, source)) return false;
  ready = false; ++generation; shutter.disabled = true; flip.disabled = true;
  // The immutable, unpainted photograph remains separate from all preview effects.
  // Keep that exact frame on both visible surfaces before releasing the camera.
  previewContext.drawImage(source, 0, 0); paintingContext.drawImage(source, 0, 0);
  canvas.setAttribute('aria-hidden', 'false'); state('preparing'); message(''); bloomButton(event);
  stopCamera();
  capturePreparation = new AbortController();
  void preparePainting(capturePreparation.signal);
  return true;
}
async function preparePainting(signal) {
  try {
    painting?.dispose(); painting = null;
    const next = await TidalBloom.createAsync({ width: canvas.width, height: canvas.height, photo: source }, { signal });
    if (disposed || signal.aborted) { next.dispose(); return; }
    painting = next;
    session.begin(); state('painting');
    // The frozen photograph stays underneath. The first paper/sketch frames
    // dissolve into it instead of cutting to an empty, bright viewfinder.
    if (!reduceMotion.matches) {
      captureTransition = canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-in-out' });
      if (document.hidden) captureTransition.pause();
    }
    painting.draw(paintingContext, reduceMotion.matches ? 1 : 0);
    renderedFrames = 1; lastFrame = null;
    if (reduceMotion.matches) { session.advance(TidalBloom.duration); showReview(); }
    else schedule();
  } catch {
    if (signal.aborted || disposed) return;
    painting?.dispose(); painting = null;
    state('error'); message('Couldn’t paint this photo. Tap to try again.', true);
    completed.splice(0).forEach(resolve => resolve({ state: 'error', message: 'Couldn’t paint this photo.' }));
  }
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
  if (session.state === 'review') { cancelFrame(); void showReview(true); }
  else { state(session.state); schedule(); }
}
async function showReview(animate = false) {
  if (session.state !== 'review' || disposed) return;
  cancelControlAnimations();
  if (animate && !reduceMotion.matches) {
    state('reviewing');
    // Fade the actual controls, then hide them only after both are transparent.
    // The incoming actions have their own fade, without resetting a shared row.
    await Promise.all([setCameraControlVisible(shutter, false), setCameraControlVisible(flip, false)]);
    if (disposed) return;
  }
  state('review'); $('instruction').textContent = '';
  $('again').hidden = false; $('submit').hidden = false;
  cancelControlAnimations(); fadeIn([$('again'), $('submit')]);
  completed.splice(0).forEach(resolve => resolve({ state: session.state, effect: TidalBloom.name, durationMs: session.elapsed, renderedFrames }));
}
async function submitPhoto() {
  if (session.state !== 'review' || $('studio').dataset.state !== 'review' || submission !== 'idle' || disposed) return;
  restoreSubmitFocus = $('submit').matches(':focus-visible');
  cancelControlAnimations();
  submission = 'preparing'; state('submitting'); $('studio').setAttribute('aria-busy', 'true');
  $('submit').disabled = true; $('submit').hidden = true; $('again').hidden = true;
  canvas.setAttribute('aria-label', 'Your photo joining the shared collection');
  $('instruction').textContent = '';
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
  $('instruction').textContent = 'Thanks for contributing to the Paint Ithaca project :)'; $('again-label').textContent = 'Capture another'; $('again').hidden = false;
  cancelControlAnimations(); fadeIn([$('instruction'), $('again')], 200);
  if (restoreSubmitFocus) $('again').focus({ preventScroll: true });
}
shutter.addEventListener('click', capture);
$('again').addEventListener('click', openCamera);
$('retry-camera').addEventListener('click', openCamera);
$('flip-camera').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; openCamera(); });
$('submit').addEventListener('click', submitPhoto);
function suspend() {
  ++generation; cancelFrame(); stopCamera();
  if (captureTransition?.playState === 'running') captureTransition.pause();
  if (ready || ['loading','reopening','returning'].includes($('studio').dataset.state)) {
    ready = false; shutter.disabled = true; flip.disabled = true; state('paused'); message('Tap to reopen your camera.', true);
  }
}
function resume() {
  if (captureTransition?.playState === 'paused') captureTransition.play();
  schedule();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
window.addEventListener('pagehide', event => {
  suspend();
  if (!event.persisted) {
    disposed = true; capturePreparation?.abort(); captureTransition?.cancel(); cancelControlAnimations();
    cameraControlAnimations.forEach(transition => transition.animation?.cancel()); cameraControlAnimations.clear();
    if (buttonInkURL) URL.revokeObjectURL(buttonInkURL);
    buttonBloomAnimation?.cancel(); buttonPressAnimation?.cancel(); painting?.dispose(); scene?.dispose();
  }
});
window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
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
