# Paint Ithaca

**[Live demo](https://aboufama.github.io/paint-ithaca/)**

Just a camera. Hold to record, and broad watercolor strokes paint the view onto paper. Release to let the pigment settle, then save the moment or start again.

## Run

```sh
npm run dev
# http://127.0.0.1:4173
npm test
npm run build
```

No dependencies to install. Python 3 serves the local preview; Node 22+ runs the build and lifecycle tests. GitHub Actions publishes `dist/` to GitHub Pages when main changes.

## The interaction

- The page opens directly on a pale camera view, with one hold button. A clearly labeled Cayuga Lake sample lets you try it immediately.
- **Use my camera** requests video only. The rear phone camera is preferred. A small flip control appears when another camera is available.
- **Hold** with a finger, mouse, or Space/Enter while the record button is focused. Overlapping brush passes deposit pigment from the camera feed. Coarse frame motion gently influences the strokes. The scene colors in progressively instead of instantly becoming a filtered video.
- **Release** stops new paint. Wet edges continue bleeding for 2.2 seconds and the same view becomes the finished moment. Clips are capped at 12 seconds.
- **Save film** downloads the actual painted-canvas recording. When video recording is unsupported, **Save image** exports a still. **Again** returns to clean paper.
- Pointer cancellation, release outside the button, focus loss, backgrounding, and camera disconnection end the hold. Camera tracks stop after capture and when leaving the page.

The frontend does not upload or persist camera data. The existing backend is untouched. No forms, gallery, location filters, community canvas, daily processing job, or account flow are included.

## Watercolor

The renderer was rebuilt after inspecting the readable JavaScript and shaders served by [Sudo Aquarelle](https://sudoaquarelle.com/). It independently implements the same governing water/pigment model and calibrated material constants:

- A persistent surface-water field carries height and velocity; a separate channel tracks water absorbed into paper fibers.
- Eight pigment channels move through the water, wick into adjacent fibers, stain the paper, lift again when wet, and settle as water evaporates.
- Paper relief and pore thresholds create granulation and irregular bleeding. Evaporation drives pigment toward the edges of wet paint.
- Finite-layer Kubelka–Munk absorption/scattering, transparent optical thickness, wet darkening, surface reflection and display gamma determine the actual painted color.

`watercolor.js` manages the GPU fields; `watercolor-shaders.js` implements transport and optics; `pigment-model.js` calibrates the eight paints. `brush.js` supplies a cumulative bristle footprint. **Only newly touched coverage injects pigment and water, once per update.** The photograph never pulls pigment back into place; paint can travel outside the brush footprint and continue moving after release.

The camera adapter blends two paint materials per source pixel to preserve muted sky and foliage colors. It also uses broader strokes and a wetter initial charge than the reference photo importer. The paper noise realization and camera input differ from the reference, so this is not a pixel-identical clone. No third-party implementation files are redistributed.

The GPU regression fixture at `tests/gpu-probe.html` compares wet pigment transport with a dry control. After 60 simulation steps, the wet fixture placed 11.7% of pigment beyond its initial radius plus a two-texel guard, with a 41.8% increase in spatial variance. The dry control showed no movement. Gather advection is approximate; the fixture allows bounded mass drift. Open the fixture locally and select **Run transport checks** to repeat it. The build excludes this test page.

`hold-session.js` owns the hold → settle → review lifecycle. Tests cover cancellation, duplicate release events, maximum duration, and starting again. A bounded sample-recording tool is exposed when WebMCP is available; physical camera permission always remains a deliberate user action.

## Integration

Connect the existing backend at the completed Blob in `app.js`. At present, Save only downloads it. Camera access requires HTTPS or localhost and browser permission. Physical camera switching should also be checked on the target phone browsers.

## Credits

Original code is MIT licensed. The included [Cayuga Lake photograph](https://commons.wikimedia.org/wiki/File:Cayuga_Lake%2C_May_2025.jpg) is by Acurarri, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The sample is cropped, animated and painted; its adaptations retain CC BY-SA 4.0. See [photo credits](PHOTO-CREDITS.md).
