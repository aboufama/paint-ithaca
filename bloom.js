/** One continuous wet front expands from a fixed point. */
export function bloomArrival(x, y, aspect = .8, origin = { x: .5, y: .55 }) {
  const dx = (x - origin.x) * aspect, dy = y - origin.y;
  const distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  const lobes = .045 * Math.sin(angle * 7 + .8) + .025 * Math.sin(angle * 13 - 1.4);
  const fibers = .008 * Math.sin(x * 113 + Math.sin(y * 37)) * Math.cos(y * 97 + x * 21);
  return Math.max(0, distance * (1 + lobes) + fibers * Math.min(distance * 15, 1));
}
export function bloomCoverage(arrival, progress, maximum, feather) {
  const front = Math.max(0, Math.min(1, progress)) * (maximum + feather);
  const t = Math.max(0, Math.min(1, (front - arrival) / feather));
  return t * t * (3 - 2 * t);
}
export class Bloom {
  constructor(width = 320, height = 400) {
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.context = this.canvas.getContext('2d'); this.image = this.context.createImageData(width, height);
    this.arrivals = new Float32Array(width * height); this.maximum = 0; this.feather = .045;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const at = y * width + x, arrival = bloomArrival((x + .5) / width, (y + .5) / height, width / height);
      this.arrivals[at] = arrival; this.maximum = Math.max(this.maximum, this.arrivals[at]);
      this.image.data.set([255,255,255,0], at * 4);
    }
    this.clear();
  }
  clear() { this.progress = -1; this.paint(0); }
  paint(progress) {
    const next = Math.max(this.progress, Math.min(1, Math.max(0, progress)));
    if (next === this.progress) return;
    this.progress = next;
    // A quick opening becomes a gentle finish at the outside of the photograph.
    const eased = 1 - (1 - next) ** 1.55;
    for (let i = 0; i < this.arrivals.length; i++) this.image.data[i * 4 + 3] = Math.round(255 * bloomCoverage(this.arrivals[i], eased, this.maximum, this.feather));
    this.context.putImageData(this.image, 0, 0);
  }
}
