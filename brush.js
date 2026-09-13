/** Broad, overlapping strokes. A mask adds pigment only where the brush passes. */
export class Brush {
  constructor(width = 640, height = 800) {
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d'); this.last = null; this.lastTime = 0;
  }
  clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.last = null; this.lastTime = 0; }
  point(elapsed, motion = { x: 0, y: 0 }) {
    const rowDuration = 1150, row = Math.floor(elapsed / rowDuration), t = (elapsed % rowDuration) / rowDuration;
    const travel = .5 - .5 * Math.cos(Math.PI * t);
    const x = row % 2 ? .95 - travel * .9 : .05 + travel * .9;
    const y = .07 + row * .112 + Math.sin(t * Math.PI) * .018;
    return { x: (x + motion.x * .035) * this.canvas.width, y: (y + motion.y * .025) * this.canvas.height };
  }
  paint(elapsed, motion) {
    // Interpolate elapsed time as well as points so slow frames don't skip a stroke.
    const start = this.last ? this.lastTime : 0;
    for (let time = start; time <= elapsed; time += 14) this.dab(this.point(time, motion), time);
    this.dab(this.point(elapsed, motion), elapsed); this.lastTime = elapsed;
  }
  dab(point, time) {
    const { ctx, canvas } = this; const radius = canvas.height * (.066 + .009 * Math.sin(time * .009));
    const angle = Math.sin(time * .002) * .12;
    ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle); ctx.scale(.63, 1);
    const wash = ctx.createRadialGradient(0, 0, radius * .24, 0, 0, radius);
    wash.addColorStop(0, 'rgba(255,255,255,.43)'); wash.addColorStop(.65, 'rgba(255,255,255,.24)'); wash.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wash; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    // Individual bristles break the wet edge into irregular strands.
    for (let i = 0; i < 18; i++) {
      const y = ((i / 17) * 2 - 1) * radius * (.8 + .11 * Math.sin(i * 17.3));
      ctx.fillStyle = `rgba(255,255,255,${.04 + .025 * Math.sin(i * 2.3 + time * .002)})`;
      ctx.beginPath(); ctx.ellipse(Math.sin(i * 9.7 + time * .003) * 4, y, radius * .76, 1.8 + Math.abs(Math.sin(i * 6.5)) * 2.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); this.last = point;
  }
}
