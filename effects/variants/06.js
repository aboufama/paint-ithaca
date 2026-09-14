const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

function canvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function hash(x, y) {
  let n = Math.imul(x + 163, 374761393) ^ Math.imul(y + 827, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

// A faint contact-print frond gives the photographic emulsion a botanical edge.
function frond(ctx, x, y, scale, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#f4efd9';
  ctx.fillStyle = '#f4efd9';
  ctx.globalAlpha = 0.19;
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-5, -18, 5, -44, 0, -62);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const yy = -7 - i * 5.6;
    const len = 13 * Math.sin((i + 1) / 10 * Math.PI) + 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(side * len * 0.6, yy + 1, side * len, yy - 4, side * len, yy - 8);
      ctx.bezierCurveTo(side * len * 0.45, yy - 8, side * 1.5, yy - 3, 0, yy);
      ctx.fill();
    }
  }
  ctx.restore();
}

export default {
  id: '06',
  name: 'Prussian Sunprint',
  description: 'A blue photographic sunprint blooms across deckled cream paper.',
  duration: 2800,
  create({ width, height, photo }) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const paper = canvas(w, h);
    const pc = paper.getContext('2d');
    const print = canvas(w, h);
    const ic = print.getContext('2d', { willReadFrequently: true });
    ic.drawImage(photo, 0, 0, w, h);
    const source = ic.getImageData(0, 0, w, h);
    const pd = pc.createImageData(w, h);
    const pixels = source.data;
    const margin = Math.max(3, Math.min(w, h) * 0.024);
    const low = [7, 33, 69], mid = [26, 93, 139], high = [247, 242, 218];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        const grain = (hash(x, y) - 0.5) * 5.5;
        const pulp = (noise(x / 47, y / 47) - 0.5) * 5;
        const fiber = Math.sin(y * 2.12 + noise(x / 35, y / 7)) * 0.7;
        pd.data[k] = 247 + grain + pulp + fiber;
        pd.data[k + 1] = 241 + grain + pulp + fiber;
        pd.data[k + 2] = 220 + grain + pulp + fiber;
        pd.data[k + 3] = 255;

        const luminance = (pixels[k] * 0.2126 + pixels[k + 1] * 0.7152 + pixels[k + 2] * 0.0722) / 255;
        const tone = clamp(Math.pow(luminance, 0.91) + (noise(x / 19, y / 19) - 0.5) * 0.022);
        const mix = tone < 0.57 ? tone / 0.57 : (tone - 0.57) / 0.43;
        const a = tone < 0.57 ? low : mid;
        const b = tone < 0.57 ? mid : high;
        for (let ch = 0; ch < 3; ch++) pixels[k + ch] = a[ch] + (b[ch] - a[ch]) * mix + grain * 0.6;

        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        const deckle = (noise(x / 8, y / 8) - 0.5) * 4 + (hash(x, y) - 0.5) * 1.6;
        pixels[k + 3] = Math.round(255 * smooth((edge - margin + deckle) / 3.5));
      }
    }
    pc.putImageData(pd, 0, 0);
    ic.putImageData(source, 0, 0);
    ic.save();
    ic.globalCompositeOperation = 'source-atop';
    frond(ic, w * 0.083, h * 0.94, h / 360, -0.34);
    frond(ic, w * 0.94, h * 0.075, h / 460, Math.PI - 0.3);
    ic.restore();

    // Only the low-resolution developing bath changes each frame. The photo,
    // paper, pigment grain, deckle and exposure field are all prepared once.
    const mw = Math.max(1, Math.ceil(w / 3));
    const mh = Math.max(1, Math.ceil(h / 3));
    const mask = canvas(mw, mh);
    const mc = mask.getContext('2d');
    const bath = canvas(mw, mh);
    const bc = bath.getContext('2d');
    const md = mc.createImageData(mw, mh);
    const bd = bc.createImageData(mw, mh);
    const arrival = new Float32Array(mw * mh);
    const variation = new Float32Array(mw * mh);
    let earliest = Infinity, latest = -Infinity;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const j = y * mw + x;
        const nx = x / mw, ny = y / mh;
        const radial = Math.hypot((nx - 0.34) * 0.95, (ny - 0.39) * 0.87);
        const branching = (noise(nx * 6.4, ny * 6.4) - 0.5) * 0.13;
        const serration = (noise(nx * 29, ny * 29) - 0.5) * 0.035;
        arrival[j] = 0.065 + radial * 0.86 + branching + serration;
        earliest = Math.min(earliest, arrival[j]);
        latest = Math.max(latest, arrival[j]);
        variation[j] = noise(nx * 17, ny * 17);
        md.data[j * 4] = md.data[j * 4 + 1] = md.data[j * 4 + 2] = 255;
        bd.data[j * 4] = 78;
        bd.data[j * 4 + 1] = 150;
        bd.data[j * 4 + 2] = 170;
      }
    }
    const span = Math.max(0.001, latest - earliest);
    for (let i = 0; i < arrival.length; i++) {
      arrival[i] = 0.05 + (arrival[i] - earliest) / span * 0.75;
    }
    const developed = canvas(w, h);
    const dc = developed.getContext('2d');
    let disposed = false;

    return {
      draw(ctx, progress) {
        if (disposed) return;
        const p = clamp(Number.isFinite(progress) ? progress : 0);
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(paper, 0, 0, width, height);
        if (p <= 0) { ctx.restore(); return; }
        if (p >= 1) {
          ctx.drawImage(print, 0, 0, width, height);
          ctx.restore();
          return;
        }
        const exposure = 0.96 * (1 - Math.pow(1 - p, 1.32));
        const opening = smooth(p / 0.06);
        const drying = 1 - smooth((p - 0.82) / 0.18);
        for (let i = 0; i < arrival.length; i++) {
          const age = exposure - arrival[i];
          // Pigment strengthens behind a much softer cyan capillary halo.
          const pigment = smooth((age + 0.004) / 0.16) * opening;
          const halo = smooth((age + 0.072) / 0.09) * (1 - smooth((age - 0.02) / 0.21));
          md.data[i * 4 + 3] = pigment * 255;
          bd.data[i * 4 + 3] = halo * (42 + variation[i] * 28) * opening * drying;
        }
        mc.putImageData(md, 0, 0);
        bc.putImageData(bd, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bath, 0, 0, width, height);
        dc.clearRect(0, 0, w, h);
        dc.globalCompositeOperation = 'source-over';
        dc.drawImage(print, 0, 0);
        dc.globalCompositeOperation = 'destination-in';
        dc.drawImage(mask, 0, 0, w, h);
        dc.globalCompositeOperation = 'source-over';
        ctx.drawImage(developed, 0, 0, width, height);
        ctx.restore();
      },
      dispose() {
        disposed = true;
        for (const c of [paper, print, mask, bath, developed]) {
          c.width = 1;
          c.height = 1;
        }
      },
    };
  },
};
