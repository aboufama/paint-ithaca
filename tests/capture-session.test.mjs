import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureSession } from '../capture-session.js';

test('one click completes the photo bloom without a release event', () => {
  const session = new CaptureSession(); assert.equal(session.begin(),true);
  session.advance(1000); assert.equal(session.progress,.5); assert.equal(session.state,'painting');
  session.advance(1000); assert.equal(session.progress,1); assert.equal(session.state,'review'); assert.equal(session.active,false);
});
test('double clicks cannot restart a capture or overwrite its elapsed time', () => {
  const session = new CaptureSession(); session.begin(); session.advance(600);
  assert.equal(session.begin(),false); assert.equal(session.reset(),false); assert.equal(session.elapsed,600);
  session.advance(10000); assert.equal(session.begin(),false); assert.equal(session.elapsed,2000);
  assert.equal(session.reset(),true); assert.equal(session.elapsed,0); assert.equal(session.begin(),true);
});
test('idle time never begins capture and paused animation needs no wall-clock correction', () => {
  const session = new CaptureSession(); session.advance(5000); assert.equal(session.state,'ready');
  session.begin(); session.advance(900); session.advance(0); session.advance(NaN); session.advance(-10);
  assert.equal(session.elapsed,900); session.advance(1100); assert.equal(session.state,'review');
});
