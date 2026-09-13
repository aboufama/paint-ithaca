# One camera, one gesture

The interface centers one sheet of paper, a quiet camera switch, and a pigment-colored hold button. The camera view begins almost like a pencil sketch so the user can frame the scene before recording.

Holding advances broad, irregular brush passes across the image. These passes inject color and water into a simulated paper surface. Subtle camera motion affects the path while the source image remains live. Releasing freezes the source, stops new pigment, and gives the wet edges a short settling finish. The same frame becomes the result with only Save and Again.

The interaction deliberately omits the earlier contribution form, photo gallery, filters, settings and community mosaic. It is a frontend camera proof of concept.

The material response follows the water transport, fiber percolation, pigment exchange and finite Kubelka–Munk optics studied in [Sudo Aquarelle](https://sudoaquarelle.com/). The reference exposes readable shaders; inspecting those revealed why the earlier photograph-correction loop prevented bleeding. That loop is gone. New brush coverage supplies paint once, then pigment moves independently through water and paper.

Eight pigment materials preserve different staining, granulation and transport rates. Cold-press paper has fixed relief and anisotropic pore thresholds. Color pools at wet edges and continues evolving for 2.2 seconds after release, and these settling frames are included in the saved film.

Camera pixels use a two-pigment mixture to retain low-saturation hues that the reference importer otherwise maps to gray. The reference's source files are not bundled; the implementation uses the same governing model with an independently generated paper texture and camera-specific input. It is not pixel-identical.
