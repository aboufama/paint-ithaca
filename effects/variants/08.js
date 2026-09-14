export default {
  id: '08',
  name: 'Bristle Light',
  description: 'Vivid oil color swept into raised, sunlit bristle marks',
  duration: 2800,
  create({ width, height, photo }) {
    const canvas = () => {
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      return c;
    };
    const source = canvas();
    const sc = source.getContext('2d', { willReadFrequently: true });
    sc.drawImage(photo, 0, 0, width, height);
    const pixels = sc.getImageData(0, 0, width, height).data;
    let seed = 803117;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const clamp = n => Math.max(0, Math.min(255, n));
    const color = (c, offset = 0) => `rgb(${clamp(c[0] + offset) | 0},${clamp(c[1] + offset) | 0},${clamp(c[2] + offset) | 0})`;
    const sample = (x, y) => {
      const i = (Math.max(0, Math.min(height - 1, y | 0)) * width + Math.max(0, Math.min(width - 1, x | 0))) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const gray = r * .28 + g * .58 + b * .14;
      return [gray + (r - gray) * 1.18 + 5, gray + (g - gray) * 1.16 + 3, gray + (b - gray) * 1.1 - 3];
    };
    const ground = canvas(), gc = ground.getContext('2d');
    gc.fillStyle = '#e8dcc2'; gc.fillRect(0, 0, width, height);
    // A quiet tooth remains in the light between the individual strokes.
    for (let i = 0; i < width * height / 18; i++) {
      gc.fillStyle = random() > .5 ? 'rgba(255,255,239,.12)' : 'rgba(104,81,47,.045)';
      gc.fillRect(random() * width, random() * height, 1, 2);
    }
    const scale = Math.min(width / 480, height / 360);
    const plates = [canvas(), canvas(), canvas()];
    const steps = [19, 10, 5.5].map(n => Math.max(3, n * scale));
    plates.forEach((plate, pass) => {
      const ctx = plate.getContext('2d');
      const step = steps[pass], strokes = [];
      for (let y = -step; y < height + step; y += step * .8) {
        for (let x = -step; x < width + step; x += step) {
          strokes.push({ x: x + random() * step * .7, y: y + random() * step * .6, rank: random() });
        }
      }
      strokes.sort((a, b) => a.rank - b.rank);
      ctx.lineCap = 'round';
      for (const s of strokes) {
        const c = sample(s.x, s.y);
        const angle = -.38 + .28 * Math.sin(s.y / (54 * scale)) + (random() - .5) * .55;
        const length = step * (1.8 + random() * .8), thick = step * (1.0 + random() * .3);
        const bend = (random() - .5) * thick * .3;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(angle);
        const stroke = (offset, lineWidth, tint) => {
          ctx.strokeStyle = tint; ctx.lineWidth = lineWidth;
          ctx.beginPath(); ctx.moveTo(-length * .48, offset);
          ctx.quadraticCurveTo(0, bend + offset, length * .48, offset - thick * .08);
          ctx.stroke();
        };
        // Dark lower lip and pale upper ridges model thick pigment.
        stroke(thick * .12, thick, color(c, -15));
        stroke(0, thick * .91, color(c));
        const bristles = pass === 0 ? 5 : 4;
        for (let j = 0; j < bristles; j++) {
          const offset = (j / (bristles - 1) - .5) * thick * .69;
          const lift = j % 2 === 0 ? 8 + random() * 12 : -5 - random() * 8;
          stroke(offset, Math.max(.45, thick * .075), color(c, lift));
        }
        ctx.restore();
      }
    });
    // Alternating sweeps expose the already textured pigment at every stage.
    const reveal = (ctx, plate, progress, reverse) => {
      if (progress <= 0) return;
      if (progress >= 1) { ctx.drawImage(plate, 0, 0); return; }
      const boundary = progress * (width + height * .28 + 45) - height * .28 - 24;
      ctx.save();
      if (reverse) { ctx.translate(width, 0); ctx.scale(-1, 1); }
      ctx.beginPath(); ctx.moveTo(-1, -1);
      for (let y = 0; y <= height + 8; y += 8) {
        const x = boundary + y * .28 + Math.sin(y * .15) * 6 + Math.sin(y * .37) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(-1, height + 8); ctx.closePath(); ctx.clip();
      if (reverse) { ctx.scale(-1, 1); ctx.translate(-width, 0); }
      ctx.drawImage(plate, 0, 0); ctx.restore();
    };
    return {
      draw(ctx, p) {
        p = Math.max(0, Math.min(1, p));
        ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(ground, 0, 0);
        reveal(ctx, plates[0], p / .35, false);
        reveal(ctx, plates[1], (p - .28) / .39, true);
        reveal(ctx, plates[2], (p - .59) / .41, false);
        ctx.restore();
      },
      dispose() {
        [source, ground, ...plates].forEach(c => { c.width = 0; c.height = 0; });
      }
    };
  }
};
