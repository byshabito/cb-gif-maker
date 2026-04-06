# CbGifTool

Browser-only GIF conversion for GitHub Pages, powered by `ffmpeg.wasm`.

## What it does

- Converts local videos to GIFs entirely in the browser.
- Uses the same pipeline as the original shell script:
  - `hqdn3d=2.0:1.5:3.0:3.0`
  - `scale=250:-1` for wide inputs, otherwise `scale=-1:80`
  - `palettegen`
  - `paletteuse=dither=bayer:bayer_scale=3`
- Supports local `.mp4` input.

## Local development

```bash
npm install
npm run dev
```

The ffmpeg core assets are copied from `node_modules/@ffmpeg/core/dist/esm/` into `public/ffmpeg/` so the app can load them from the same origin instead of a CDN.
At runtime, those same-origin assets are wrapped into blob URLs before `ffmpeg.load()` so Vite dev mode does not treat them as source imports.

## Build

```bash
npm run build
npm run preview
```

Production builds use the GitHub Pages base path `/CbGifTool/`.

## GitHub Pages

This repo includes `.github/workflows/deploy.yml` for the standard GitHub Pages Actions deployment flow.

1. Push to `main`.
2. In the repository settings, open Pages.
3. Set **Build and deployment** to **GitHub Actions**.

## Browser limitations

- Large files can fail because browser memory is limited.
- `ffmpeg.wasm` also documents a 2 GB WebAssembly limit.
- Only MP4 input is supported in this version.
- Processing happens on the client, so slower devices may take a while.

## Licensing note

- `@ffmpeg/ffmpeg` and `@ffmpeg/util` are MIT-licensed packages.
- `@ffmpeg/core` bundles FFmpeg-related assets and should be reviewed with FFmpeg licensing requirements in mind before redistribution.
