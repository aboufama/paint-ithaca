# Paint Ithaca

**[Compare all ten effects](https://aboufama.github.io/paint-ithaca/effects/)** · [Open the camera](https://aboufama.github.io/paint-ithaca/)

Point your phone. Tap the shutter. Your photo blooms into watercolor in 2.8 seconds.

The page requests the rear camera on startup and shows its live, full-color view directly. One click captures one frame, stops the camera, and starts a single irregular watercolor bloom from the center. Fine photographic detail remains visible inside the painted area; water and pigment simulate the moving, feathered edge. Retake reopens the camera. Save downloads the animated film, or a PNG when recording is unavailable.

The camera has no sample-photo fallback, camera-selection section, press-and-hold interaction, or changing headline. Its shutter disappears after capture, and native video playback controls are disabled. The viewfinder has a subtle 6px corner radius. Camera and photo data stay on the device; the existing backend is untouched.

## Ten independent effect studies

`effects/` is a separate comparison page using one shared Cayuga Lake demo photograph. Ten fresh agents independently authored one effect module each, without reading the other variants. The agents shared only the renderer interface and a different creative direction for each study. Each module contains its own motion, image treatment, and textures; these are independent Canvas2D drafts rather than ten settings of the camera's existing shader.

Click a numbered study to replay it, or use **Play all 10**. Each animation finishes automatically. There are no pause controls. The camera remains available through the page navigation. See `effects/AUTHORSHIP.md` for module provenance.

## Run and deploy

```sh
npm run dev
# http://127.0.0.1:4173
npm test
npm run build
```

No dependencies to install. Python 3 serves the preview; Node 22+ runs the tests and build. GitHub Actions publishes `dist/` to GitHub Pages on changes to main. Camera access requires HTTPS or localhost and browser permission.

## Implementation

`app.js` copies the current video frame exactly once at capture. It preserves the preview crop and front-camera mirroring, closes camera tracks immediately, and never reads the video during painting. Duplicate taps are ignored. Switching away pauses the animation and recording; a live camera preview is closed and offers reconnection on return.

`capture-session.js` runs a 2-second reveal and 0.8-second settling finish. `bloom.js` computes a fixed, irregular radial arrival field. New coverage adds water and pigment once. The WebGL2 renderer evolves surface water, fiber saturation, and eight suspended/deposited pigments with finite-layer Kubelka–Munk optics. The frozen photograph adds detail only within the painted interior, leaving the wet edge and halo to the simulation.

The underlying watercolor model was independently implemented after studying the readable shaders served by Sudo Aquarelle. Its source files are not bundled. Camera-specific source compositing and the point bloom are original to this demo.

## Verification

- `npm test` checks automatic completion, duplicate taps, replay state, pause-safe timing, monotonic point-bloom coverage, and pigment calibration.
- `tests/camera-probe.html` runs the real app against a synthetic video stream. Its `run_camera_capture_checks` WebMCP tool verifies a single startup camera request, video-only permission, exactly one frozen snapshot, immediate track shutdown, preserved image detail after the feed changes, and Retake/Save availability. It never opens a physical camera.
- `tests/gpu-probe.html` verifies actual wet pigment transport against a dry-paper control.

Test pages are excluded from the published build. The effect gallery includes its own attributed copy of the demo photo. Physical camera permissions and front/rear switching should also be checked on target phones.

Original code is MIT licensed. The demo and test photograph are CC BY-SA 4.0; see [photo credits](PHOTO-CREDITS.md).
