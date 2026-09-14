import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureSession } from '../capture-session.js';
import { bloomArrival, bloomCoverage } from '../bloom.js';

test('one click completes the photo bloom without a release event', () => {
  const session = new CaptureSession(); assert.equal(session.begin(),true);
  session.advance(1000); assert.equal(session.progress,.5); assert.equal(session.state,'painting');
  session.advance(1000); assert.equal(session.progress,1); assert.equal(session.state,'settling');
  session.advance(800); assert.equal(session.state,'review'); assert.equal(session.active,false);
});
test('double clicks cannot restart a capture or overwrite its elapsed time', () => {
  const session = new CaptureSession(); session.begin(); session.advance(600);
  assert.equal(session.begin(),false); assert.equal(session.reset(),false); assert.equal(session.elapsed,600);
  session.advance(10000); assert.equal(session.begin(),false); assert.equal(session.elapsed,2800);
  assert.equal(session.reset(),true); assert.equal(session.elapsed,0); assert.equal(session.begin(),true);
});
test('idle time never begins capture and paused animation needs no wall-clock correction', () => {
  const session = new CaptureSession(); session.advance(5000); assert.equal(session.state,'ready');
  session.begin(); session.advance(900); session.advance(0); session.advance(NaN); session.advance(-10);
  assert.equal(session.elapsed,900); session.advance(1900); assert.equal(session.state,'review');
});
test('bloom begins at one origin and coverage only increases to fill the frame', () => {
  const origin = {x:.5,y:.55}; assert.equal(bloomArrival(origin.x,origin.y,.8,origin),0);
  const arrivals = [];
  for(let y=0;y<=1;y+=.05) for(let x=0;x<=1;x+=.05) arrivals.push(bloomArrival(x,y,.8,origin));
  const max=Math.max(...arrivals), feather=.045;
  for(const arrival of arrivals){let previous=0;for(let t=0;t<=1;t+=.05){const next=bloomCoverage(arrival,t,max,feather);assert.ok(next>=previous);previous=next;}assert.equal(bloomCoverage(arrival,0,max,feather),0);assert.ok(bloomCoverage(arrival,1,max,feather)>.99999);}
  assert.ok(bloomCoverage(0,.1,max,feather)>.9);assert.equal(bloomCoverage(max,.1,max,feather),0);
});
