const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return 1 - (1 - t) ** 3;
};
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function canvas(width, height) {
  const surface = document.createElement('canvas');
  surface.width = Math.max(1, Math.ceil(width));
  surface.height = Math.max(1, Math.ceil(height));
  return surface;
}

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Each wash is a bent, unequal petal, with a soft edge and pooled pigment.
function petalSprite(color, bend) {
  const surface = canvas(320, 200);
  const ctx = surface.getContext('2d');
  const petal = new Path2D();
  petal.moveTo(15, 107);
  petal.bezierCurveTo(72, 91 + bend, 91, 8, 189, 18);
  petal.bezierCurveTo(243, 25, 280, 63 + bend, 305, 93);
  petal.bezierCurveTo(268, 103, 255, 162, 189, 177);
  petal.bezierCurveTo(104, 193, 76, 116 + bend, 15, 107);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.globalAlpha = 0.45;
  ctx.fill(petal);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.5;
  ctx.fill(petal);
  ctx.save();
  ctx.clip(petal);
  const wash = ctx.createLinearGradient(10, 80, 300, 105);
  wash.addColorStop(0, 'rgba(255,255,255,0.12)');
  wash.addColorStop(0.45, 'rgba(255,255,255,0)');
  wash.addColorStop(0.84, 'rgba(255,255,255,0.2)');
  wash.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 320, 200);
  ctx.restore();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke(petal);
  return surface;
}

export default {
  id: '03',
  name: 'Petal Wash',
  description: 'Translucent petals unfurl into a soft watercolor photograph.',
  duration: 2800,
  create({ width, height, photo }) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const random = randomSource(30911);
    const paper = canvas(w, h);
    const paperCtx = paper.getContext('2d');
    paperCtx.fillStyle = '#f7f1e5';
    paperCtx.fillRect(0, 0, w, h);

    const grain = canvas(w, h);
    const grainCtx = grain.getContext('2d');
    const grainData = grainCtx.createImageData(w, h);
    for (let i = 0; i < grainData.data.length; i += 4) {
      const light = random() > 0.48;
      grainData.data[i] = light ? 255 : 99;
      grainData.data[i + 1] = light ? 252 : 80;
      grainData.data[i + 2] = light ? 239 : 63;
      grainData.data[i + 3] = Math.round(3 + random() * (light ? 17 : 10));
    }
    grainCtx.putImageData(grainData, 0, 0);
    // Faint paper fibers remain fixed as the watercolor blooms over them.
    grainCtx.lineWidth = 0.45;
    for (let i = 0; i < Math.round(w * h / 165); i++) {
      const x = random() * w;
      const y = random() * h;
      grainCtx.strokeStyle = random() > 0.5 ? '#fff9e823' : '#9e897511';
      grainCtx.beginPath();
      grainCtx.moveTo(x, y);
      grainCtx.lineTo(x + 1 + random() * 4, y + random() * 1.6);
      grainCtx.stroke();
    }
    paperCtx.drawImage(grain, 0, 0);

    const painting = canvas(w, h);
    const paintingCtx = painting.getContext('2d');
    paintingCtx.filter = 'blur(0.8px) saturate(0.8)';
    paintingCtx.drawImage(photo, -1, -1, w + 2, h + 2);
    paintingCtx.filter = 'none';
    paintingCtx.globalAlpha = 0.75;
    paintingCtx.drawImage(photo, 0, 0, w, h);
    paintingCtx.globalAlpha = 0.14;
    paintingCtx.globalCompositeOperation = 'soft-light';
    paintingCtx.fillStyle = '#f5d8bf';
    paintingCtx.fillRect(0, 0, w, h);
    paintingCtx.globalCompositeOperation = 'source-over';
    paintingCtx.globalAlpha = 0.09;
    paintingCtx.fillStyle = '#faf0dc';
    paintingCtx.fillRect(0, 0, w, h);
    paintingCtx.globalAlpha = 1;
    paintingCtx.drawImage(grain, 0, 0);

    const colors = ['#daa8b2', '#b9b8d8', '#a5c8bf', '#e3bb9b', '#b3cbd2', '#d9bdce'];
    const sprites = colors.map((color, i) => petalSprite(color, (i % 3 - 1) * 13));
    const masks = colors.map((_, i) => petalSprite('#ffffff', (i % 3 - 1) * 13));
    const diagonal = Math.hypot(w, h);
    const originX = w * 0.44;
    const originY = h * 0.55;
    // A woven sequence of uneven lobes, rather than an expanding circular edge.
    const angles = [-2.3, -0.65, 1.25, 2.65, -1.35, 0.27, 1.95, -2.93, -1.95, 0.8, 2.35, -0.27, -1.1, 1.55, 3.05, -2.6];
    const petals = angles.map((angle, index) => ({
      angle,
      length: diagonal * (0.64 + random() * 0.25),
      breadth: diagonal * (0.36 + random() * 0.19),
      delay: index * 0.025 + (index % 3) * 0.013,
      twist: (random() - 0.5) * 0.62,
      sprite: index % colors.length,
      strength: 0.69 + random() * 0.22,
    }));
    const mask = canvas(w, h);
    const maskCtx = mask.getContext('2d');
    const glaze = canvas(w, h);
    const glazeCtx = glaze.getContext('2d');
    const revealed = canvas(w, h);
    const revealCtx = revealed.getContext('2d');

    function stamp(ctx, surface, petal, opening, opacity) {
      const growth = ease(opening);
      const length = petal.length * (0.025 + 0.975 * growth);
      const breadth = petal.breadth * (0.018 + 0.982 * smooth(opening));
      ctx.save();
      ctx.translate(originX, originY);
      ctx.rotate(petal.angle + petal.twist * (1 - growth));
      ctx.globalAlpha = opacity;
      ctx.drawImage(surface, -length * (15 / 320), -breadth * (107 / 200), length, breadth);
      ctx.restore();
    }

    return {
      draw(ctx, progress) {
        const p = clamp(Number.isFinite(progress) ? progress : 0);
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(paper, 0, 0);
        if (p === 0) {
          ctx.restore();
          return;
        }
        if (p === 1) {
          ctx.drawImage(painting, 0, 0);
          ctx.restore();
          return;
        }

        maskCtx.clearRect(0, 0, w, h);
        glazeCtx.clearRect(0, 0, w, h);
        for (const petal of petals) {
          const opening = clamp((p - petal.delay) / 0.39);
          if (opening === 0) continue;
          const arrive = smooth(opening / 0.2);
          // Tint leads the photo by a breath, then pigment settles at its edge.
          stamp(glazeCtx, sprites[petal.sprite], petal, opening, arrive * petal.strength);
          const development = clamp((p - petal.delay - 0.045) / 0.41);
          if (development > 0) {
            stamp(maskCtx, masks[petal.sprite], petal, development, smooth(development / 0.27) * 0.97);
          }
        }
        const settle = smooth((p - 0.67) / 0.33);
        maskCtx.globalAlpha = settle;
        maskCtx.fillStyle = '#ffffff';
        maskCtx.fillRect(0, 0, w, h);
        maskCtx.globalAlpha = 1;

        ctx.globalAlpha = 0.69 * (1 - settle);
        ctx.drawImage(glaze, 0, 0);
        ctx.globalAlpha = 1;
        revealCtx.globalCompositeOperation = 'source-over';
        revealCtx.clearRect(0, 0, w, h);
        revealCtx.drawImage(painting, 0, 0);
        revealCtx.globalCompositeOperation = 'destination-in';
        revealCtx.drawImage(mask, 0, 0);
        revealCtx.globalCompositeOperation = 'source-over';
        ctx.drawImage(revealed, 0, 0);
        ctx.globalAlpha = 0.11 * (1 - settle);
        ctx.drawImage(glaze, 0, 0);
        ctx.globalAlpha = 0.2 * (1 - settle);
        ctx.drawImage(grain, 0, 0);
        ctx.restore();
      },
      dispose() {
        for (const surface of [paper, grain, painting, mask, glaze, revealed, ...sprites, ...masks]) {
          surface.width = 1;
          surface.height = 1;
        }
      },
    };
  },
};
