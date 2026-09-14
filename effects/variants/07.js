const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };

export default {
  id: '07',
  name: 'Risograph Registration',
  description: 'Coral, teal and indigo settle into a grainy three-ink print.',
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
    let seed = 71073;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const paper = canvas();
    const pc = paper.getContext('2d');
    pc.fillStyle = '#f5e9cb';
    pc.fillRect(0, 0, width, height);
    for (let i = 0; i < width * height / 9; i++) {
      pc.fillStyle = random() > .45 ? 'rgba(123,87,52,.035)' : 'rgba(255,255,255,.15)';
      pc.fillRect(random() * width, random() * height, .5 + random(), .5 + random());
    }
    const inks = ['#ef655c', '#258f93', '#343965'];
    const angles = [-.26, .26, .79];
    const plates = inks.map((ink, plate) => {
      const c = canvas(), cx = c.getContext('2d');
      const angle = angles[plate], co = Math.cos(angle), si = Math.sin(angle);
      const extent = Math.hypot(width, height) / 2 + 5;
      const step = 3.05;
      cx.translate(width / 2, height / 2);
      cx.rotate(angle);
      cx.fillStyle = ink;
      for (let gy = -extent; gy < extent; gy += step) {
        for (let gx = -extent; gx < extent; gx += step) {
          const x = Math.round(width / 2 + gx * co - gy * si);
          const y = Math.round(height / 2 + gx * si + gy * co);
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const index = (y * width + x) * 4;
          const r = pixels[index] / 255, g = pixels[index + 1] / 255;
          const b = pixels[index + 2] / 255;
          const luminance = .299 * r + .587 * g + .114 * b;
          const shade = 1 - luminance;
          const warm = Math.max(0, r - (g + b) / 2);
          const cool = Math.max(0, (g + b) / 2 - r);
          let amount = plate === 0 ? shade * .52 + warm * .85
            : plate === 1 ? shade * .59 + cool * .85 - warm * .32
            : Math.pow(shade, 1.72) * .93;
          amount = clamp(amount * smooth(shade / .14));
          if (amount < .025) continue;
          const grain = .89 + random() * .20;
          const radius = step * Math.sqrt(amount / Math.PI) * grain;
          cx.globalAlpha = .84 + random() * .16;
          cx.beginPath();
          cx.arc(gx + (random() - .5) * .2, gy, radius, 0, Math.PI * 2);
          cx.fill();
        }
      }
      return c;
    });
    const starts = [.025, .24, .47];
    const offsets = [[1.25, -.65], [-.9, .7], [.2, .15]];
    return {
      draw(ctx, p) {
        p = clamp(p);
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(paper, 0, 0);
        ctx.beginPath();
        ctx.rect(5, 5, width - 10, height - 10);
        ctx.clip();
        ctx.globalCompositeOperation = 'multiply';
        plates.forEach((plate, i) => {
          const local = clamp((p - starts[i]) / .36);
          if (!local) return;
          const reveal = smooth(local);
          const settle = 1 - smooth(local / .92);
          const dx = offsets[i][0] + settle * (i === 1 ? -14 : 12);
          const dy = offsets[i][1] + settle * (i === 2 ? 9 : -7);
          ctx.save();
          ctx.beginPath();
          const edge = -32 + (height + 64) * reveal;
          ctx.moveTo(0, -40); ctx.lineTo(width, -40);
          ctx.lineTo(width, edge - 18); ctx.lineTo(0, edge + 18);
          ctx.closePath(); ctx.clip();
          ctx.globalAlpha = .91 + .09 * reveal;
          ctx.drawImage(plate, dx, dy);
          ctx.restore();
        });
        ctx.restore();
      },
      dispose() {
        for (const c of [source, paper, ...plates]) { c.width = 0; c.height = 0; }
      }
    };
  }
};
