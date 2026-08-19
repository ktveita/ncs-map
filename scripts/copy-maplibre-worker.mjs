// Copies maplibre-gl's worker script (and the shared chunk it imports) into
// public/ so it can be served as a static file and referenced explicitly via
// maplibregl.setWorkerUrl(). See the comment in src/components/MapView.tsx
// for why this is necessary.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dest = join(root, "public");

mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(src, file), join(dest, file));
}
