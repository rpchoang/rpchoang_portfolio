"""
Extract frames from the cyborg spin video and apply the same chroma-key
algorithm used in About.tsx (lines 141-152) so results are pixel-identical.

Usage:
  python scripts/extract-cyborg-frames.py
"""

import os
import subprocess
import sys
import tempfile
import numpy as np
from PIL import Image

# ── config ──────────────────────────────────────────────────────────────────
INPUT   = "public/assets/Simple_Character_Spin_slow_hq_loopfade.mp4"
OUTDIR  = "public/assets/cyborg-frames"
FPS     = 20          # must match EXTRACT_FPS in About.tsx
# ────────────────────────────────────────────────────────────────────────────


def chroma_key(arr: np.ndarray) -> np.ndarray:
    """
    Exact port of the JS logic in About.tsx:

        if (g > 60 && g - r > 15 && g - b > 15) {
          const gn = Math.min(1, (g - Math.max(r, b)) / 40);
          d[i+3] = Math.round((1 - gn) * 255);          // alpha
          d[i]   = Math.round(r*(1-gn) + 255*gn);       // R despill
          d[i+1] = Math.round(g*(1-gn) + 180*gn);       // G despill
          d[i+2] = Math.round(b*(1-gn) + 180*gn);       // B despill
        } else if (g > r && g > b) {
          d[i+1] = Math.round((r + b) / 2);             // soft despill only
        }
    """
    arr = arr.astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    cond1 = (g > 60) & ((g - r) > 15) & ((g - b) > 15)
    cond2 = ~cond1 & (g > r) & (g > b)

    gn = np.clip((g - np.maximum(r, b)) / 40.0, 0.0, 1.0)

    alpha = np.where(cond1, np.round((1 - gn) * 255), 255).astype(np.uint8)

    out_r = np.where(cond1, np.round(r * (1 - gn) + 255 * gn), r)
    out_g = np.where(cond1, np.round(g * (1 - gn) + 180 * gn),
                     np.where(cond2, np.round((r + b) / 2), g))
    out_b = np.where(cond1, np.round(b * (1 - gn) + 180 * gn), b)

    result = np.stack(
        [out_r.clip(0, 255).astype(np.uint8),
         out_g.clip(0, 255).astype(np.uint8),
         out_b.clip(0, 255).astype(np.uint8),
         alpha],
        axis=-1,
    )
    return result


def main():
    os.makedirs(OUTDIR, exist_ok=True)

    # Extract raw RGB frames into a temp directory, then key each one.
    with tempfile.TemporaryDirectory() as tmp:
        print(f"Extracting frames at {FPS} fps …")
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", INPUT,
                "-vf", f"fps={FPS}",
                "-pix_fmt", "rgb24",
                os.path.join(tmp, "frame_%04d.png"),
            ],
            check=True,
        )

        raw_frames = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        total = len(raw_frames)
        print(f"Keying {total} frames …")

        for idx, fname in enumerate(raw_frames, 1):
            src = os.path.join(tmp, fname)
            dst = os.path.join(OUTDIR, fname)

            img  = Image.open(src).convert("RGB")
            arr  = np.array(img)
            keyed = chroma_key(arr)
            Image.fromarray(keyed, "RGBA").save(dst, optimize=False, compress_level=1)

            if idx % 50 == 0 or idx == total:
                print(f"  {idx}/{total}")

    print(f"\nDone — {total} frames saved to {OUTDIR}/")


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(__file__), ".."))
    main()
