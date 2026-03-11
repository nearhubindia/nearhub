/**
 * Environment bootstrap – must be imported BEFORE any module that reads
 * process.env (e.g. lib/config.ts, data/db.ts).
 *
 * ESM hoists `import` declarations, so dotenv.config() in a normal
 * module body runs AFTER all static imports have been evaluated.
 * By putting the dotenv calls in their own module and importing it
 * first, we guarantee the env vars are available when downstream
 * modules initialize.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
const cwd = process.cwd();
const envPath =
  path.basename(cwd) === 'server' ? path.resolve(cwd, '.env') : path.resolve(cwd, 'server/.env');
let loaded = false;

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`[Env] Loaded: ${envPath}`);
    loaded = true;
  }
}

if (!loaded) {
  console.warn('[Env] ⚠️  No server .env file found');
}
