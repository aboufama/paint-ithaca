export default {
  id: '09',
  name: 'Graphite Blooms',
  description: 'Pencil contours unfurl; soft watercolor pools beneath.',
  duration: 2800,
  create({ width: w, height: h, photo }) {
    const canvas = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    };
    const paper = canvas(), source = canvas(), wash = canvas(), pencil = canvas();
    const sc = source.getContext('2d', { willReadFrequently: true });
    sc.drawImage(photo, 0, 0, w, h);
    const pixels = sc.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i++) {
      const k = i * 4;
      gray[i] = pixels.data[k] * .299 + pixels.data[k + 1] * .587 + pixels.data[k + 2] * .114;
    }
    const pc = paper.getContext('2d'), wc = wash.getContext('2d');
    const ec = pencil.getContext('2d');
    const base = pc.createImageData(w, h), pigment = wc.createImageData(w, h);
    const lines = ec.createImageData(w, h);
    const noise = (x, y) => {
      let n = Math.imul(x + 71, 374761393) ^ Math.imul(y + 19, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, k = i * 4, grain = noise(x, y);
        const fiber = (grain - .5) * 7;
        base.data[k] = 249 + fiber;
        base.data[k + 1] = 245 + fiber;
        base.data[k + 2] = 233 + fiber;
        base.data[k + 3] = 255;
        const pool = Math.sin(x * .043 + Math.sin(y * .027) * 2) * Math.cos(y * .051);
        const density = .77 + pool * .045 + (grain - .5) * .07;
        for (let c = 0; c < 3; c++) {
          const value = pixels.data[k + c];
          // Small tonal shelves make the pigment read as pooled washes.
          const stepped = Math.round(value / 17) * 17;
          const saturated = gray[i] + (value * .65 + stepped * .35 - gray[i]) * 1.14;
          pigment.data[k + c] = saturated * density + base.data[k + c] * (1 - density);
        }
        pigment.data[k + 3] = 255;
        if (x < 1 || x >= w - 1 || y < 1 || y >= h - 1) continue;
        const a = gray[i - w - 1], b = gray[i - w], c = gray[i - w + 1];
        const d = gray[i - 1], f = gray[i + 1];
        const g = gray[i + w - 1], j = gray[i + w], l = gray[i + w + 1];
        const gx = -a + c - 2 * d + 2 * f - g + l;
        const gy = -a - 2 * b - c + g + 2 * j + l;
        const edge = Math.sqrt(gx * gx + gy * gy);
        let alpha = Math.min(155, Math.max(0, edge - 24) * .66);
        alpha *= .62 + grain * .38;
        // A little cross-grain shading joins the contours in dark areas.
        if ((x + y * 2) % 9 === 0 && gray[i] < 116) alpha += (116 - gray[i]) * .17;
        lines.data[k] = 65; lines.data[k + 1] = 61; lines.data[k + 2] = 58;
        lines.data[k + 3] = Math.min(175, alpha);
      }
    }
    pc.putImageData(base, 0, 0);
    wc.putImageData(pigment, 0, 0);
    ec.putImageData(lines, 0, 0);
    const cx = w * .46, cy = h * .46, radius = Math.hypot(w, h) * .77;
    const clamp = n => Math.max(0, Math.min(1, n));
    const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
    function reveal(ctx, layer, amount, irregularity, alpha) {
      if (amount <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (amount < 1) {
        const r = radius * amount;
        ctx.beginPath();
        for (let n = 0; n <= 80; n++) {
          const angle = n / 80 * Math.PI * 2;
          const wobble = 1 + irregularity * (Math.sin(angle * 7 + .8) * .5 + Math.sin(angle * 11 - .4) * .3);
          const x = cx + Math.cos(angle) * r * wobble;
          const y = cy + Math.sin(angle) * r * wobble;
          if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.clip();
      }
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
    return {
      draw(ctx, p) {
        p = clamp(p);
        ctx.save();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(paper, 0, 0);
        // The faint advancing wet front receives a denser wash behind it.
        const color = ease((p - .24) / .72);
        reveal(ctx, wash, Math.min(1, color * 1.16), .13, .23);
        reveal(ctx, wash, color, .095, .94);
        reveal(ctx, pencil, ease(p / .56), .055, 1 - .16 * color);
        ctx.restore();
      },
      dispose() {
        for (const c of [paper, source, wash, pencil]) { c.width = 0; c.height = 0; }
      }
    };
  }
};
