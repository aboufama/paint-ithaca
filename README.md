# Paint Ithaca

**[Open the camera](https://aboufama.github.io/paint-ithaca/)**

Point your phone. Tap the shutter. A pencil sketch appears almost immediately, then color floods in over 2.0 seconds.

Tidal Bloom is the camera’s single effect, combining its watercolor wash with light pencil detail from Graphite Blooms and the developing edge of Prussian Sunprint. A feathery wash spreads from one point with an irregular, softly branching edge, revealing the photo’s natural colors and subtle graphite contours. There is no blue sunprint tint. The comparison gallery and other effects have been removed; its old link redirects to the camera.

The page requests the rear camera on startup. One tap captures the visible frame, stops the camera, and starts the painting. Retake reopens the camera. Save downloads the animated film, or a PNG when recording is unavailable. The interface keeps only the wordmark, action labels and necessary camera permission or error messages. There are no pause buttons or sample photos in the camera flow. Photos stay on the device; the existing backend is untouched.

## Run and deploy

```sh
npm run dev
# http://127.0.0.1:4173
npm test
npm run build
```

No dependencies to install. Python 3 serves the preview; Node 22+ runs the tests and build. GitHub Actions publishes `dist/` to GitHub Pages on changes to main. Camera access requires HTTPS or localhost and browser permission.

## Implementation

`app.js` copies the current video frame exactly once, preserving the preview crop and front-camera mirroring. It closes camera tracks immediately and paints only that frozen image. Duplicate taps are ignored. Switching away pauses the animation and recording; a live camera preview is closed and offers reconnection on return.

`tidal-bloom.js` uses Canvas2D, precomputed paper grain, a lightly simplified photo, and a feathered moving mask based on Prussian Sunprint’s developing exposure field. Pencil contours from Graphite Blooms appear across the photo in 140 milliseconds, then recede beneath the incoming color. The original Tidal Bloom, Graphite Blooms, and Prussian Sunprint drafts were independently authored by the `effect_01`, `effect_09`, and `effect_06` agents. Their selected elements now form one renderer. `capture-session.js` drives its 2.0-second reveal; each new capture starts from clean paper.

## Verification

- `npm test` checks automatic completion, duplicate taps, retake state, and timing while backgrounded.
- `tests/camera-probe.html` runs the actual app against a synthetic video stream. Its checks verify video-only permission, exactly one frozen snapshot, immediate camera shutdown, visible photo detail, exact final renderer output, and Retake/Save availability. It never opens a physical camera.

Tests and the fixture photograph are excluded from deployment. Physical camera permissions and front/rear switching should also be checked on target phones.

Original code is MIT licensed. The test photograph is CC BY-SA 4.0; see [photo credits](PHOTO-CREDITS.md).
