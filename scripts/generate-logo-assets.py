#!/usr/bin/env python3
"""Regenerate the Mink brand assets from a raster logo.

The raster is cleaned up (the white background is removed), traced with VTracer,
and written out as SVG + PNG for the README, docs, and app icon.

One-time setup:

    python3 -m venv .venv-logo
    .venv-logo/bin/pip install numpy pillow vtracer cairosvg
    .venv-logo/bin/python scripts/generate-logo-assets.py

The source image defaults to assets/logo-source.png.
"""

from __future__ import annotations

import re
import shutil
import tempfile
from collections import deque
from pathlib import Path

import cairosvg
import numpy as np
import vtracer
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "logo-source.png"
ASSETS = ROOT / "assets"
DOCS = ROOT / "apps" / "docs" / "public"


def flood(mask: np.ndarray, start: list[tuple[int, int]]) -> np.ndarray:
    """Return the part of ``mask`` connected to any of ``start`` (4-neighbourhood)."""
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for y, x in start:
        if mask[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def separate(source: Image.Image) -> tuple[Image.Image, np.ndarray]:
    """Remove the outer white background and return a crisp two-tone RGBA image."""
    rgb = np.asarray(source.convert("RGB")).astype(np.int16)
    height, width = rgb.shape[:2]
    white = (rgb[:, :, 0] > 230) & (rgb[:, :, 1] > 230) & (rgb[:, :, 2] > 230)
    border = [(0, x) for x in range(width)] + [(height - 1, x) for x in range(width)]
    border += [(y, 0) for y in range(height)] + [(y, width - 1) for y in range(height)]
    outer = flood(white, border)

    luminance = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    black = (luminance < 128) & ~outer
    # Silhouette = artwork plus the white details enclosed by it. Flooding the
    # non-black area from the border drops the source's anti-aliased fringe.
    border = [(0, x) for x in range(width)] + [(height - 1, x) for x in range(width)]
    border += [(y, 0) for y in range(height)] + [(y, width - 1) for y in range(height)]
    outside = flood(~black, border)
    silhouette = ~outside

    pixels = np.zeros((height, width, 3), dtype=np.uint8)
    pixels[silhouette] = 255
    pixels[black] = 0
    alpha = np.where(silhouette, 255, 0).astype(np.uint8)
    image = Image.fromarray(np.dstack([pixels, alpha]), "RGBA")
    # Smooth before the trace so circles and stems do not inherit pixel steps.
    smooth = image.resize((width * 2, height * 2), Image.LANCZOS)
    smooth = smooth.filter(ImageFilter.GaussianBlur(2))
    data = np.asarray(smooth).copy()
    luminance = 0.2126 * data[:, :, 0] + 0.7152 * data[:, :, 1] + 0.0722 * data[:, :, 2]
    covered = data[:, :, 3] > 128
    is_black = (luminance < 128) & covered
    data[is_black] = [0, 0, 0, 255]
    data[covered & ~is_black] = [255, 255, 255, 255]
    data[~covered] = [255, 255, 255, 0]
    return Image.fromarray(data, "RGBA"), is_black


def trace(image: Image.Image, path: Path) -> list[str]:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    vtracer.convert_image_to_svg_py(
        str(path),
        str(path.with_suffix(".svg")),
        colormode="binary",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=16,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=1,
    )
    return re.findall(r"<path[^>]*/>", path.with_suffix(".svg").read_text())


def write_svg(silhouette: list[str], artwork: list[str], bounds: tuple[int, int, int, int]) -> Path:
    x0, y0, x1, y1 = bounds
    pad = 24
    view_x, view_y = x0 - pad, y0 - pad
    view_w, view_h = x1 - x0 + pad * 2, y1 - y0 + pad * 2

    def recolor(paths: list[str], color: str) -> list[str]:
        return [re.sub(r'fill="#[0-9a-fA-F]+"', f'fill="{color}"', path) for path in paths]

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{view_w}" height="{view_h}" '
        f'viewBox="{view_x} {view_y} {view_w} {view_h}" role="img" aria-label="Mink">',
        '  <g fill="#ffffff">',
        *("    " + path for path in recolor(silhouette, "#ffffff")),
        "  </g>",
        '  <g fill="#111111">',
        *("    " + path for path in recolor(artwork, "#111111")),
        "  </g>",
        "</svg>",
        "",
    ]
    target = ASSETS / "logo.svg"
    target.write_text("\n".join(lines))
    return target


def main() -> None:
    work = Path(tempfile.mkdtemp(prefix="mink-logo-"))
    image, is_black = separate(Image.open(SOURCE))
    silhouette = np.asarray(image)[:, :, 3] > 0
    # Bounds of the actual artwork in the 2x working image.
    artwork = np.asarray(image)[:, :, 0] < 128
    ys, xs = np.where(artwork)
    bounds = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))

    base_paths = trace(
        Image.fromarray(np.where(silhouette, np.uint8(0), np.uint8(255))[:, :, None].repeat(3, axis=2)),
        work / "silhouette.png",
    )
    art_paths = trace(
        Image.fromarray(np.where(is_black, np.uint8(0), np.uint8(255))[:, :, None].repeat(3, axis=2)),
        work / "artwork.png",
    )
    svg = write_svg(base_paths, art_paths, bounds)

    render = work / "logo-hi.png"
    cairosvg.svg2png(url=str(svg), write_to=str(render), output_width=10000)
    full = Image.open(render)
    wordmark = full.resize((1600, round(full.height * 1600 / full.width)), Image.LANCZOS)
    wordmark.save(ASSETS / "logo.png", optimize=True)

    # The app icon is the circular badge on the left of the wordmark.
    mask = np.asarray(Image.open(render).convert("RGBA"))[:, :, 3] > 128
    ys, xs = np.where(mask)
    top = ys.min()
    left = xs.min()
    center_x = int(np.median(xs[ys == top]))
    center_y = int(np.median(ys[xs == left]))
    radius = center_y - top
    pad = radius * 0.02
    box = tuple(
        int(round(value))
        for value in (
            center_x - radius - pad,
            center_y - radius - pad,
            center_x + radius + pad,
            center_y + radius + pad,
        )
    )
    icon = full.crop(box)
    size = icon.width
    yy, xx = np.mgrid[0:size, 0:size]
    distance = np.sqrt((xx - (size - 1) / 2) ** 2 + (yy - (size - 1) / 2) ** 2)
    covered = np.clip(size / 2 - 1 - distance + 0.5, 0, 1)[:, :, None]
    pixels = np.asarray(icon).copy()
    pixels[:, :, 3] = (pixels[:, :, 3] * covered[:, :, 0]).astype(np.uint8)
    icon = Image.fromarray(pixels, "RGBA")
    icon.resize((512, 512), Image.LANCZOS).save(ASSETS / "logo-rounded.png", optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(DOCS / "logo.png", optimize=True)

    shutil.rmtree(work, ignore_errors=True)
    print(f"Wrote {svg}, assets/logo.png and assets/logo-rounded.png")


if __name__ == "__main__":
    main()
