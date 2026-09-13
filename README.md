# Paint Ithaca

A frontend proof of concept for a community sketchbook: photos of Ithaca become a shared, moving watercolor mosaic.

**Demo:** https://aboufama.github.io/paint-ithaca/

## Run locally

Requires Python 3 for the development server. Node 22+ is used only to package the static site. No npm dependencies or installation are needed.

```sh
npm run dev
# http://127.0.0.1:4173
```

```sh
npm run build
# Upload dist/ to any static host.
```

## What works

- **Interactive camera first:** live webcam/phone viewfinder with real-time watercolor, front/rear camera switching, water control, original/painted comparison, and a shutter. Camera frames stay on-device. A labeled sample camera works without hardware or permissions. Capture matches the visible crop and mirror; both the rendered capture and original frame are retained locally.

- Responsive pastel sketchbook UI, real licensed Ithaca photography, location filters, and photo details.
- A live WebGL2 watercolor simulation: wet pigment transport, diffusion, paper deposition, granulation, and Kubelka–Munk reflectance. Drag over the canvas to add water and lift pigment. Adjust water amount, replay the reveal, or compare the original photographs.
- Photo selection and drag-and-drop, place selection, optional captions, validation, preview, contribution confirmation, and device-local persistence through IndexedDB. Photos are resized to 1200px and re-encoded as JPEG without the source metadata.
- Live canvas film preview and an 8-second browser recording/export where MediaRecorder is supported.
- Accessible native dialogs, keyboard controls, reduced-motion behavior, and an original-photo fallback when WebGL2 float textures are unavailable.
- Static GitHub Pages deployment on pushes to main.

## Frontend only

The backend already exists and is intentionally not implemented or changed here. No daily processing workflow, upload server, authentication service, database server, or moderation backend is included. The only GitHub Action deploys this frontend.

All sample imagery is labeled as a sample edition. Contributions stay in the current browser and do not reach your backend, other visitors, or a daily processing job. The daily-film button previews the browser canvas; it does not claim to show a completed backend film.

### Connect the existing backend

The contribution seams are in `app.js`; camera lifecycle and capture are in `camera.js`:

1. Replace the fetch of `data/edition.json` in `init()` with your edition endpoint. The sample manifest documents the expected display fields (`title`, `photos`, photo `id`, `image`, `place`, `title`, `alt`, and credits).
2. Replace the IndexedDB calls in the contribution submit/list/delete handlers with the existing contribution API. Use the server-issued ID and moderation state in the confirmation UI. Replace the device-only labels with truthful server status.
3. Supply the completed daily video URL to the film dialog in place of `canvas.captureStream()`.

For remote images, configure their host for CORS and set image `crossOrigin` before `src`; otherwise canvas export and pigment image reads will be blocked. Do not place private backend credentials in a GitHub Pages frontend.

## Watercolor reference

The visual interaction is inspired by [Sudo Aquarelle](https://sudoaquarelle.com/). Its actual effect comes from a fluid/pigment simulation, so this demo uses evolving pigment fields rather than a CSS color filter. This is an independent compact implementation, not a copy of its source or an exact reproduction of its larger eight-pigment engine.

See [design notes](docs/design-notes.md) for the reference deconstruction and implementation choices.

## Publishing

The repository's `.github/workflows/pages.yml` builds the static site and deploys it with GitHub Actions. In repository Settings → Pages, the source is **GitHub Actions**. All application asset paths are relative, so hosting under `/paint-ithaca/` works.

## Credits and licensing

Original application code: MIT. Photographs retain their individual Creative Commons licenses, listed in [photo credits](PHOTO-CREDITS.md) and in the app. Display crops, image resizes, and watercolor transformations are adaptations; adapted CC BY-SA photographs remain under the applicable share-alike license. No source code or imagery from Sudo Aquarelle is distributed.

## Camera behavior

Open camera → Enable camera → allow the browser prompt. On phones, the rear camera is preferred; Flip camera switches the preference. The browser must serve the app over HTTPS or localhost. Microphone access is never requested. Closing the camera, capturing a frame, leaving the page, or backgrounding the tab stops all camera tracks. If permission is denied, hardware is missing/busy, or camera access stays pending, the dialog retains clear recovery and sample/photo alternatives.

The sample stream runs through the same watercolor renderer as the live video. Its capture is labeled as a sample, with the original photo license retained. Captures store both `image` (the chosen rendered view) and `originalImage` (the source frame, when captured through the camera) for later backend integration.
