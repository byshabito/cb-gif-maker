# GIF It!

Convert your clips to CB-ready GIFs locally.

## What it does

- Converts local videos to GIFs entirely in the browser
- Conversion pipeline:
  - trim video
  - `hqdn3d=2.0:1.5:3.0:3.0`
  - `scale=250:-2` for wide inputs, otherwise `scale=-2:80`
  - `-2` keeps the auto-computed dimension divisible by 2
  - `palettegen`
  - `paletteuse=dither=bayer:bayer_scale=3`
- Only supports `.mp4` for now

## Stack

- vite
- react
- tailwind css
- shadcn/ui
- ffmpeg.wasm

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

## Browser limitations

- Large files can fail because browser memory is limited.
- `ffmpeg.wasm` also documents a 2 GB WebAssembly limit.
- Only MP4 input is supported in this version.
- Processing happens on the client, so slower devices may take a while.

## Licensing note

- This project is licensed under `GPL-3.0-or-later`.
- `@ffmpeg/ffmpeg` and `@ffmpeg/util` are MIT-licensed packages.
- `@ffmpeg/core` bundles FFmpeg-related assets and is `GPL-2.0-or-later`; keep its notices in place when redistributing the bundled core.
