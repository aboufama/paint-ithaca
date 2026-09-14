export default {
  id: '10',
  name: 'Paper Mosaic',
  description: 'Torn pigment tiles unfold into a softly textured photo collage.',
  duration: 2800,
  create({ width, height, photo }) {
    let seed = 104729;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const canvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w); c.height = Math.ceil(h);
      return c;
    };
    const paper = canvas(width, height);
    const pc = paper.getContext('2d');
    pc.fillStyle = '#f1e8d5'; pc.fillRect(0, 0, width, height);
    for (let i = 0; i < width * height / 15; i++) {
      pc.fillStyle = random() > .5 ? 'rgba(109,83,45,.035)' : 'rgba(255,255,255,.20)';
      pc.fillRect(random() * width, random() * height, .5 + random() * 1.4, .5 + random());
    }
    const cols = 13, rows = Math.max(7, Math.round(13 * height / width));
    const cw = width / cols, ch = height / rows;
    const nodes = Array.from({ length: rows + 1 }, (_, y) =>
      Array.from({ length: cols + 1 }, (_, x) => ({
        x: x * cw + (x && x < cols ? (random() - .5) * cw * .48 : 0),
        y: y * ch + (y && y < rows ? (random() - .5) * ch * .48 : 0)
      })));
    const tiles = [];
    const origin = { x: width * .42, y: height * .54 };
    const maxDistance = Math.hypot(width * .65, height * .65);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const corners = [nodes[y][x], nodes[y][x + 1], nodes[y + 1][x + 1], nodes[y + 1][x]];
      const points = [];
      corners.forEach((a, i) => {
        const b = corners[(i + 1) % 4];
        points.push(a, { x: a.x * .52 + b.x * .48 + (random() - .5) * .9,
          y: a.y * .52 + b.y * .48 + (random() - .5) * .9 });
      });
      const left = Math.floor(Math.min(...points.map(p => p.x))) - 3;
      const top = Math.floor(Math.min(...points.map(p => p.y))) - 3;
      const right = Math.ceil(Math.max(...points.map(p => p.x))) + 3;
      const bottom = Math.ceil(Math.max(...points.map(p => p.y))) + 3;
      const tile = canvas(right - left, bottom - top), tc = tile.getContext('2d');
      const center = { x: corners.reduce((s, p) => s + p.x, 0) / 4,
        y: corners.reduce((s, p) => s + p.y, 0) / 4 };
      tc.translate(-left, -top);
      tc.beginPath(); points.forEach((p, i) => i ? tc.lineTo(p.x, p.y) : tc.moveTo(p.x, p.y));
      tc.closePath(); tc.save(); tc.clip();
      tc.drawImage(photo, 0, 0, width, height);
      tc.fillStyle = ['rgba(253,235,205,.12)', 'rgba(235,228,246,.10)', 'rgba(244,242,222,.12)'][Math.floor(random() * 3)];
      tc.fillRect(left, top, tile.width, tile.height);
      for (let n = 0; n < tile.width * tile.height / 9; n++) {
        tc.fillStyle = random() > .23 ? 'rgba(255,252,232,.13)' : 'rgba(77,58,35,.055)';
        tc.fillRect(left + random() * tile.width, top + random() * tile.height, .5 + random() * 1.3, .45 + random() * 1.1);
      }
      tc.restore();
      tc.strokeStyle = 'rgba(249,241,221,.68)'; tc.lineWidth = 1.1; tc.lineJoin = 'round'; tc.stroke();
      const distance = Math.hypot(center.x - origin.x, center.y - origin.y) / maxDistance;
      tiles.push({ image: tile, left, top, center,
        delay: .035 + distance * .28 + random() * .11,
        span: .37 + random() * .14,
        turn: (random() - .5) * 1.9,
        bend: (random() - .5) * width * .19,
        lift: .6 + random() * .4 });
    }
    // Center pieces lead, with successive bands of paper gently opening out.
    tiles.sort((a, b) => b.delay - a.delay);
    return {
      draw(ctx, p) {
        p = Math.max(0, Math.min(1, p));
        ctx.save();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(paper, 0, 0);
        for (const tile of tiles) {
          const t = Math.max(0, Math.min(1, (p - tile.delay) / tile.span));
          if (!t) continue;
          const ease = 1 - Math.pow(1 - t, 3);
          const flutter = Math.sin(t * Math.PI) * (1 - t);
          const xx = origin.x + (tile.center.x - origin.x) * ease + tile.bend * flutter;
          const yy = origin.y + (tile.center.y - origin.y) * ease - height * .09 * flutter * tile.lift;
          const scale = .16 + ease * .84;
          ctx.save();
          ctx.globalAlpha = Math.min(1, t * 5);
          ctx.translate(xx, yy); ctx.rotate(tile.turn * Math.pow(1 - t, 2));
          ctx.scale(scale, scale * (1 - flutter * .24));
          if (t < .97) {
            ctx.shadowColor = 'rgba(70,48,22,.15)';
            ctx.shadowBlur = 4 * (1 - t); ctx.shadowOffsetY = 3 * (1 - t);
          }
          ctx.drawImage(tile.image, tile.left - tile.center.x, tile.top - tile.center.y);
          ctx.restore();
        }
        ctx.restore();
      },
      dispose() {
        tiles.forEach(tile => { tile.image.width = 0; tile.image.height = 0; });
        tiles.length = 0; paper.width = 0; paper.height = 0;
      }
    };
  }
};
