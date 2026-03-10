import fs from 'node:fs';
import path from 'node:path';

const [mapPathArg, outputFileArg] = process.argv.slice(2);

if (!mapPathArg) {
  console.error('[ensure-sourcemap-file] Missing map path argument');
  process.exit(1);
}

const mapPath = path.resolve(process.cwd(), mapPathArg);
const outputFile = outputFileArg || path.basename(mapPath, '.map');

if (!fs.existsSync(mapPath)) {
  console.error(`[ensure-sourcemap-file] Sourcemap not found: ${mapPath}`);
  process.exit(1);
}

let map;
try {
  map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
} catch (error) {
  console.error('[ensure-sourcemap-file] Invalid sourcemap JSON:', error);
  process.exit(1);
}

if (map.file !== outputFile) {
  map.file = outputFile;
  fs.writeFileSync(mapPath, JSON.stringify(map));
  console.log(`[ensure-sourcemap-file] Set file="${outputFile}" in ${mapPathArg}`);
}
