/** A single shutter click starts the automatic watercolor reveal. */
export class CaptureSession {
  constructor({ paintDuration = 2800, settleDuration = 0 } = {}) {
    this.paintDuration = paintDuration; this.settleDuration = settleDuration;
    this.state = 'ready'; this.elapsed = 0;
  }
  get progress() { return Math.min(1, this.elapsed / this.paintDuration); }
  get active() { return this.state === 'painting' || this.state === 'settling'; }
  begin() {
    if (this.state !== 'ready') return false;
    this.state = 'painting'; this.elapsed = 0; return true;
  }
  advance(delta) {
    if (!this.active) return;
    this.elapsed = Math.min(this.paintDuration + this.settleDuration, this.elapsed + Math.max(0, Number.isFinite(delta) ? delta : 0));
    this.state = this.elapsed < this.paintDuration ? 'painting' : this.elapsed < this.paintDuration + this.settleDuration ? 'settling' : 'review';
  }
  reset() { if (this.active) return false; this.state = 'ready'; this.elapsed = 0; return true; }
}
