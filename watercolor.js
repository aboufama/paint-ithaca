import * as shaders from './watercolor-shaders.js';
import { pigments, coefficients, rgb } from './pigment-model.js';

/** Water, eight suspended pigments, and eight deposited pigments evolve independently. */
export class Watercolor {
  constructor(canvas, { resolution = 848, automatic = true } = {}) {
    this.canvas = canvas; this.resolution = resolution; this.automatic = automatic;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('WebGL2 float color buffers are required');
    this.programs = Object.fromEntries(['paper','water','pigment','render','copyMask'].map(name => [name, this.program(shaders[name])]));
    this.photo = this.texture(1, 1, false); this.mask = this.texture(1, 1, false);
    this.width = 0; this.height = 0; this.clock = 0; this.steps = 0; this.water = .64;
    this.paused = true; this.recording = false; this.painted = false; this.pending = false; this.raf = 0;
    this.materials = pigments.map(coefficients);
    this.onVisibility = () => { if (document.hidden) this.cancel(); else this.schedule(); };
    this.onLost = event => { event.preventDefault(); this.cancel(); canvas.hidden = true; };
    this.onRestored = () => location.reload();
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }
  program(fragment) {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message); }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, shaders.vertex), pixel = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, pixel); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(pixel);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    const uniforms = new Map();
    return { program, uniform(name) { if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name)); return uniforms.get(name); } };
  }
  texture(width, height, floating = true) {
    const gl = this.gl, texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, floating ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, floating ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    return texture;
  }
  target(count = 1, floating = true) {
    const gl = this.gl, fbo = gl.createFramebuffer(), textures = [];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    for (let i = 0; i < count; i++) {
      const texture = this.texture(this.width, this.height, floating); textures.push(texture);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
    }
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Watercolor framebuffer unavailable');
    return { fbo, textures };
  }
  destroyTargets() {
    for (const target of this.targets || []) { target.textures.forEach(texture => this.gl.deleteTexture(texture)); this.gl.deleteFramebuffer(target.fbo); }
    this.targets = [];
  }
  allocate(ratio) {
    this.destroyTargets(); this.width = this.resolution; this.height = Math.round(this.width * ratio);
    this.fluid = [this.target(), this.target()]; this.paint = [this.target(4), this.target(4)];
    this.paper = this.target(); this.previousMask = this.target(1, false);
    this.targets = [...this.fluid, ...this.paint, this.paper, this.previousMask];
    this.draw(this.programs.paper, this.paper);
  }
  upload(texture, source) {
    const gl = this.gl; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  setLiveSource(source) {
    const ratio = (source.videoHeight || source.height) / (source.videoWidth || source.width);
    if (!this.width || this.height !== Math.round(this.resolution * ratio)) this.allocate(ratio);
    const displayWidth = Math.min(1200, Math.round(this.canvas.clientWidth * Math.min(devicePixelRatio, 2)));
    this.canvas.width = displayWidth || this.width; this.canvas.height = Math.round(this.canvas.width * ratio);
    this.upload(this.photo, source); this.hasSource = true; this.clear();
  }
  updateLiveSource(source) { this.upload(this.photo, source); }
  updateCoverage(source) { this.upload(this.mask, source); this.pending = this.recording; }
  setRecording(value) { this.recording = value; if (value) this.painted = true; this.schedule(); }
  setWater(value) { this.water = Math.max(0, Math.min(1, value)); }
  bindTextures(spec, entries) {
    const gl = this.gl;
    entries.forEach(([name, texture], index) => { gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(spec.uniform(name), index); });
  }
  draw(spec, target, textures = [], uniforms) {
    const gl = this.gl; gl.useProgram(spec.program);
    this.bindTextures(spec, textures);
    gl.uniform2f(spec.uniform('texel'), 1 / this.width, 1 / this.height); gl.uniform1f(spec.uniform('clock'), this.clock);
    uniforms?.(spec);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo || null);
    gl.viewport(0, 0, target ? this.width : this.canvas.width, target ? this.height : this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  fields() {
    return [['fluid', this.fluid[0].textures[0]], ['paper', this.paper.textures[0]],
      ['looseA', this.paint[0].textures[0]], ['looseB', this.paint[0].textures[1]],
      ['fixedA', this.paint[0].textures[2]], ['fixedB', this.paint[0].textures[3]]];
  }
  step() {
    if (!this.hasSource) return;
    const gl = this.gl, input = [['photo', this.photo], ['mask', this.mask], ['previousMask', this.previousMask.textures[0]]];
    const fresh = this.pending;
    const injection = spec => { gl.uniform1f(spec.uniform('fresh'), fresh ? 1 : 0); gl.uniform1f(spec.uniform('waterLoad'), .18 + 1.3 * this.water * this.water); };
    this.clock += 1 / 120; this.steps++;
    this.draw(this.programs.water, this.fluid[1], [...this.fields().slice(0,2), ...input], injection);
    this.fluid.reverse();
    this.draw(this.programs.pigment, this.paint[1], [...this.fields(), ...input], spec => {
      injection(spec);
      gl.uniform3fv(spec.uniform('swatches[0]'), pigments.flatMap(p => { const color = rgb(p.white), sum = color.reduce((a,b) => a+b); return color.map(c => c / sum); }));
      for (const [name, property] of [['weights','weight'], ['grains','grain'], ['stains','stain']]) {
        gl.uniform4fv(spec.uniform(name + 'A'), pigments.slice(0,4).map(p => p[property]));
        gl.uniform4fv(spec.uniform(name + 'B'), pigments.slice(4,8).map(p => p[property]));
      }
    });
    this.paint.reverse();
    if (fresh) { this.draw(this.programs.copyMask, this.previousMask, [['mask', this.mask]]); this.pending = false; }
  }
  render() {
    if (!this.hasSource) return;
    const gl = this.gl;
    this.draw(this.programs.render, null, [...this.fields(), ['photo', this.photo], ['mask', this.mask]], spec => {
      gl.uniform3fv(spec.uniform('absorption[0]'), this.materials.flatMap(p => p.absorption));
      gl.uniform3fv(spec.uniform('scattering[0]'), this.materials.flatMap(p => p.scattering));
      gl.uniform1fv(spec.uniform('grains[0]'), pigments.map(p => p.grain));

    });
  }
  clear() {
    if (!this.hasSource) return;
    const gl = this.gl; this.clock = 0; this.steps = 0; this.pending = false; this.painted = false;
    for (const target of [...this.fluid, ...this.paint, this.previousMask]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.render();
  }
  schedule() {
    if (!this.automatic || this.raf || !this.hasSource || this.paused || document.hidden) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.step(); this.step(); this.render(); this.schedule(); });
  }
  cancel() { cancelAnimationFrame(this.raf); this.raf = 0; }
  setPaused(value) { this.paused = value; if (value) this.cancel(); else this.schedule(); }
  /** Read actual pigment fields for the deterministic browser regression fixture. */
  readPaint() {
    const gl = this.gl, data = [];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.paint[0].fbo);
    for (let i = 0; i < 4; i++) { const values = new Float32Array(this.width * this.height * 4); gl.readBuffer(gl.COLOR_ATTACHMENT0 + i); gl.readPixels(0,0,this.width,this.height,gl.RGBA,gl.FLOAT,values); data.push(values); }
    return data;
  }
  dispose() {
    this.cancel(); document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onLost); this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.destroyTargets(); this.gl.deleteTexture(this.photo); this.gl.deleteTexture(this.mask);
    Object.values(this.programs).forEach(spec => this.gl.deleteProgram(spec.program));
  }
}
