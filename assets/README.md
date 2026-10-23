# Brand assets

| File               | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `logo-source.png`  | Original raster used to regenerate everything below |
| `logo.svg`         | Vector wordmark with a transparent background       |
| `logo.png`         | 1600 px raster wordmark                             |
| `logo-rounded.png` | Circular app icon (mink head)                       |

`apps/docs/public/logo.png` is a copy of the circular icon used by the docs
favicon and navbar. The TUI uses a separate minimalist block wordmark in
`packages/tui/src/components/logo.tsx`.

Regenerate all files after replacing `logo-source.png`:

```sh
python3 -m venv .venv-logo
.venv-logo/bin/pip install numpy pillow vtracer cairosvg
.venv-logo/bin/python scripts/generate-logo-assets.py
```

The generator removes the white background, traces the artwork with VTracer
(spline mode), renders the SVG at 10 000 px for the icon crop, and samples the
high-resolution render into the TUI bitmap.
