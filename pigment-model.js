/** Material measurements used to calibrate a finite Kubelka–Munk paint layer. */
export const pigments = [
  { name: 'Ultramarine', white: '#3b55c4', black: '#0a102a', grain: .85, stain: .30, weight: .90 },
  { name: 'Cerulean', white: '#4f9ad2', black: '#173349', grain: .90, stain: .20, weight: .95 },
  { name: 'Rose', white: '#e04b8a', black: '#400f26', grain: .05, stain: .80, weight: .25 },
  { name: 'Yellow', white: '#f4e04b', black: '#4a4410', grain: .05, stain: .50, weight: .30 },
  { name: 'Sienna', white: '#b65a33', black: '#33130a', grain: .60, stain: .40, weight: .70 },
  { name: 'Payne gray', white: '#46536a', black: '#0a0d14', grain: .35, stain: .60, weight: .55 },
  { name: 'Turquoise', white: '#12716e', black: '#03201f', grain: .10, stain: .90, weight: .30 },
  { name: 'Sap green', white: '#6d8e39', black: '#1b240f', grain: .25, stain: .60, weight: .40 }
];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
export function coefficients(pigment) {
  const white = rgb(pigment.white).map(linear), black = rgb(pigment.black).map(linear);
  const transparency = clamp(.55 * pigment.stain + .45 * (1 - pigment.weight), 0, 1);
  const opacity = 1 - .8 * transparency ** 1.25;
  const absorption = [], scattering = [];
  for (let channel = 0; channel < 3; channel++) {
    const rw = clamp(white[channel], .001, .998), rb = clamp(black[channel] * opacity, .0005, rw * .98);
    const a = .5 * (rw + (rb - rw + 1) / rb), b = Math.sqrt(Math.max(a * a - 1, 1e-12));
    const argument = Math.max((b * b - (a - rw) * (a - 1)) / (b * (1 - rw)), 1.0000001);
    const s = Math.atanh(1 / argument) / b;
    scattering.push(s); absorption.push(s * (a - 1));
  }
  return { absorption, scattering };
}
