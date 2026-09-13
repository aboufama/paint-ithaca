// Independently implemented from the water transport, pigment exchange and
// finite-layer optics equations studied in Sudo Aquarelle. No bundled vendor code.
export const vertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = corner;
  gl_Position = vec4(corner * 2. - 1., 0., 1.);
}`;
const common = `
precision highp float;
in vec2 uv;
uniform vec2 texel;
uniform float clock;
float random(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 cell = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(random(cell), random(cell + vec2(1,0)), f.x),
             mix(random(cell + vec2(0,1)), random(cell + 1.), f.x), f.y);
}
float fbm(vec2 p) {
  float result = 0., strength = .5;
  for (int i = 0; i < 5; i++) { result += strength * noise(p); p = p * 2.03 + 17.1; strength *= .5; }
  return result;
}
float wetness(float height) { return smoothstep(.0004, .004, height); }
`;
const inputs = `
uniform sampler2D photo, mask, previousMask;
uniform float fresh, waterLoad;
float newStroke(vec2 p) { return fresh * max(0., texture(mask, p).a - texture(previousMask, p).a); }
`;
export const paper = `#version 300 es
${common}
out vec4 material;
void main() {
  vec2 p = uv / texel; float seed = 7.31;
  float relief = .5 + .55 * (fbm(p / 9. + seed * 11.3) - .5)
    + .18 * (fbm(p / 2.6 + seed * 23.7) - .5)
    + .10 * (fbm(p / vec2(46,3.4) + seed * 31.1) - .5);
  float absorbency = .78 + .5 * (fbm(p / 90. + seed * 41.7) - .5);
  float fibers = fbm(p / 6. + seed * 53.9);
  float pores = .72 * fbm(p / vec2(7,2.4) + seed * 7.7) + .28 * fbm(p / 1.6 + seed * 67.3);
  material = vec4(clamp(relief, .02, .98), absorbency, fibers, pores);
}`;
export const water = `#version 300 es
${common}
${inputs}
uniform sampler2D fluid, paper;
layout(location=0) out vec4 nextFluid;
vec4 sampleWater(vec2 offset) { return texture(fluid, uv + offset * texel); }
float surface(vec2 offset) { return sampleWater(offset).r + .45 * texture(paper, uv + offset * texel).r; }
void main() {
  vec4 center = sampleWater(vec2(0));
  vec4 carried = texture(fluid, uv - center.gb * texel);
  vec4 left = sampleWater(vec2(-1,0)), right = sampleWater(vec2(1,0));
  vec4 down = sampleWater(vec2(0,-1)), up = sampleWater(vec2(0,1));
  vec4 tooth = texture(paper, uv);
  float height = mix(carried.r, (left.r + right.r + down.r + up.r) * .25, .25);
  float saturation = center.a;
  vec2 velocity = carried.gb;
  float stroke = newStroke(uv);
  height += stroke * waterLoad;
  // The fresh wet boundary supplies a small outward landing current.
  vec2 landing = vec2(newStroke(uv - vec2(texel.x,0)) - newStroke(uv + vec2(texel.x,0)),
                      newStroke(uv - vec2(0,texel.y)) - newStroke(uv + vec2(0,texel.y)));
  velocity += landing * 2.2 * waterLoad;
  float present = smoothstep(.0002, .002, height);
  vec2 slope = .5 * vec2(surface(vec2(1,0)) - surface(vec2(-1,0)), surface(vec2(0,1)) - surface(vec2(0,-1)));
  velocity -= .45 * slope * present;
  vec2 edge = .5 * vec2(wetness(sampleWater(vec2(1.7,0)).r) - wetness(sampleWater(vec2(-1.7,0)).r),
                        wetness(sampleWater(vec2(0,1.7)).r) - wetness(sampleWater(vec2(0,-1.7)).r));
  velocity -= edge * .22 * present * (.3 + .7 / 12.);
  velocity *= mix(.82, .96, clamp(6. * height, 0., 1.));
  velocity *= min(1., 2.4 / max(length(velocity), .00001));
  float absorbed = min(height, .016 * tooth.g * (1. - saturation));
  height -= absorbed; saturation += 1.3 * absorbed;
  float horizontal = max(left.a, right.a), vertical = max(down.a, up.a);
  float diagonal = max(max(sampleWater(vec2(-1,-1)).a, sampleWater(vec2(1,-1)).a),
                       max(sampleWater(vec2(-1,1)).a, sampleWater(vec2(1,1)).a));
  float drive = .994 * max(horizontal, max(.55 * vertical, .75 * diagonal));
  float barrier = .26 + .48 * tooth.a;
  saturation += .26 * max(drive - saturation, 0.) * smoothstep(barrier - .05, barrier + .03, drive) * (.7 + .6 * tooth.b);
  if (saturation > .68 && height < .0006) {
    float seep = .0025 * (saturation - .68); height += seep; saturation -= seep;
  }
  height -= .00018 * (1. + 20. * length(edge));
  saturation *= .99978;
  nextFluid = vec4(clamp(height, 0., 1.6), velocity, clamp(saturation, 0., 1.));
}`;
export const pigment = `#version 300 es
${common}
${inputs}
uniform sampler2D fluid, paper, looseA, looseB, fixedA, fixedB;
uniform vec3 swatches[8];
uniform vec4 weightsA, weightsB, grainsA, grainsB, stainsA, stainsB;
layout(location=0) out vec4 nextLooseA;
layout(location=1) out vec4 nextLooseB;
layout(location=2) out vec4 nextFixedA;
layout(location=3) out vec4 nextFixedB;
vec4 average(sampler2D field) {
  return .25 * (texture(field, uv + vec2(texel.x,0)) + texture(field, uv - vec2(texel.x,0))
    + texture(field, uv + vec2(0,texel.y)) + texture(field, uv - vec2(0,texel.y)));
}
void exchange(inout vec4 floating, inout vec4 attached, vec4 density, vec4 grain, vec4 stain, float h, float wet, float saturation, float relief, float speed) {
  float gate = (.035 + 9. * pow(1. - wet, 1.6)) * (1. - .93 * smoothstep(.2, .6, saturation) * (1. - wet));
  vec4 valleys = clamp(1. + grain * (1. - 2. * relief), .05, 2.5);
  vec4 carry = clamp(1. - speed * .35 * (1.2 - density), .1, 1.);
  vec4 deposit = clamp(.020 * (gate + .09 * density * wet + .12 * stain * wet) * valleys * carry, 0., .85);
  vec4 lift = .028 * wet * (.25 + .75 * clamp(1.5 * speed, 0., 1.)) * (1. - stain);
  vec4 change = floating * deposit - attached * lift;
  floating -= change; attached += change;
  if (h <= .00018) { attached += floating; floating = vec4(0); }
  floating = clamp(floating, 0., 6.); attached = clamp(attached, 0., 6.);
}
void main() {
  vec4 fluidHere = texture(fluid, uv), tooth = texture(paper, uv);
  float h = fluidHere.r, saturation = fluidHere.a, wet = wetness(h);
  vec2 p = uv / texel / 46. + vec2(0, clock * .45), e = vec2(1.6 / 46., 0);
  float centerNoise = fbm(p);
  vec2 curl = vec2(fbm(p + e.yx) - centerNoise, centerNoise - fbm(p + e)) * (46. / 1.6) * .05;
  vec2 saturationSlope = vec2(texture(fluid, uv + vec2(texel.x * 1.5,0)).a - texture(fluid, uv - vec2(texel.x * 1.5,0)).a,
                                 texture(fluid, uv + vec2(0,texel.y * 1.5)).a - texture(fluid, uv - vec2(0,texel.y * 1.5)).a);
  float slopeLength = length(saturationSlope);
  vec2 wickVelocity = -saturationSlope / max(slopeLength, .00001) * min(6. * slopeLength, 1.) * 1.05 * smoothstep(.2, .6, saturation) * (1. - .5 * wet);
  vec2 velocity = fluidHere.gb + 1.6 * curl * smoothstep(.025, .28, h) + wickVelocity;
  vec2 upstream = uv - velocity * texel;
  vec4 a = texture(looseA, upstream), b = texture(looseB, upstream);
  vec4 depositedA = texture(fixedA, uv), depositedB = texture(fixedB, uv);
  float diffusion = clamp(.45 * (.35 + 45. * h), 0., .45) * max(wet, .55 * smoothstep(.3, .9, saturation));
  a = mix(a, average(looseA), clamp(diffusion * (1.45 - weightsA), 0., .6));
  b = mix(b, average(looseB), clamp(diffusion * (1.45 - weightsB), 0., .6));
  // Once deposited, a photograph pixel becomes pigment. It is never restored
  // to its image color: subsequent frames are free to carry it beyond the stroke.
  float ink = newStroke(uv);
  if (ink > 0.) {
    vec3 color = texture(photo, uv).rgb;
    float luminance = dot(color, vec3(.2126,.7152,.0722));
    if (luminance < .93) {
      vec3 chroma = color / max(dot(color, vec3(1)), .001);
      // Camera adaptation: find a two-pigment mixture instead of reducing
      // every low-saturation blue pixel to the nearest gray swatch.
      int first = 0, second = 0; float blend = 0., distance = 100.;
      for (int i = 0; i < 8; i++) {
        for (int j = i; j < 8; j++) {
          vec3 direction = swatches[j] - swatches[i];
          float t = clamp(dot(chroma - swatches[i], direction) / max(dot(direction, direction), .000001), 0., 1.);
          vec3 difference = chroma - mix(swatches[i], swatches[j], t);
          float d = dot(difference, difference);
          if (d < distance) { first = i; second = j; blend = t; distance = d; }
        }
      }
      float amount = ink * min(.6 * (1. - luminance) + .06, .9);
      if (first < 4) a[first] += amount * (1. - blend); else b[first - 4] += amount * (1. - blend);
      if (second < 4) a[second] += amount * blend; else b[second - 4] += amount * blend;
    }
  }
  exchange(a, depositedA, weightsA, grainsA, stainsA, h, wet, saturation, tooth.r, length(velocity));
  exchange(b, depositedB, weightsB, grainsB, stainsB, h, wet, saturation, tooth.r, length(velocity));
  nextLooseA = a; nextLooseB = b; nextFixedA = depositedA; nextFixedB = depositedB;
}`;
export const render = `#version 300 es
${common}
uniform sampler2D fluid, paper, looseA, looseB, fixedA, fixedB, photo;
uniform vec3 absorption[8], scattering[8];
uniform float grains[8], ghost;
out vec4 color;
void main() {
  vec4 tooth = texture(paper, uv), water = texture(fluid, uv);
  vec4 a = texture(fixedA, uv) + .85 * texture(looseA, uv);
  vec4 b = texture(fixedB, uv) + .85 * texture(looseB, uv);
  vec3 k = vec3(0), s = vec3(0); float thickness = 0., granulation = 0.;
  for (int i = 0; i < 8; i++) {
    float concentration = i < 4 ? a[i] : b[i - 4];
    float density = pow(max(concentration, 0.), 1.35), layer = 2.2 * density / (density + 3.);
    k += absorption[i] * layer; s += scattering[i] * layer;
    thickness += layer; granulation += grains[i] * layer;
  }
  float dx = texture(paper, uv + vec2(texel.x,0)).r - tooth.r;
  float dy = texture(paper, uv + vec2(0,texel.y)).r - tooth.r;
  float relief = clamp(.985 - 3.5 * (dx + dy), .9, 1.05);
  float damp = max(wetness(water.r), .85 * smoothstep(.25, .9, water.a));
  vec3 sheet = vec3(.93,.905,.845) * (relief + (random(gl_FragCoord.xy) - .5) * .02) * (1. - .12 * damp);
  float toothEffect = max(.05, 1. + granulation / max(thickness, .00001) * 1.1 * ((tooth.r - .5) * 1.4 + (tooth.b - .5) * .6));
  k *= toothEffect * (1. + .2 * damp); s = max(s * toothEffect, vec3(.0001)) * (1. - .5 * damp);
  vec3 ratio = 1. + k / s, root = sqrt(max(ratio * ratio - 1., vec3(.000001)));
  vec3 exponential = exp(-2. * max(root * s, vec3(.0001)));
  vec3 coth = (1. + exponential) / max(1. - exponential, vec3(.000001));
  vec3 reflectance = (1. - sheet * (ratio - root * coth)) / (ratio - sheet + root * coth);
  if (thickness <= .0001) reflectance = sheet;
  reflectance = mix(reflectance, .582 * reflectance / (1. - .4 * reflectance), clamp(thickness * 1.5, 0., 1.));
  reflectance += .018 * wetness(water.r);
  vec3 displayColor = pow(clamp(reflectance, 0., 1.), vec3(1. / 2.2));
  float luma = dot(texture(photo, uv).rgb, vec3(.2126,.7152,.0722));
  displayColor *= 1. - ghost * .16 * (1. - luma);
  color = vec4(displayColor, 1.);
}`;
export const copyMask = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D mask;
out vec4 color;
void main() { color = texture(mask, uv); }
`;
