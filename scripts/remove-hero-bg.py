"""
Remove backgrounds from hero landing frame sequence using AI matting (rembg).
Uses birefnet-general model which handles dark clothing on dark backgrounds better.

Usage:
  pip install rembg[cpu] pillow numpy
  python scripts/remove-hero-bg.py

Output: public/assets/hero_landing_frames_nobg/  (PNG with alpha, same filenames)
"""

import os
import sys
import numpy as np
from pathlib import Path
from PIL import Image
from rembg import remove, new_session
from scipy.ndimage import binary_fill_holes, binary_erosion

INDIR  = Path("public/assets/hero_landing_frames")
OUTDIR = Path("public/assets/hero_landing_frames_nobg")
# birefnet-general handles dark-on-dark (suit vs background) better than isnet
MODEL  = "birefnet-general"
# Alpha threshold below which a pixel is considered a true edge vs interior
FILL_THRESHOLD = 30


def fill_interior(rgba: np.ndarray) -> np.ndarray:
    """
    Flood-fill semi-transparent interior pixels to full opacity.
    The model outputs low alpha on dark suit areas that are clearly foreground.
    Strategy: any pixel with alpha > FILL_THRESHOLD that is enclosed by the
    main foreground mask gets promoted to alpha=255.
    """
    alpha = rgba[:, :, 3]
    # Binary mask: pixels the model is reasonably confident are foreground
    mask = alpha > FILL_THRESHOLD
    # Fill holes — enclosed low-alpha regions (interior body) become True
    filled = binary_fill_holes(mask)
    # Erode slightly to avoid pulling in background fringe pixels at edges
    eroded = binary_erosion(filled, iterations=2)
    # Promote interior pixels that were semi-transparent to fully opaque
    out = rgba.copy()
    out[eroded & (alpha < 255), 3] = 255
    return out


def main():
    frames = sorted(INDIR.glob("*.webp"))
    if not frames:
        print(f"No .webp frames found in {INDIR}", file=sys.stderr)
        sys.exit(1)

    OUTDIR.mkdir(parents=True, exist_ok=True)

    print(f"Loading model '{MODEL}' ...")
    session = new_session(MODEL)

    total = len(frames)
    print(f"Processing {total} frames ...\n")

    for idx, src in enumerate(frames, 1):
        dst = OUTDIR / src.with_suffix(".png").name

        with Image.open(src) as img:
            result = remove(img, session=session)
            arr = np.array(result)
            arr = fill_interior(arr)
            Image.fromarray(arr, "RGBA").save(dst)

        if idx % 20 == 0 or idx == total:
            print(f"  {idx}/{total}  ->  {dst.name}")

    print(f"\nDone - {total} frames saved to {OUTDIR}/")


if __name__ == "__main__":
    os.chdir(Path(__file__).parent.parent)
    main()
