import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, "..");
const sourceDir = resolve(projectRoot, "node_modules/@ffmpeg/core/dist/esm");
const targetDir = resolve(projectRoot, "public/ffmpeg");

const requiredFiles = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!existsSync(sourceDir)) {
  console.error("Missing @ffmpeg/core build assets. Run npm install first.");
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

for (const file of requiredFiles) {
  cpSync(resolve(sourceDir, file), resolve(targetDir, file));
}

