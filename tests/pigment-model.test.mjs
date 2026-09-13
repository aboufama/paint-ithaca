import test from 'node:test';
import assert from 'node:assert/strict';
import { pigments, coefficients } from '../pigment-model.js';

test('all paint materials produce finite positive optical coefficients', () => {
  for (const pigment of pigments) for (const vector of Object.values(coefficients(pigment))) {
    assert.equal(vector.length, 3);
    vector.forEach(value => assert.ok(Number.isFinite(value) && value > 0));
  }
});

test('ultramarine calibration preserves its measured blue reflectance', () => {
  const { absorption, scattering } = coefficients(pigments[0]);
  const expectedK = [1.588944,1.215263,.298775], expectedS = [.008964,.012333,.027944];
  absorption.forEach((value,i) => assert.ok(Math.abs(value-expectedK[i])<.00001));
  scattering.forEach((value,i) => assert.ok(Math.abs(value-expectedS[i])<.00001));
  assert.ok(absorption[2] < absorption[0], 'Blue should absorb less than red');
});
