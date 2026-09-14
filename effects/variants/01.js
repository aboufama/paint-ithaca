// A single wet-on-wet wash. Every draw is a pure function of progress.
export default {
  id: '01',
  name: 'Tidal Bloom',
  description: 'One feathery blue-and-sage wash opens into a watercolor photograph.',
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
    const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
    const paper = makeCanvas();
    const painted = makeCanvas();
    const grain = makeCanvas();
    const revealed = makeCanvas();
    const scale = 0.5;
    const mask = makeCanvas(Math.ceil(width * scale), Math.ceil(height * scale));
    const pctx = paper.getContext('2d');
    const paint = painted.getContext('2d', { willReadFrequently: true });
    const gctx = grain.getContext('2d');
    const rctx = revealed.getContext('2d');
    const mctx = mask.getContext('2d');
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
        grainPixels.data[i] = bright ? 255 : 68;
        grainPixels.data[i + 1] = bright ? 252 : 86;
        grainPixels.data[i + 2] = bright ? 236 : 94;
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
          data[i] = pigment(red) * (1 - paperShow) + 245 * paperShow + deposit - (1 - luminance) * 2;
          data[i + 1] = pigment(green) * (1 - paperShow) + 239 * paperShow + deposit + (1 - luminance) * 3;
          data[i + 2] = pigment(blue) * (1 - paperShow) + 226 * paperShow + deposit + (1 - luminance) * 9;
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

    const cx = width * 0.485;
    const cy = height * 0.51;
    const maxRadius = Math.hypot(width * 0.56, height * 0.59) * 1.36;
    const points = Array.from({ length: 180 }, (_, i) => {
      const angle = i / 180 * Math.PI * 2;
      const lobe = 1 + Math.sin(angle * 5 + 0.9) * 0.067
        + Math.sin(angle * 9 - 0.4) * 0.044
        + Math.sin(angle * 17 + 2.3) * 0.023
        + Math.sin(angle * 37) * 0.009;
      return { x: Math.cos(angle), y: Math.sin(angle), lobe, wave: Math.sin(angle * 11 + 0.8) };
    });
    const contour = (context, radius, spread = 0, phase = 0) => {
      context.beginPath();
      points.forEach((point, i) => {
        const rr = Math.max(0, radius * point.lobe + spread + point.wave * Math.sin(phase) * 2.1);
        const x = cx + point.x * rr;
        const y = cy + point.y * rr * 0.93;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    };
    const filaments = Array.from({ length: 52 }, (_, index) => {
      const angle = index / 52 * Math.PI * 2 + (random() - 0.5) * 0.1;
      const lobe = 1 + Math.sin(angle * 5 + 0.9) * 0.067 + Math.sin(angle * 9 - 0.4) * 0.044
        + Math.sin(angle * 17 + 2.3) * 0.023 + Math.sin(angle * 37) * 0.009;
      return { x: Math.cos(angle), y: Math.sin(angle) * 0.93, lobe, reach: 3 + random() * 11 };
    });

    return {
      draw(ctx, progress) {
        const p = clamp(Number.isFinite(progress) ? progress : 0);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(paper, 0, 0);
        if (p <= 0) {
          ctx.restore();
          return;
        }
        if (p >= 1) {
          ctx.drawImage(painted, 0, 0);
          ctx.restore();
          return;
        }
        const growth = Math.pow(p, 0.79);
        const radius = maxRadius * growth;
        const wetness = Math.sin(Math.PI * clamp(p / 0.96)) * 0.9;
        const birth = clamp(p * 20);

        // A capillary fringe travels ahead of the photograph, leaving no
        // independent dots or secondary reveal centers on the clean paper.
        ctx.save();
        ctx.globalAlpha = birth;
        ctx.filter = 'blur(5px)';
        contour(ctx, radius, 8, p * 3);
        ctx.fillStyle = 'rgba(110, 156, 160, 0.14)';
        ctx.fill();
        ctx.filter = 'blur(2px)';
        contour(ctx, radius, 2, p * 3);
        ctx.strokeStyle = 'rgba(88, 129, 149, 0.21)';
        ctx.lineWidth = 5 + wetness * 3;
        ctx.stroke();
        ctx.filter = 'blur(1.8px)';
        ctx.beginPath();
        for (const filament of filaments) {
          const r = radius * filament.lobe;
          const x = cx + filament.x * r;
          const y = cy + filament.y * r;
          ctx.moveTo(x, y);
          ctx.lineTo(x + filament.x * filament.reach, y + filament.y * filament.reach);
        }
        ctx.strokeStyle = 'rgba(97, 139, 132, 0.065)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.clearRect(0, 0, mask.width, mask.height);
        mctx.setTransform(scale, 0, 0, scale, 0, 0);
        mctx.fillStyle = '#fff';
        mctx.globalAlpha = birth * 0.25;
        mctx.filter = 'blur(4px)';
        contour(mctx, radius, 5, p * 3);
        mctx.fill();
        mctx.globalAlpha = birth;
        mctx.filter = 'blur(2px)';
        contour(mctx, radius, -3, p * 3);
        mctx.fill();
        mctx.filter = 'none';
        mctx.globalAlpha = 1;

        rctx.clearRect(0, 0, width, height);
        rctx.globalCompositeOperation = 'source-over';
        rctx.drawImage(painted, 0, 0);
        rctx.globalCompositeOperation = 'destination-in';
        rctx.drawImage(mask, 0, 0, width, height);
        rctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(revealed, 0, 0);

        // The wet edge pools in translucent sage and indigo. Its finish is
        // absorbed into the paper as the wash reaches the outside of the frame.
        ctx.globalAlpha = birth * (1 - clamp((p - 0.7) / 0.25));
        ctx.filter = 'blur(1px)';
        contour(ctx, radius, -1, p * 3);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(63, 102, 120, 0.19)';
        ctx.stroke();
        ctx.restore();
      },
      dispose() {
        for (const canvas of [paper, painted, grain, revealed, mask]) {
          canvas.width = 0;
          canvas.height = 0;
        }
      },
    };
  },
};
