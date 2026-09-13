/** Input-independent lifecycle. Only a deliberate hold can start a recording. */
export class HoldSession {
  constructor({ maxDuration = 12000, now = () => performance.now(), onStart, onFinish, onReset } = {}) {
    this.state = 'ready'; this.maxDuration = maxDuration; this.now = now;
    this.onStart = onStart; this.onFinish = onFinish; this.onReset = onReset;
    this.startedAt = 0; this.duration = 0;
  }
  begin() {
    if (this.state !== 'ready') return false;
    this.startedAt = this.now(); this.duration = 0; this.state = 'holding';
    this.onStart?.(); return true;
  }
  tick() {
    if (this.state === 'holding') {
      this.duration = Math.min(this.maxDuration, Math.max(0, this.now() - this.startedAt));
      if (this.duration >= this.maxDuration) this.finish();
    }
    return this.duration;
  }
  finish() {
    if (this.state !== 'holding') return false;
    this.duration = Math.min(this.maxDuration, Math.max(0, this.now() - this.startedAt));
    this.state = 'settling'; this.onFinish?.(this.duration); return true;
  }
  complete() { if (this.state === 'settling') this.state = 'review'; }
  reset() { if (this.state === 'holding' || this.state === 'settling') return false; this.state = 'ready'; this.duration = 0; this.onReset?.(); return true; }
}
