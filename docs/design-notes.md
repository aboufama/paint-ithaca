# Design and reference notes

## What Sudo Aquarelle does

Reference inspected September 13, 2026: [sudoaquarelle.com](https://sudoaquarelle.com/).

The interface prioritizes a generous paper canvas, a narrow instrument rail, circular pigment wells, quiet dividers, and restrained color. Painting has a visible material response: color travels while the paper is wet, then settles as it dries.

Its [simulation](https://sudoaquarelle.com/js/sim.js) uses WebGL2, paper texture, water, mobile/deposited pigment and Kubelka–Munk color mixing. Its [application](https://sudoaquarelle.com/js/main.js) converts imported photos into wet pigment fields and records painting events for films. These are observations from its public source; no reference source is shipped in this repository.

The useful product lesson is the direct connection between a gesture and the canvas. Paint Ithaca translates it into **open camera → interact with live watercolor → capture → choose a place → join the painting**. Location swatches filter the view; the canvas remains the primary surface.

## Our effect

`watercolor.js` implements an independent, smaller simulation. Two pairs of GPU textures store suspended pigment/water and settled pigment. Each step transports and diffuses the mobile field between wet neighbors, evaporates water, and deposits pigment according to paper grain and drying edges. A brush adds water and lifts a little deposited pigment. A reflectance pass combines the resulting pigment with textured paper.

The photo mosaic is rasterized from the same layout as its accessible photo buttons, so resized layouts retain matching hit targets. A low-resolution simulation limits GPU cost while the presentation pass adds finer paper grain. Animation stops after drying and restarts on interaction; hidden pages stop rendering. Reduced-motion mode opens on a settled painting.

This reproduces spreading, pooling, textured pigment and drying behavior, but is not numerically equivalent to the reference's full engine. It omits the eight-pigment palette, capillary layer, salt, tilt and other advanced studio tools to keep the contribution UI simple.

Background reading: [Computer-Generated Watercolor, Curtis et al.](https://grail.cs.washington.edu/projects/watercolor/).

## Demo boundaries

- Six licensed photographs provide a factual sample of Ithaca, not recent community activity.
- Uploads and deletions affect this browser only.
- The film is a frontend visualization and optional recording, not a backend processing result.
- The existing backend remains untouched; its endpoints can replace the sample manifest, contribution persistence and film source.

## Camera

The camera is the primary contribution action, with a fixed mobile action and a full-screen mobile viewfinder. Its video frames continuously replenish the simulated pigment field, so the effect reacts to camera movement rather than processing only a still. Front/rear switching uses ideal facing-mode constraints. Captures match the displayed crop and mirror and retain the original frame separately. A sample stream supports demonstrations without camera permission.
