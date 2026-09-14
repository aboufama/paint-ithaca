// Pigment is carried outward, then comes to rest in many interleaved deposits.
// All randomness and expensive image work happen once, during creation.
export default {
  id: '05',
  name: 'Pigment Dust',
  description: 'Airborne color gathers into a fine, paper-flecked watercolor.',
  duration: 2800,
  create({ width, height, photo }) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const scale = Math.min(w / 480, h / 360);
    const makeCanvas = (cw = w, ch = h) => {
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(cw, ch)
        : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
      return canvas;
    };
    let seed = 0x05eab871;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
    const source = makeCanvas();
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(photo, 0, 0, w, h);
    const pixels = sourceCtx.getImageData(0, 0, w, h).data;

    // A fixed warm rag-paper background gives even progress=0 a tactile surface.
    const paper = makeCanvas();
    const paperCtx = paper.getContext('2d');
    const paperData = paperCtx.createImageData(w, h);
    const paintedData = new Uint8ClampedArray(w * h * 4);
    const arrival = new Float32Array(w * h);
    const cellSize = Math.max(4, Math.round(7 * scale));
    const cols = Math.ceil(w / cellSize);
    const rows = Math.ceil(h / cellSize);
    const field = new Float32Array(cols * rows);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        // Folded current lines make the deposits wander across the whole image.
        const current = 0.5 + 0.22 * Math.sin(cx * 0.23 + Math.sin(cy * 0.2) * 2.6)
          + 0.14 * Math.cos(cy * 0.33 - cx * 0.08);
        field[cy * cols + cx] = 0.32 + 0.45 * clamp(current * 0.61 + random() * 0.39);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const index = y * w + x;
        const i = index * 4;
        const tooth = (random() - 0.5) * 7;
        const fiber = Math.sin(y * 1.83 + x * 0.11) * 0.85;
        const base = [246 + tooth + fiber, 240 + tooth + fiber, 224 + tooth + fiber];
        const pinhole = random() < 0.038;
        const density = pinhole ? 0 : 0.76 + random() * 0.19;
        // Lift shadows slightly; retain the source detail under translucent pigment.
        const tint = [pixels[i] * 0.94 + 10, pixels[i + 1] * 0.95 + 7, pixels[i + 2] * 0.93 + 6];
        const granule = random() < 0.17 ? -8 * random() : 0;
        for (let channel = 0; channel < 3; channel++) {
          paperData.data[i + channel] = base[channel];
          paintedData[i + channel] = base[channel] * (1 - density)
            + (tint[channel] + granule) * density;
        }
        paperData.data[i + 3] = paintedData[i + 3] = 255;
        arrival[index] = field[Math.floor(y / cellSize) * cols + Math.floor(x / cellSize)]
          + (random() - 0.5) * 0.15;
      }
    }
    paperCtx.putImageData(paperData, 0, 0);

    // Cached deposits are interpolated at playback; there are no frame-time pixel loops.
    const firstDeposit = 0.23;
    const lastDeposit = 0.93;
    const count = 15;
    const plates = [];
    for (let frame = 0; frame < count; frame++) {
      const plate = makeCanvas();
      const plateCtx = plate.getContext('2d');
      const image = plateCtx.createImageData(w, h);
      const time = firstDeposit + frame / (count - 1) * (lastDeposit - firstDeposit);
      for (let index = 0; index < arrival.length; index++) {
        const amount = frame === count - 1 ? 1 : smooth((time - arrival[index]) / 0.085);
        const i = index * 4;
        for (let channel = 0; channel < 3; channel++) {
          image.data[i + channel] = paperData.data[i + channel]
            + (paintedData[i + channel] - paperData.data[i + channel]) * amount;
        }
        image.data[i + 3] = 255;
      }
      plateCtx.putImageData(image, 0, 0);
      plates.push(plate);
    }

    const particles = [];
    const originX = w * 0.47;
    const originY = h * 0.56;
    const n = Math.round(Math.min(1900, Math.max(650, w * h / 115)));
    for (let i = 0; i < n; i++) {
      const x = random() * w;
      const y = random() * h;
      const pixel = (Math.min(h - 1, Math.floor(y)) * w + Math.min(w - 1, Math.floor(x))) * 4;
      const angle = random() * Math.PI * 2;
      const reach = 0.16 + Math.sqrt(random()) * 0.66;
      const burst = 0.16 + random() * 0.12;
      const land = arrival[pixel / 4] + 0.065;
      const r = Math.round(pixels[pixel] * 0.9 + 13);
      const g = Math.round(pixels[pixel + 1] * 0.9 + 10);
      const b = Math.round(pixels[pixel + 2] * 0.9 + 6);
      particles.push({
        x, y, burst, land,
        begin: 0.012 + random() * 0.055,
        bx: originX + Math.cos(angle) * w * reach,
        by: originY + Math.sin(angle) * h * reach - h * 0.13,
        curl: (random() - 0.5) * h * 0.2,
        size: (0.55 + Math.pow(random(), 2) * 2) * scale,
        alpha: 0.4 + random() * 0.52,
        color: `rgb(${r},${g},${b})`,
      });
    }

    return {
      draw(ctx, progress) {
        const p = clamp(Number.isFinite(progress) ? progress : 0);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(paper, 0, 0, width, height);
        if (p >= firstDeposit) {
          const position = clamp((p - firstDeposit) / (lastDeposit - firstDeposit)) * (count - 1);
          const frame = Math.floor(position);
          ctx.drawImage(plates[frame], 0, 0, width, height);
          if (frame + 1 < count) {
            ctx.globalAlpha = position - frame;
            ctx.drawImage(plates[frame + 1], 0, 0, width, height);
          }
        }
        if (p > 0 && p < lastDeposit) {
          for (const grain of particles) {
            if (p <= grain.begin || p >= grain.land) continue;
            let x, y;
            if (p < grain.burst) {
              const t = clamp((p - grain.begin) / (grain.burst - grain.begin));
              const expansion = 1 - Math.pow(1 - t, 3);
              x = originX + (grain.bx - originX) * expansion;
              y = originY + (grain.by - originY) * expansion;
            } else {
              const t = smooth((p - grain.burst) / (grain.land - grain.burst));
              const curl = Math.sin(t * Math.PI);
              x = grain.bx + (grain.x - grain.bx) * t + grain.curl * curl;
              y = grain.by + (grain.y - grain.by) * t - grain.curl * curl * 0.55;
            }
            ctx.globalAlpha = grain.alpha * smooth((p - grain.begin) / 0.035)
              * smooth((grain.land - p) / 0.07);
            ctx.fillStyle = grain.color;
            ctx.fillRect(x, y, grain.size, grain.size * 0.8);
          }
        }
        ctx.restore();
      },
      dispose() {
        particles.length = 0;
        for (const canvas of [paper, source, ...plates]) {
          canvas.width = 1;
          canvas.height = 1;
        }
        plates.length = 0;
      },
    };
  },
};
