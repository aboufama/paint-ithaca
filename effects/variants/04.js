export default {
  id: '04',
  name: 'Pastel Gouache',
  description: 'Soft, opaque dabs gather into a matte pastel painting.',
  duration: 2800,
  create({ width, height, photo }) {
    // Paint once in a modest studio-sized buffer; playback only blends two plates.
    const ratio = Math.min(1, 600 / Math.max(width, height));
    const W = Math.max(1, Math.round(width * ratio));
    const H = Math.max(1, Math.round(height * ratio));
    const unit = Math.min(W / 480, H / 360);
    let seed = 41027;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const surface = () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      return c;
    };
    const paper = surface();
    const pctx = paper.getContext('2d');
    pctx.fillStyle = '#f3ebdc';
    pctx.fillRect(0, 0, W, H);
    // Low-contrast tooth belongs to the sheet, including at progress zero.
    for (let i = 0; i < W * H / 32; i++) {
      pctx.fillStyle = random() < 0.5 ? 'rgba(110,88,63,0.025)' : 'rgba(255,255,255,0.14)';
      pctx.fillRect(random() * W, random() * H, Math.max(0.6, unit), Math.max(0.6, unit));
    }
    let source = surface();
    const sctx = source.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(photo, 0, 0, W, H);
    let pixels = sctx.getImageData(0, 0, W, H).data;
    const sample = (x, y) => {
      const i = (Math.max(0, Math.min(H - 1, Math.round(y))) * W + Math.max(0, Math.min(W - 1, Math.round(x)))) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2]];
    };
    const luma = c => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
    const pigment = (c, lift = 0) => {
      const gray = luma(c);
      const cream = [246, 236, 220];
      return c.map((v, i) => Math.max(0, Math.min(255,
        Math.round((v * 0.88 + gray * 0.12) / 12) * 12 * 0.91 + cream[i] * 0.09 + lift
      )));
    };
    const color = (c, a = 1) => `rgba(${c.map(Math.round).join(',')},${a})`;
    let detail = surface();
    const dctx = detail.getContext('2d');
    const detailImage = dctx.createImageData(W, H);
    for (let i = 0; i < pixels.length; i += 4) {
      const c = pigment([pixels[i], pixels[i + 1], pixels[i + 2]]);
      detailImage.data[i] = c[0];
      detailImage.data[i + 1] = c[1];
      detailImage.data[i + 2] = c[2];
      detailImage.data[i + 3] = 255;
    }
    dctx.putImageData(detailImage, 0, 0);
    let master = surface();
    const mctx = master.getContext('2d');
    mctx.drawImage(paper, 0, 0);
    const strokes = [];
    const addPass = (spacing, length, breadth, detailPass) => {
      const pass = [];
      spacing *= unit;
      for (let y = -spacing / 2; y < H + spacing; y += spacing) {
        for (let x = -spacing / 2; x < W + spacing; x += spacing) {
          const px = x + (random() - 0.5) * spacing * 0.72;
          const py = y + (random() - 0.5) * spacing * 0.72;
          const gx = luma(sample(px + 3 * unit, py)) - luma(sample(px - 3 * unit, py));
          const gy = luma(sample(px, py + 3 * unit)) - luma(sample(px, py - 3 * unit));
          const edge = Math.hypot(gx, gy);
          if (detailPass && edge < 22 && random() < 0.80) continue;
          const c0 = sample(px, py);
          const neighborhood = sample(px + spacing * 0.25, py - spacing * 0.25);
          const c = pigment(c0.map((v, i) => v * 0.82 + neighborhood[i] * 0.18), (random() - 0.5) * 7);
          // Paint follows local contours, with enough wrist rotation to stay gestural.
          const angle = edge > 16
            ? Math.atan2(gy, gx) + Math.PI / 2 + (random() - 0.5) * 0.85
            : (random() - 0.5) * Math.PI * 1.65;
          pass.push({
            x: px, y: py, angle, c,
            length: length * unit * (0.68 + random() * 0.68),
            breadth: breadth * unit * (0.72 + random() * 0.58),
            wobble: (random() - 0.5) * 0.34,
            tooth: random(),
            // Broad masses are placed around the center before the edges.
            order: Math.hypot((px - W * 0.51) / W, (py - H * 0.48) / H) * 0.30 + random(),
          });
        }
      }
      pass.sort((a, b) => a.order - b.order);
      strokes.push(...pass);
    };
    addPass(24, 57, 34, false);
    addPass(11, 27, 15, false);
    addPass(5.7, 10, 5.5, true);
    const dab = s => {
      mctx.save();
      mctx.translate(s.x, s.y);
      mctx.rotate(s.angle);
      const half = s.length / 2;
      mctx.lineCap = 'round';
      mctx.lineJoin = 'round';
      mctx.lineWidth = s.breadth;
      mctx.strokeStyle = color(s.c);
      mctx.beginPath();
      mctx.moveTo(-half, s.breadth * s.wobble);
      mctx.quadraticCurveTo(0, -s.breadth * s.wobble, half, 0);
      mctx.stroke();
      // Two quiet bristle ridges keep the opaque planes tactile instead of airbrushed.
      mctx.lineWidth = Math.max(0.55, unit * 0.9);
      mctx.strokeStyle = color(s.c.map(v => Math.min(255, v + 18)), 0.26);
      mctx.beginPath();
      mctx.moveTo(-half * 0.76, -s.breadth * 0.24);
      mctx.quadraticCurveTo(0, -s.breadth * (0.24 + s.wobble * 0.4), half * 0.83, -s.breadth * 0.22);
      mctx.stroke();
      if (s.tooth > 0.48) {
        mctx.strokeStyle = color(s.c.map(v => Math.max(0, v - 18)), 0.16);
        mctx.beginPath();
        mctx.moveTo(-half * 0.42, s.breadth * 0.28);
        mctx.lineTo(half * 0.72, s.breadth * 0.22);
        mctx.stroke();
      }
      mctx.restore();
    };
    let plates = [paper];
    const plateCount = 30;
    let painted = 0;
    for (let frame = 1; frame <= plateCount; frame++) {
      const fraction = frame / plateCount;
      const target = Math.round(strokes.length * fraction * fraction);
      while (painted < target) dab(strokes[painted++]);
      const plate = surface();
      const ctx = plate.getContext('2d');
      ctx.drawImage(master, 0, 0);
      // A final thin photographic glaze restores small landmarks; the actual paint
      // remains the dominant, permanent image rather than a transient reveal mask.
      const glaze = Math.max(0, (fraction - 0.64) / 0.36) * 0.20;
      if (glaze > 0) {
        ctx.globalAlpha = glaze;
        ctx.drawImage(detail, 0, 0);
        ctx.globalAlpha = 1;
      }
      if (fraction > 0.60) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = (fraction - 0.60) * 0.22;
        ctx.drawImage(paper, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      plates.push(plate);
    }
    source.width = source.height = 1;
    detail.width = detail.height = 1;
    master.width = master.height = 1;
    source = detail = master = pixels = null;
    return {
      draw(ctx, progress) {
        if (!plates.length) return;
        const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
        const t = (1 - Math.pow(1 - p, 1.12)) * plateCount;
        const first = Math.floor(t);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(plates[first], 0, 0, width, height);
        if (first < plateCount) {
          ctx.globalAlpha = t - first;
          ctx.drawImage(plates[first + 1], 0, 0, width, height);
        }
        ctx.restore();
      },
      dispose() {
        for (const plate of plates) plate.width = plate.height = 1;
        plates = [];
      },
    };
  },
};
