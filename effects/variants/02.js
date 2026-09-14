// A seeded capillary tree transports pigment; its wet margins then bloom.
export default {
  id: '02',
  name: 'Fiber Ink',
  description: 'Fine veins carry pigment, then bloom into a soft ink wash.',
  duration: 2800,
  create({ width, height, photo }) {
    const W = Math.round(width), H = Math.round(height);
    const scale = Math.min(W / 480, H / 360);
    const canvas = () => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      return c;
    };
    const paper = canvas(), painting = canvas(), mask = canvas(), layer = canvas();
    const pc = paper.getContext('2d'), ic = painting.getContext('2d', { willReadFrequently: true });
    const mc = mask.getContext('2d'), lc = layer.getContext('2d');
    let seed = 201713;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const clamp = x => Math.max(0, Math.min(1, x));
    const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

    pc.fillStyle = '#f5efe2'; pc.fillRect(0, 0, W, H);
    // Build grain once: slightly darker flecks and a few long paper fibers.
    for (let n = 0; n < W * H / 13; n++) {
      pc.fillStyle = random() < 0.5 ? 'rgba(94,73,48,.038)' : 'rgba(255,255,248,.25)';
      pc.fillRect(random() * W, random() * H, 0.5 + random(), 0.35 + random());
    }
    pc.strokeStyle = 'rgba(91,76,51,.035)'; pc.lineWidth = 0.45 * scale;
    for (let n = 0; n < 100; n++) {
      const x = random() * W, y = random() * H;
      pc.beginPath(); pc.moveTo(x, y);
      pc.quadraticCurveTo(x + 3 * scale, y - 1.5 * scale, x + (4 + random() * 8) * scale, y + 2 * scale);
      pc.stroke();
    }

    ic.fillStyle = '#f5efe2'; ic.fillRect(0, 0, W, H);
    ic.filter = `blur(${0.7 * scale}px) saturate(.76) contrast(1.08)`;
    ic.drawImage(photo, 0, 0, W, H); ic.filter = 'none';
    let source;
    try {
      const pixels = ic.getImageData(0, 0, W, H);
      source = new Uint8ClampedArray(pixels.data);
      const d = pixels.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const a = (y * W + Math.min(W - 1, x + 2)) * 4;
          const b = (Math.min(H - 1, y + 2) * W + x) * 4;
          const lum = (source[i] * .28 + source[i + 1] * .56 + source[i + 2] * .16);
          const lumA = source[a] * .28 + source[a + 1] * .56 + source[a + 2] * .16;
          const lumB = source[b] * .28 + source[b + 1] * .56 + source[b + 2] * .16;
          const edge = Math.min(1, (Math.abs(lum - lumA) + Math.abs(lum - lumB)) / 75);
          const clouds = Math.sin(x / (22 * scale) + Math.sin(y / (41 * scale))) * Math.sin(y / (17 * scale) + x / (67 * scale));
          const grain = (random() - .5) * 8 + clouds * 3;
          const lift = .10 + (lum / 255) * .07;
          for (let c = 0; c < 3; c++) {
            const quantized = Math.round(source[i + c] / 24) * 24;
            const pigment = source[i + c] * .55 + quantized * .45;
            const paperTone = [245, 239, 226][c];
            d[i + c] = pigment * (1 - lift) + paperTone * lift + grain - edge * 22;
          }
          d[i + 3] = 255;
        }
      }
      ic.putImageData(pixels, 0, 0);
    } catch (_) {
      // CanvasImageSources without readable pixels still receive the wash.
      ic.fillStyle = 'rgba(245,239,226,.12)'; ic.fillRect(0, 0, W, H);
    }
    ic.globalCompositeOperation = 'multiply'; ic.globalAlpha = .3;
    ic.drawImage(paper, 0, 0); ic.globalAlpha = 1; ic.globalCompositeOperation = 'source-over';

    // Jittered terrain and a least-resistance tree produce uneven forks and
    // tributaries. Arrival follows the fibers, never a circular clipping mask.
    const cols = 24, rows = 18, dx = W / (cols - 1), dy = H / (rows - 1);
    const nodes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        nodes.push({
          x: (col + (random() - .5) * .78) * dx,
          y: (row + (random() - .5) * .78) * dy,
          row, col, resistance: .35 + Math.pow(random(), 2) * 2.5,
          distance: Infinity, parent: -1, done: false, mass: 1,
          bend: (random() - .5) * 0.8,
        });
      }
    }
    const root = 10 * cols + 8;
    nodes[root].distance = 0;
    const order = [];
    for (let k = 0; k < nodes.length; k++) {
      let best = -1, distance = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        if (!nodes[i].done && nodes[i].distance < distance) { best = i; distance = nodes[i].distance; }
      }
      if (best < 0) break;
      const node = nodes[best]; node.done = true; order.push(best);
      for (let yy = -1; yy <= 1; yy++) {
        for (let xx = -1; xx <= 1; xx++) {
          if (!xx && !yy) continue;
          const col = node.col + xx, row = node.row + yy;
          if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
          const next = nodes[row * cols + col];
          const cost = Math.hypot(next.x - node.x, next.y - node.y) * (.2 + (next.resistance + node.resistance) * .5);
          if (distance + cost < next.distance) { next.distance = distance + cost; next.parent = best; }
        }
      }
    }
    const maxDistance = Math.max(...nodes.map(n => n.distance));
    for (let i = order.length - 1; i > 0; i--) {
      const n = nodes[order[i]]; nodes[n.parent].mass += n.mass;
    }
    const edges = order.slice(1).map(index => {
      const n = nodes[index], p = nodes[n.parent];
      const vx = n.x - p.x, vy = n.y - p.y;
      const sampleX = Math.max(0, Math.min(W - 1, Math.round(n.x)));
      const sampleY = Math.max(0, Math.min(H - 1, Math.round(n.y)));
      const si = (sampleY * W + sampleX) * 4;
      return {
        x0: p.x, y0: p.y, x1: p.x + vx * .5 - vy * n.bend,
        y1: p.y + vy * .5 + vx * n.bend, x2: n.x, y2: n.y,
        start: .02 + Math.pow(p.distance / maxDistance, .83) * .52,
        end: .02 + Math.pow(n.distance / maxDistance, .83) * .52,
        weight: (.65 + Math.min(5, Math.sqrt(n.mass) * .38)) * scale,
        bloom: .07 + random() * .14,
        color: source ? `rgb(${Math.round(source[si] * .72)},${Math.round(source[si + 1] * .72)},${Math.round(source[si + 2] * .72)})` : '#465d51',
      };
    });
    const curve = (ctx, e, t) => {
      const ax = e.x0 + (e.x1 - e.x0) * t, ay = e.y0 + (e.y1 - e.y0) * t;
      const bx = e.x1 + (e.x2 - e.x1) * t, by = e.y1 + (e.y2 - e.y1) * t;
      ctx.beginPath(); ctx.moveTo(e.x0, e.y0);
      ctx.quadraticCurveTo(ax, ay, ax + (bx - ax) * t, ay + (by - ay) * t);
    };

    return {
      draw(ctx, progress) {
        const p = clamp(progress);
        ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.drawImage(paper, 0, 0);
        if (p <= 0) { ctx.restore(); return; }
        mc.clearRect(0, 0, W, H);
        mc.strokeStyle = '#000'; mc.lineCap = 'round'; mc.lineJoin = 'round';
        // Soft peripheral pigment followed by the darker wet center.
        for (let pass = 0; pass < 2; pass++) {
          mc.globalAlpha = pass === 0 ? .24 : 1;
          for (const edge of edges) {
            if (p <= edge.start) continue;
            const travel = clamp((p - edge.start) / Math.max(.012, edge.end - edge.start));
            const spread = smooth((p - edge.end - edge.bloom) / .39);
            mc.lineWidth = edge.weight + spread * (pass === 0 ? 66 : 46) * scale;
            curve(mc, edge, travel); mc.stroke();
          }
        }
        // The last open paper pores gently absorb the remaining wash.
        mc.globalAlpha = smooth((p - .83) / .17);
        mc.fillStyle = '#000'; mc.fillRect(0, 0, W, H); mc.globalAlpha = 1;
        lc.clearRect(0, 0, W, H); lc.globalCompositeOperation = 'source-over';
        lc.drawImage(painting, 0, 0); lc.globalCompositeOperation = 'destination-in';
        lc.drawImage(mask, 0, 0); lc.globalCompositeOperation = 'source-over';
        ctx.drawImage(layer, 0, 0);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Visible hairlines at the advancing tips recede into the dried wash.
        for (const edge of edges) {
          if (p <= edge.start) continue;
          const travel = clamp((p - edge.start) / Math.max(.012, edge.end - edge.start));
          const dried = smooth((p - edge.end - .05) / .4);
          ctx.globalAlpha = (.6 * (1 - dried) + .025) * smooth(p / .06);
          ctx.strokeStyle = edge.color;
          ctx.lineWidth = Math.max(.42 * scale, edge.weight * .35);
          curve(ctx, edge, travel); ctx.stroke();
        }
        ctx.restore();
      },
      dispose() {
        for (const c of [paper, painting, mask, layer]) { c.width = 0; c.height = 0; }
        source = null; edges.length = 0; nodes.length = 0;
      },
    };
  },
};
