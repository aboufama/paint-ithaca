/**
 * Original, compact WebGL2 watercolor implementation for Paint Ithaca.
 * Mobile pigment and water evolve in a ping-pong field; a second field stores
 * pigment deposited into paper. Reflectance uses a Kubelka–Munk approximation.
 * No Sudo Aquarelle source code is included.
 */
const VERTEX = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const COMMON = `
precision highp float;
in vec2 uv;
uniform sampler2D mobile;
uniform sampler2D settled;
uniform sampler2D photograph;
uniform vec2 pixel;
uniform float water;
uniform float time;
uniform float dt;
uniform float live;
uniform vec3 brush;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fiber(vec2 p){return noise(p*210.)*.46+noise(p*79.)*.34+noise(p*430.)*.20;}
vec3 ink(vec2 p){
 vec3 c=texture(photograph,p).rgb*.4;
 c+=texture(photograph,p+pixel*1.6).rgb*.15;
 c+=texture(photograph,p-pixel*1.6).rgb*.15;
 c+=texture(photograph,p+vec2(pixel.x,-pixel.y)*1.6).rgb*.15;
 c+=texture(photograph,p+vec2(-pixel.x,pixel.y)*1.6).rgb*.15;
 c=clamp(c,vec3(.075),vec3(.995));
 return min((1.-c)*(1.-c)/(2.*c),vec3(5.))*.57;
}
`;
const STEP = `#version 300 es
${COMMON}
layout(location=0) out vec4 nextMobile;
layout(location=1) out vec4 nextSettled;
void main(){
 vec4 center=texture(mobile,uv),paper=texture(settled,uv);
 vec4 left=texture(mobile,uv-vec2(pixel.x,0)),right=texture(mobile,uv+vec2(pixel.x,0));
 vec4 up=texture(mobile,uv+vec2(0,pixel.y)),down=texture(mobile,uv-vec2(0,pixel.y));
 float grain=fiber(uv),wet=center.a;
 vec2 flow=vec2(left.a-right.a,down.a-up.a)*.28;
 flow+=vec2(noise(uv*39.+.8)-.5,noise(uv*39.+4.3)-.5)*wet*.32*water;
 vec3 pigment=texture(mobile,clamp(uv-flow*pixel,vec2(0),vec2(1))).rgb;
 float spread=(.04+.12*water)*smoothstep(.015,.35,wet);
 pigment+=((left.rgb-pigment)*min(wet,left.a)+(right.rgb-pigment)*min(wet,right.a)+(up.rgb-pigment)*min(wet,up.a)+(down.rgb-pigment)*min(wet,down.a))*spread;
 wet+=(left.a+right.a+up.a+down.a-4.*wet)*(.12+.07*water);
 // A broken advancing wet front prints image pigment over two seconds.
 float start=.18+noise(uv*6.)*1.7+noise(uv*47.)*.2;
 if(live<.5 && time>=start && time-dt<start){
   vec3 deposit=ink(uv);float density=dot(deposit,vec3(.333));
   pigment+=deposit*(.83+grain*.34);
   wet+=smoothstep(.005,.04,density)*(.68+water*.42);
 }
 if(live>.5){
   vec3 desired=ink(uv);
   paper.rgb*=.92;
   pigment=max(vec3(0),pigment+(desired-pigment-paper.rgb)*.09);
   wet=max(wet,.6+water*.4);
 }
 float radius=.04;vec2 d=(uv-brush.xy)/vec2(1.,pixel.y/pixel.x);
 float touch=brush.z*smoothstep(radius,0.,length(d));
 wet+=touch*.5; pigment+=ink(uv)*touch*.09;
 vec3 lifted=paper.rgb*touch*.055;paper.rgb-=lifted;pigment+=lifted;
 // Evaporation exposes paper tooth; its valleys retain denser pigment.
 wet=max(0.,wet-(.0019+(1.-water)*.0021)*(1.3-grain*.5));
 float edge=clamp(wet-(left.a+right.a+up.a+down.a)*.25,0.,1.);
 float deposition=clamp(.004+(1.-smoothstep(.025,.6,wet))*.055+edge*.13,0.,.16);
 deposition*=.7+grain*.8;
 vec3 deposit=max(vec3(0),pigment)*deposition;
 paper.rgb+=deposit;pigment-=deposit;
 nextMobile=vec4(max(vec3(0),pigment),clamp(wet,0.,1.5));
 nextSettled=vec4(max(vec3(0),paper.rgb),1.);
}`;
const RENDER = `#version 300 es
${COMMON}
out vec4 color;
void main(){
 vec4 m=texture(mobile,uv),s=texture(settled,uv);
 vec3 k=max(vec3(0),m.rgb+s.rgb);
 float grain=fiber(uv),fine=hash(gl_FragCoord.xy);
 vec3 reflectance=1.+k-sqrt(k*k+2.*k);
 vec3 paper=vec3(.995,.984,.956)*(1.-.04*grain-.018*fine);
 float damp=smoothstep(.02,.7,m.a);
 vec3 result=paper*reflectance;
 // Subtle relief follows the actual wet front, not a moving color overlay.
 float ridge=abs(texture(mobile,uv+pixel).a-texture(mobile,uv-pixel).a);
 result*=1.-min(.12,ridge*.13);
 result+=damp*.015;
 color=vec4(clamp(result,0.,1.),1.);
}`;

export class Watercolor {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('WebGL2 float color buffers are required');
    this.stepProgram = this.program(STEP); this.renderProgram = this.program(RENDER);
    this.sourceTexture = this.texture(1, 1, false);
    this.width = 0; this.height = 0; this.time = 0; this.water = .4; this.brush = [-10,-10,0]; this.paused = false; this.visible = true; this.raf = 0; this.hasSource = false; this.live = false;
    this.onVisibility = () => this.schedule(); document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(this.raf); this.raf = 0; canvas.hidden = true; });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
  program(fragment) {
    const gl = this.gl;
    const shader = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s,code); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) { const message=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message); } return s; };
    const vertex=shader(gl.VERTEX_SHADER,VERTEX),pixel=shader(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,vertex);gl.attachShader(p,pixel);gl.linkProgram(p);gl.deleteShader(vertex);gl.deleteShader(pixel);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    const uniforms = {}; ['mobile','settled','photograph','pixel','water','time','dt','brush','live'].forEach(name=>uniforms[name]=gl.getUniformLocation(p,name));
    return { program:p, uniforms };
  }
  texture(width,height,float=true) {
    const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,float?gl.RGBA16F:gl.RGBA,width,height,0,gl.RGBA,float?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);return t;
  }
  target() {
    const gl=this.gl, mobile=this.texture(this.width,this.height), settled=this.texture(this.width,this.height), fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,mobile,0);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,settled,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Watercolor framebuffer could not be created');
    return {mobile,settled,fbo};
  }
  setSource(source) {
    const gl=this.gl,ratio=source.height/source.width,width=640,height=Math.max(128,Math.round(width*ratio));
    if(this.width!==width||this.height!==height){
      for(const target of this.targets||[]){gl.deleteTexture(target.mobile);gl.deleteTexture(target.settled);gl.deleteFramebuffer(target.fbo);}
      this.width=width;this.height=height;this.targets=[this.target(),this.target()];
    }
    const displayWidth=Math.min(1600,Math.round(this.canvas.clientWidth*Math.min(devicePixelRatio,2)));
    this.canvas.width=displayWidth||1024;this.canvas.height=Math.round(this.canvas.width*ratio);
    gl.bindTexture(gl.TEXTURE_2D,this.sourceTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    this.hasSource=true;this.replay(false);
  }
  setLiveSource(source) {
    this.live=true;
    const staging=document.createElement('canvas');staging.width=source.videoWidth||source.width;staging.height=source.videoHeight||source.height;staging.getContext('2d').drawImage(source,0,0,staging.width,staging.height);
    this.setSource(staging);this.updateLiveSource(source);
  }
  updateLiveSource(source) {
    const gl=this.gl;gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.sourceTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);this.schedule();
  }
  bind(spec) {
    const gl=this.gl,u=spec.uniforms;gl.useProgram(spec.program);
    [this.targets[0].mobile,this.targets[0].settled,this.sourceTexture].forEach((texture,index)=>{gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);});
    gl.uniform1i(u.mobile,0);gl.uniform1i(u.settled,1);gl.uniform1i(u.photograph,2);gl.uniform2f(u.pixel,1/this.width,1/this.height);gl.uniform1f(u.water,this.water);gl.uniform1f(u.time,this.time);gl.uniform1f(u.dt,1/60);gl.uniform1f(u.live,this.live?1:0);gl.uniform3fv(u.brush,this.brush);
  }
  step() {
    const gl=this.gl;this.time+=1/60;this.bind(this.stepProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[1].fbo);gl.viewport(0,0,this.width,this.height);gl.drawArrays(gl.TRIANGLES,0,3);this.targets.reverse();this.brush[2]*=.7;
  }
  render() {
    if(!this.hasSource)return;const gl=this.gl;this.bind(this.renderProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  replay(reveal = true) {
    if(!this.hasSource)return;const gl=this.gl;this.time=0;this.brush=[-10,-10,0];
    for(const target of this.targets){gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}
    // Always show an initial recognizable painting, also in reduced-motion mode.
    for(let i=0;i<(reveal ? 3 : 145);i++)this.step();
    if(this.paused)for(let i=0;i<140;i++)this.step();
    this.render();this.schedule();
  }
  schedule() {
    if(this.raf||!this.hasSource||this.paused||!this.visible||document.hidden)return;
    this.raf=requestAnimationFrame(()=>{this.raf=0;for(let i=0;i<2;i++)this.step();this.render();if(this.live||this.time<18||this.brush[2]>.001)this.schedule();});
  }
  splat(x,y){this.brush=[x,y,1];this.time=Math.min(this.time,10);this.schedule();}
  setWater(value){this.water=value;this.time=Math.min(this.time,10);this.schedule();}
  setPaused(value){this.paused=value;if(value){cancelAnimationFrame(this.raf);this.raf=0;}else this.schedule();}
  setVisible(value){this.visible=value;if(!value){cancelAnimationFrame(this.raf);this.raf=0;}else this.schedule();}
  dispose(){cancelAnimationFrame(this.raf);document.removeEventListener('visibilitychange',this.onVisibility);for(const target of this.targets||[]){this.gl.deleteTexture(target.mobile);this.gl.deleteTexture(target.settled);this.gl.deleteFramebuffer(target.fbo);}this.gl.deleteTexture(this.sourceTexture);this.gl.deleteProgram(this.stepProgram.program);this.gl.deleteProgram(this.renderProgram.program);}
}
