import { Watercolor } from './watercolor.js';
import { createCamera } from './camera.js';

const $ = (id) => document.getElementById(id);
const pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
let photos = [], contributions = [], selectedPlace = 'all', selectedPhoto = null, capturedOriginal = null, isSampleCapture = false, paused = matchMedia('(prefers-reduced-motion: reduce)').matches, painted = true, engine, sourceVersion = 0;
let database;
const imageCache = new Map();
const toast = (message) => { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 4000); };
const text = (tag, content, className) => { const el = document.createElement(tag); el.textContent = content; if (className) el.className = className; return el; };

function openDialog(id) { $(id).showModal(); }
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.dialog)));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
});

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('paint-ithaca-demo', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function dbAction(action, value) {
  database ||= await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('photos', action === 'getAll' ? 'readonly' : 'readwrite');
    const request = transaction.objectStore('photos')[action](...(value === undefined ? [] : [value]));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
function visiblePhotos() {
  const items = photos.map(photo => contributions.filter(item => item.place === photo.place).at(-1) || photo);
  const other = contributions.filter(item => !photos.some(photo => photo.place === item.place)).at(-1);
  if (other) items[5] = other;
  return items;
}
function setPlace(id) {
  if (id !== 'all' && ![...photos, ...contributions].some(item => item.id === id || item.place === id)) throw new Error('Unknown place');
  selectedPlace = id;
  document.querySelectorAll('.place-filter').forEach(button => {
    const active = button.dataset.place === id; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.tile').forEach(tile => tile.classList.toggle('dimmed', id !== 'all' && tile.dataset.place !== id));
  redrawPainting();
}
function renderFilters() {
  const parent = $('place-filters'); parent.replaceChildren();
  const places = [{ id: 'all', place: 'All of Ithaca', color: null }, ...photos];
  if (contributions.some(item => item.place === 'Somewhere else in Ithaca')) places.push({ id: 'elsewhere', place: 'Somewhere else in Ithaca', color: '#c9c7b4' });
  places.forEach((place, index) => {
    const id = index ? place.place : 'all';
    const button = text('button', '', 'place-filter'); button.dataset.place = id; button.setAttribute('aria-pressed', String(selectedPlace === id)); button.classList.toggle('active', selectedPlace === id);
    const swatch = text('span', '', 'swatch' + (index === 0 ? ' all-swatch' : '')); if (place.color) swatch.style.background = place.color; swatch.setAttribute('aria-hidden', 'true');
    button.append(swatch, text('span', place.place)); button.addEventListener('click', () => setPlace(id)); parent.append(button);
  });
}
function showDetail(photo) {
  $('detail-image').src = photo.image; $('detail-image').alt = photo.alt || photo.caption || photo.place;
  $('detail-place').textContent = photo.place; $('detail-title').textContent = photo.title || 'Your little piece of Ithaca';
  $('detail-caption').textContent = photo.caption || photo.alt;
  const credit = $('detail-credit'); credit.replaceChildren();
  if (photo.local) credit.textContent = photo.sample ? 'Sample camera capture · Cayuga Lake by Acurarri · CC BY-SA 4.0. Cropped and painted; saved only in this browser.' : 'Your photo · saved only in this browser. Not submitted to a server.';
  else { credit.append(text('span', `Photo by ${photo.author} · `)); const a = text('a', photo.license); a.href = photo.sourcePage; a.target = '_blank'; a.rel = 'noreferrer'; credit.append(a, text('span', ' · cropped and painted for this demo.')); }
  openDialog('detail-dialog');
}
function renderMosaic() {
  $('mosaic').replaceChildren();
  visiblePhotos().forEach(photo => {
    const button = text('button', '', 'tile'); button.dataset.place = photo.place; button.setAttribute('aria-label', `Explore ${photo.place}: ${photo.title}`);
    const img = new Image(); img.src = photo.image; img.alt = photo.alt || photo.place; img.draggable = false;
    const label = text('span', '', 'tile-label'); label.innerHTML = pin; label.append(text('span', photo.place));
    button.append(img, label); button.addEventListener('click', () => { if (!dragged) showDetail(photo); }); $('mosaic').append(button);
  });
  $('view-count').textContent = photos.length + contributions.length;
  $('place-count').textContent = new Set([...photos, ...contributions].map(p => p.place)).size;
  renderFilters(); renderLocal(); redrawPainting();
}
function renderLocal() {
  $('local-section').hidden = contributions.length === 0; $('local-grid').replaceChildren();
  contributions.toReversed().forEach(photo => {
    const card = text('div', '', 'local-card'), button = text('button', ''); const img = new Image(); img.src = photo.image; img.alt = photo.caption || photo.place;
    button.append(img, text('p', photo.place)); button.addEventListener('click', () => showDetail(photo));
    const remove = text('button', 'Remove from this device', 'remove-photo'); remove.setAttribute('aria-label', `Remove contribution: ${photo.caption || photo.place}`);
    remove.addEventListener('click', async () => { try { await dbAction('delete', photo.id); contributions = contributions.filter(p => p.id !== photo.id); selectedPlace = 'all'; renderMosaic(); toast('Your photo was removed from this device.'); } catch { toast('Couldn’t remove the photo. Please try again.'); } });
    card.append(button, remove); $('local-grid').append(card);
  });
}
async function loadImage(src) {
  if (!imageCache.has(src)) imageCache.set(src, new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; }));
  return imageCache.get(src);
}
async function redrawPainting() {
  const version = ++sourceVersion;
  if (!engine || !photos.length) return;
  const items = visiblePhotos();
  try {
    const images = await Promise.all(items.map(photo => loadImage(photo.image)));
    if (version !== sourceVersion) return;
    const rect = $('mosaic').getBoundingClientRect();
    const source = document.createElement('canvas'); source.width = 1024; source.height = Math.round(1024 * rect.height / rect.width);
    const ctx = source.getContext('2d'); ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, source.width, source.height);
    [...$('mosaic').children].forEach((tile, i) => {
      const r = tile.getBoundingClientRect(), x = (r.left - rect.left) / rect.width * source.width, y = (r.top - rect.top) / rect.height * source.height;
      const w = r.width / rect.width * source.width, h = r.height / rect.height * source.height, image = images[i];
      const scale = Math.max(w / image.width, h / image.height);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      if (selectedPlace !== 'all' && items[i].place !== selectedPlace) ctx.globalAlpha = .15;
      ctx.drawImage(image, x + (w - image.width * scale) / 2, y + (h - image.height * scale) / 2, image.width * scale, image.height * scale); ctx.restore();
    });
    engine.setSource(source); engine.setPaused(paused);
  } catch { toast('A sample photo couldn’t load. Try refreshing the canvas.'); }
}
let dragged = false, pointerStart = null;
const watercolorCanvas = document.createElement('canvas'); watercolorCanvas.id = 'watercolor'; watercolorCanvas.setAttribute('aria-hidden', 'true'); $('artboard').append(watercolorCanvas);
try { engine = new Watercolor(watercolorCanvas); } catch (error) { console.warn('Watercolor unavailable:', error.message); painted = false; $('painted-view').disabled = true; $('painted-view').title = 'This browser does not support WebGL2 watercolor.'; toast('Watercolor needs WebGL2. You can still explore and contribute photos.'); }
$('mosaic').addEventListener('pointerdown', event => { if (!painted) return; pointerStart = [event.clientX,event.clientY]; dragged = false; });
window.addEventListener('pointerup', () => { pointerStart = null; setTimeout(() => dragged = false, 0); });
$('mosaic').addEventListener('pointermove', event => {
  if (!pointerStart || !painted) return;
  if (Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) dragged = true;
  if (!dragged) return;
  const r = $('mosaic').getBoundingClientRect(); engine?.splat((event.clientX-r.left)/r.width, 1-(event.clientY-r.top)/r.height);
});
new ResizeObserver(() => { clearTimeout(redrawPainting.timer); redrawPainting.timer = setTimeout(redrawPainting, 150); }).observe($('mosaic'));
function setPainted(value) { painted = value && !!engine; $('painted-view').classList.toggle('selected', painted); $('painted-view').setAttribute('aria-pressed', painted); $('original-view').classList.toggle('selected', !painted); $('original-view').setAttribute('aria-pressed', !painted); watercolorCanvas.hidden = !painted; $('artboard').classList.toggle('painted', painted); $('wash').disabled = !painted; engine?.setVisible(painted); }
$('painted-view').addEventListener('click', () => setPainted(true)); $('original-view').addEventListener('click', () => setPainted(false));
$('wash').addEventListener('input', event => { $('wash-value').textContent = `${event.target.value}%`; engine?.setWater(Number(event.target.value)/100); });
function updatePlayback() { $('artboard').classList.toggle('paused', paused); $('play-icon').textContent = paused ? '▷' : 'Ⅱ'; $('play-label').textContent = paused ? 'Painting paused' : 'A living painting'; $('play-toggle').setAttribute('aria-label', paused ? 'Play the moving mosaic' : 'Pause the moving mosaic'); engine?.setPaused(paused); }
$('play-toggle').addEventListener('click', () => { paused = !paused; updatePlayback(); });
const repaint = text('button', '↻ Repaint the canvas', 'text-button repaint-button'); repaint.id = 'repaint'; repaint.addEventListener('click', () => { setPainted(true); paused = false; engine?.replay(); updatePlayback(); }); document.querySelector('.wash-panel').append(repaint);

function resetUpload() { selectedPhoto = null; capturedOriginal = null; isSampleCapture = false; document.querySelector('.consent span').textContent = 'This is my photo, and I’m happy for it to be part of the painting.'; $('upload-form').reset(); $('photo-preview').hidden = true; $('file-error').textContent = ''; $('submit-error').textContent = ''; $('upload-success').hidden = true; $('upload-form-panel').hidden = false; }
const camera = createCamera({ onCapture({ dataUrl, originalImage, sample }) {
  resetUpload(); selectedPhoto = dataUrl; capturedOriginal = originalImage; isSampleCapture = sample; $('photo-preview').src = dataUrl; $('photo-preview').hidden = false;
  if(sample) { document.querySelector('.consent span').textContent = 'Add this sample to my device-only demo canvas.'; $('photo-place').value = 'Cayuga Lake'; $('photo-caption').value = 'Sample camera view'; }
  $('upload-title').innerHTML = 'A little piece, <em>captured.</em>';
  openDialog('upload-dialog');
} });
document.querySelectorAll('.open-camera').forEach(button => button.addEventListener('click', () => camera.open()));
document.querySelectorAll('.add-photo').forEach(button => button.addEventListener('click', () => { camera.close(); resetUpload(); $('upload-title').innerHTML = 'What does <em>your Ithaca</em> look like?'; openDialog('upload-dialog'); }));
async function preparePhoto(file) {
  $('file-error').textContent = ''; selectedPhoto = null; $('photo-preview').hidden = true;
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { $('file-error').textContent = 'Choose a JPG, PNG, or WebP photo.'; return; }
  if (file.size > 15 * 1024 * 1024) { $('file-error').textContent = 'That photo is a little large. Choose one under 15 MB.'; return; }
  const button = $('submit-photo'); button.disabled = true;
  try {
    const bitmap = await createImageBitmap(file); if (!bitmap.width || !bitmap.height) throw new Error('Empty image');
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    selectedPhoto = canvas.toDataURL('image/jpeg', .85); $('photo-preview').src = selectedPhoto; $('photo-preview').hidden = false;
  } catch { $('file-error').textContent = 'We couldn’t open that photo. Try another JPG or PNG.'; } finally { button.disabled = false; }
}
$('photo-input').addEventListener('change', event => preparePhoto(event.target.files[0]));
['dragenter','dragover'].forEach(name => $('dropzone').addEventListener(name, event => { event.preventDefault(); $('dropzone').classList.add('dragging'); }));
['dragleave','drop'].forEach(name => $('dropzone').addEventListener(name, event => { event.preventDefault(); $('dropzone').classList.remove('dragging'); if(name === 'drop') preparePhoto(event.dataTransfer.files[0]); }));
$('upload-form').addEventListener('submit', async event => {
  event.preventDefault(); $('submit-error').textContent = '';
  if (!selectedPhoto) { $('file-error').textContent = 'Choose a photo first.'; $('photo-input').focus(); return; }
  if (!$('upload-form').reportValidity()) return;
  const button = $('submit-photo'); button.disabled = true; button.textContent = 'Adding your little piece…';
  const photo = { id: crypto.randomUUID(), image: selectedPhoto, place: $('photo-place').value, caption: $('photo-caption').value.trim(), title: 'Your little piece of Ithaca', local: true, sample: isSampleCapture, originalImage: capturedOriginal, createdAt: new Date().toISOString() };
  try {
    await dbAction('put', photo); contributions.push(photo); selectedPlace = 'all'; renderMosaic(); $('success-photo').src = selectedPhoto;
    $('upload-form-panel').hidden = true; $('upload-success').hidden = false; $('upload-dialog').scrollTop = 0; $('back-to-canvas').focus();
  } catch { $('submit-error').textContent = 'Your browser couldn’t save this photo. Storage may be full or disabled. Try a smaller photo or another browser.'; }
  finally { button.disabled = false; button.textContent = 'Add my little piece ↗'; }
});
$('back-to-canvas').addEventListener('click', () => { $('upload-dialog').close(); $('canvas').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); });
$('add-another').addEventListener('click', () => { resetUpload(); $('photo-input').focus(); });

let filmStream, filmRecorder, filmUrl;
$('watch-film').addEventListener('click', () => {
  if (!engine || !watercolorCanvas.captureStream) { toast('Live film preview needs a browser with canvas video support.'); return; }
  openDialog('film-dialog'); filmStream?.getTracks().forEach(track => track.stop()); filmStream = watercolorCanvas.captureStream(24); $('daily-film').srcObject = filmStream; $('daily-film').muted = true; $('daily-film').play().catch(() => {});
  engine.setPaused(false); engine.setVisible(true); engine.replay();
  $('film-description').textContent = 'Live frontend preview: your current canvas coming to life in watercolor. The completed daily film will come from your existing backend.';
});
$('film-dialog').addEventListener('close', () => { filmStream?.getTracks().forEach(track => track.stop()); $('daily-film').srcObject = null; if (filmRecorder?.state === 'recording') filmRecorder.stop(); engine?.setPaused(paused); engine?.setVisible(painted); });
$('download-film').addEventListener('click', event => {
  event.preventDefault();
  if (!filmStream || typeof MediaRecorder === 'undefined') { toast('Recording is not supported in this browser.'); return; }
  if (filmRecorder?.state === 'recording') return;
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(mime => MediaRecorder.isTypeSupported(mime));
  if (!type) { toast('Your browser can preview this film but cannot export it.'); return; }
  const chunks = []; filmRecorder = new MediaRecorder(filmStream, { mimeType: type });
  filmRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  filmRecorder.onstop = () => { URL.revokeObjectURL(filmUrl); filmUrl = URL.createObjectURL(new Blob(chunks, { type })); const a = document.createElement('a'); a.href = filmUrl; a.download = `paint-ithaca-preview.${type.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); $('download-film').textContent = 'Save an 8-second preview ↓'; };
  filmRecorder.onerror = () => { $('download-film').textContent = 'Save an 8-second preview ↓'; toast('The recording could not be completed.'); };
  engine.replay(); filmRecorder.start(); $('download-film').textContent = 'Recording your painting…'; setTimeout(() => { if (filmRecorder?.state === 'recording') filmRecorder.stop(); }, 8000);
});

async function init() {
  try {
    const response = await fetch('./data/edition.json'); if (!response.ok) throw new Error('Edition unavailable'); const edition = await response.json(); photos = edition.photos;
    $('edition-title').textContent = edition.title;
    try { contributions = await dbAction('getAll'); } catch { toast('Device storage is unavailable. Photos can be explored, but contributions cannot be saved.'); }
    [...photos.map(photo => photo.place), 'Somewhere else in Ithaca'].forEach(place => { const option = text('option', place); option.value = place; $('photo-place').append(option); });
    photos.forEach(photo => { const row = text('div', '', 'credit-row'); const source = text('a', photo.place); source.href = photo.sourcePage; source.target = '_blank'; source.rel = 'noreferrer'; const license = text('a', photo.license); license.href = photo.licenseUrl; license.target = '_blank'; license.rel = 'noreferrer'; row.append(source, text('br',''), text('span', `${photo.author} · `), license); $('credit-list').append(row); });
    renderMosaic(); setPainted(painted); updatePlayback();
  } catch { $('board-empty').hidden = false; $('board-empty').textContent = 'The canvas couldn’t load. Please refresh to try again.'; $('mosaic').hidden = true; watercolorCanvas.hidden = true; }
}
init();

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = tool => { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
  register({ name: 'filter_canvas_by_place', description: 'Filter the visible Paint Ithaca canvas. Use all or an exact displayed place name.', inputSchema: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input) { if (!input || typeof input.place !== 'string') throw new Error('A place is required.'); setPlace(input.place); return { place: selectedPlace }; } });
  register({ name: 'start_photo_contribution', description: 'Open the photo contribution form. Does not select, upload, or save a photo.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute() { resetUpload(); openDialog('upload-dialog'); return { formOpen: true, storage: 'device-only-demo' }; } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
