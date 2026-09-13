# One camera, one gesture

The interface centers one sheet of paper, a quiet camera switch, and a pigment-colored hold button. The camera view begins almost like a pencil sketch so the user can frame the scene before recording.

Holding advances broad, irregular brush passes across the image. These passes inject color and water into a simulated paper surface. Subtle camera motion affects the path while the source image remains live. Releasing freezes the source, stops new pigment, and gives the wet edges a short settling finish. The same frame becomes the result with only Save and Again.

The interaction deliberately omits the earlier contribution form, photo gallery, filters, settings and community mosaic. It is a frontend camera proof of concept.

The material response is inspired by [Sudo Aquarelle](https://sudoaquarelle.com/). No reference code is distributed. The renderer independently models wet pigment diffusion, deposition into grain and approximate reflectance; it is not numerically equivalent to the reference engine.
