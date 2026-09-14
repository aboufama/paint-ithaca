# Ten independent paint studies

Each effect was authored by a fresh, separate agent with no conversation history and an instruction not to inspect sibling variants. Each received a different visual direction and the same Canvas2D interface. The root agent built the shared gallery, demo-photo loading, playback and verification; it did not generate ten presets from one renderer.

| Study | Effect | Independent author task | Module |
|---|---|---|---|
| 01 | Tidal Bloom | /root/effect_01 | variants/01.js |
| 02 | Fiber Ink | /root/effect_02 | variants/02.js |
| 03 | Petal Wash | /root/effect_03 | variants/03.js |
| 04 | Pastel Gouache | /root/effect_04 | variants/04.js |
| 05 | Pigment Dust | /root/effect_05 | variants/05.js |
| 06 | Prussian Sunprint | /root/effect_06 | variants/06.js |
| 07 | Risograph Registration | /root/effect_07 | variants/07.js |
| 08 | Bristle Light | /root/effect_08 | variants/08.js |
| 09 | Graphite Blooms | /root/effect_09 | variants/09.js |
| 10 | Paper Mosaic | /root/effect_10 | variants/10.js |

The shared interface provides a 480×360 photo and asks each author for a deterministic draw(context, progress) function. Every author supplied its own animation, image treatment, textures and cleanup.

All ten passed browser checks for repeatable replay, nonblank animation, opaque final frames and visible contrast. Every pair of finished treatments produced different pixel output. The preview animations were also run in the browser. These are creative drafts for selection, not a claim of physical equivalence between their materials.
