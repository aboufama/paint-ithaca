const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
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

// Tidal's watercolor, Graphite's pencil, and Sunprint's developing edge share
// one wet front. Every draw is a pure function of progress.
export default {
  id: '01',
  name: 'Tidal Bloom',
  description: 'Natural watercolor follows delicate pencil into a softly branching bloom.',
  duration: 2800,
  create({ width, height, photo }) {
    const makeCanvas = (w = width, h = height) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      return canvas;
    };
    let seed = 17013;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const paper = makeCanvas();
    const painted = makeCanvas();
    const grain = makeCanvas();
    const graphite = makeCanvas();
    const revealed = makeCanvas();
    const mw = Math.max(1, Math.ceil(width / 3));
    const mh = Math.max(1, Math.ceil(height / 3));
    const mask = makeCanvas(mw, mh);
    const sketchMask = makeCanvas(mw, mh);
    const bath = makeCanvas(mw, mh);
    const pctx = paper.getContext('2d');
    const paint = painted.getContext('2d', { willReadFrequently: true });
    const gctx = grain.getContext('2d');
    const pencil = graphite.getContext('2d', { willReadFrequently: true });
    const rctx = revealed.getContext('2d');
    const mctx = mask.getContext('2d');
    const sctx = sketchMask.getContext('2d');
    const bctx = bath.getContext('2d');
    const paperPixels = pctx.createImageData(width, height);
    const grainPixels = gctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const speckle = (random() - 0.5) * 6;
        const fiber = Math.sin(x * 1.47 + y * 0.09) * Math.sin(y * 1.33) * 1.1;
        const cloudy = Math.sin(x / 41 + y / 59) * 1.2;
        paperPixels.data[i] = 245 + speckle + fiber + cloudy;
        paperPixels.data[i + 1] = 239 + speckle + fiber + cloudy;
        paperPixels.data[i + 2] = 226 + speckle + fiber + cloudy;
        paperPixels.data[i + 3] = 255;
        const bright = random() > 0.51;
        grainPixels.data[i] = bright ? 255 : 76;
        grainPixels.data[i + 1] = bright ? 252 : 73;
        grainPixels.data[i + 2] = bright ? 245 : 68;
        grainPixels.data[i + 3] = 4 + random() * 18;
      }
    }
    pctx.putImageData(paperPixels, 0, 0);
    gctx.putImageData(grainPixels, 0, 0);

    paint.filter = 'blur(0.55px) saturate(0.82) contrast(0.95)';
    paint.drawImage(photo, 0, 0, width, height);
    paint.filter = 'none';
    // Pigment separation, paper showing through highlights, and irregular
    // granulation are baked into the final image rather than fading away.
    try {
      const pixels = paint.getImageData(0, 0, width, height);
      const data = pixels.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];
          const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
          const tide = Math.sin(x / 17 + Math.sin(y / 23)) * Math.sin(y / 13 + x / 41);
          const deposit = (random() - 0.5) * 4 + tide * (1 - luminance) * 3;
          const paperShow = 0.085 + luminance * luminance * 0.08;
          const pigment = (channel) => channel * 0.72 + Math.round(channel / 21) * 21 * 0.28;
          data[i] = pigment(red) * (1 - paperShow) + 245 * paperShow + deposit;
          data[i + 1] = pigment(green) * (1 - paperShow) + 239 * paperShow + deposit;
          data[i + 2] = pigment(blue) * (1 - paperShow) + 226 * paperShow + deposit;
          data[i + 3] = 255;
        }
      }
      paint.putImageData(pixels, 0, 0);
    } catch {
      // Filtered watercolor still works when an external image taints a canvas.
      paint.fillStyle = 'rgba(244, 236, 213, 0.14)';
      paint.fillRect(0, 0, width, height);
    }
    paint.globalAlpha = 0.7;
    paint.drawImage(grain, 0, 0);
    paint.globalAlpha = 1;

    // Graphite Blooms contributes only its photographic pencil contours and
    // occasional cross-grain shading. The photograph keeps its natural colors.
    try {
      pencil.drawImage(photo, 0, 0, width, height);
      const sourcePixels = pencil.getImageData(0, 0, width, height).data;
      const gray = new Float32Array(width * height);
      for (let i = 0; i < gray.length; i++) {
        const k = i * 4;
        gray[i] = sourcePixels[k] * 0.299 + sourcePixels[k + 1] * 0.587 + sourcePixels[k + 2] * 0.114;
      }
      const lines = pencil.createImageData(width, height);
      const pencilGrain = (x, y) => {
        let n = Math.imul(x + 71, 374761393) ^ Math.imul(y + 19, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
      };
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x, k = i * 4;
          const a = gray[i - width - 1], b = gray[i - width], c = gray[i - width + 1];
          const d = gray[i - 1], f = gray[i + 1];
          const g = gray[i + width - 1], j = gray[i + width], l = gray[i + width + 1];
          const gx = -a + c - 2 * d + 2 * f - g + l;
          const gy = -a - 2 * b - c + g + 2 * j + l;
          let alpha = Math.min(145, Math.max(0, Math.hypot(gx, gy) - 30) * 0.58);
          alpha *= 0.62 + pencilGrain(x, y) * 0.38;
          if ((x + y * 2) % 9 === 0 && gray[i] < 116) alpha += (116 - gray[i]) * 0.13;
          lines.data[k] = 65;
          lines.data[k + 1] = 61;
          lines.data[k + 2] = 58;
          lines.data[k + 3] = Math.min(155, alpha);
        }
      }
      pencil.clearRect(0, 0, width, height);
      pencil.putImageData(lines, 0, 0);
      paint.globalCompositeOperation = 'multiply';
      paint.globalAlpha = 0.34;
      paint.drawImage(graphite, 0, 0);
      paint.globalCompositeOperation = 'source-over';
      paint.globalAlpha = 1;
    } catch {
      // A cross-origin photo can still use the original filtered wash.
      pencil.clearRect(0, 0, width, height);
    }

    // Sunprint's branching, softly serrated arrival field controls all three
    // layers, so the pencil and capillary edge belong to the same growing wash.
    const maskPixels = mctx.createImageData(mw, mh);
    const sketchPixels = sctx.createImageData(mw, mh);
    const bathPixels = bctx.createImageData(mw, mh);
    const arrival = new Float32Array(mw * mh);
    const variation = new Float32Array(mw * mh);
    let earliest = Infinity, latest = -Infinity;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const i = y * mw + x, k = i * 4;
        const nx = x / mw, ny = y / mh;
        const radial = Math.hypot((nx - 0.34) * 0.95, (ny - 0.39) * 0.87);
        const branching = (noise(nx * 6.4, ny * 6.4) - 0.5) * 0.13;
        const serration = (noise(nx * 29, ny * 29) - 0.5) * 0.035;
        arrival[i] = 0.065 + radial * 0.86 + branching + serration;
        earliest = Math.min(earliest, arrival[i]);
        latest = Math.max(latest, arrival[i]);
        variation[i] = noise(nx * 17, ny * 17);
        maskPixels.data[k] = maskPixels.data[k + 1] = maskPixels.data[k + 2] = 255;
        sketchPixels.data[k] = sketchPixels.data[k + 1] = sketchPixels.data[k + 2] = 255;
        // A restrained warm gray replaces the original cyan developing bath.
        bathPixels.data[k] = 113;
        bathPixels.data[k + 1] = 107;
        bathPixels.data[k + 2] = 98;
      }
    }
    const span = Math.max(0.001, latest - earliest);
    for (let i = 0; i < arrival.length; i++) arrival[i] = 0.05 + (arrival[i] - earliest) / span * 0.75;
    let disposed = false;

    const reveal = (ctx, layer, layerMask) => {
      rctx.clearRect(0, 0, width, height);
      rctx.globalCompositeOperation = 'source-over';
      rctx.drawImage(layer, 0, 0);
      rctx.globalCompositeOperation = 'destination-in';
      rctx.drawImage(layerMask, 0, 0, width, height);
      rctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(revealed, 0, 0);
    };

    return {
      draw(ctx, progress) {
        if (disposed) return;
        const p = clamp(Number.isFinite(progress) ? progress : 0);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(paper, 0, 0);
        if (p <= 0) { ctx.restore(); return; }
        if (p >= 1) {
          ctx.drawImage(painted, 0, 0);
          ctx.restore();
          return;
        }
        const exposure = 0.96 * (1 - Math.pow(1 - p, 1.32));
        const opening = smooth(p / 0.06);
        const drying = 1 - smooth((p - 0.82) / 0.18);
        for (let i = 0; i < arrival.length; i++) {
          const age = exposure - arrival[i];
          const color = smooth((age + 0.004) / 0.16) * opening;
          const sketch = smooth((age + 0.065) / 0.1) * opening;
          const halo = smooth((age + 0.072) / 0.09) * (1 - smooth((age - 0.02) / 0.21));
          maskPixels.data[i * 4 + 3] = color * 255;
          sketchPixels.data[i * 4 + 3] = sketch * 145;
          bathPixels.data[i * 4 + 3] = halo * (18 + variation[i] * 16) * opening * drying;
        }
        mctx.putImageData(maskPixels, 0, 0);
        sctx.putImageData(sketchPixels, 0, 0);
        bctx.putImageData(bathPixels, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bath, 0, 0, width, height);
        // Fine pencil reaches the damp edge first, then sinks beneath the
        // watercolor; a much softer trace remains baked into the final image.
        reveal(ctx, graphite, sketchMask);
        reveal(ctx, painted, mask);
        ctx.restore();
      },
      dispose() {
        disposed = true;
        for (const canvas of [paper, painted, grain, graphite, revealed, mask, sketchMask, bath]) {
          canvas.width = 0;
          canvas.height = 0;
        }
      },
    };
  },
};
