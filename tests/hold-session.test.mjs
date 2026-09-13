import test from 'node:test';
import assert from 'node:assert/strict';
import { HoldSession } from '../hold-session.js';

function setup() {
  let clock = 0, starts = 0, finishes = 0;
  const session = new HoldSession({ now: () => clock, onStart: () => starts++, onFinish: () => finishes++ });
  return { session, advance: ms => clock += ms, counts: () => ({ starts, finishes }) };
}

test('release outside the button followed by lost pointer capture finishes once', () => {
  const { session, advance, counts } = setup();
  session.begin(); advance(3250);
  assert.equal(session.finish(), true);
  advance(100); assert.equal(session.finish(), false);
  assert.equal(session.duration, 3250);
  assert.deepEqual(counts(), { starts: 1, finishes: 1 });
  assert.equal(session.state, 'settling');
});

test('blur or pointer cancellation keeps the held interval and prevents another hold during finalization', () => {
  const { session, advance, counts } = setup();
  session.begin(); advance(810); session.finish();
  assert.equal(session.begin(), false);
  assert.equal(session.reset(), false);
  assert.equal(session.duration, 810);
  session.complete(); assert.equal(session.state, 'review');
  assert.equal(session.begin(), false);
  assert.deepEqual(counts(), { starts: 1, finishes: 1 });
});

test('the maximum clip duration completes even when the user keeps holding', () => {
  const { session, advance, counts } = setup();
  session.begin(); advance(13000); session.tick();
  assert.equal(session.duration, 12000); assert.equal(session.state, 'settling');
  advance(2000); session.tick(); session.finish();
  assert.deepEqual(counts(), { starts: 1, finishes: 1 });
});

test('a new painting starts clean only after review', () => {
  const { session, advance, counts } = setup();
  session.begin(); advance(2000); session.finish(); session.complete();
  assert.equal(session.reset(), true); assert.equal(session.duration, 0);
  advance(9000); assert.equal(session.begin(), true); advance(400); session.tick();
  assert.equal(session.duration, 400); assert.deepEqual(counts(), { starts: 2, finishes: 1 });
});

test('clock ticks and releases cannot start a recording without a deliberate hold', () => {
  const { session, advance, counts } = setup();
  advance(30000); session.tick(); session.finish(); session.complete();
  assert.equal(session.state, 'ready'); assert.equal(session.duration, 0);
  assert.deepEqual(counts(), { starts: 0, finishes: 0 });
});
