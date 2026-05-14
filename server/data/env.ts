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
const isProduction =
  String(process.env.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production';
const explicitEnvFile = String(process.env.NEARHUB_ENV_FILE || '').trim();
const defaultProductionEnvFile = '/etc/nearhub/server.env';

const envCandidates = isProduction
  ? [explicitEnvFile || defaultProductionEnvFile]
  : [
      explicitEnvFile,
      // Local dev when running from server/
      path.resolve(cwd, '.env'),
      // Monorepo root style run
      path.resolve(cwd, 'server/.env'),
      // Release runtime where cwd is /releases/<timestamp>
      path.resolve(cwd, '../shared/.env'),
      // Explicit fallback
      defaultProductionEnvFile,
    ].filter(Boolean);

let loaded = false;
for (const envPath of envCandidates) {
  if (!fs.existsSync(envPath)) continue;
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`[Env] Loaded: ${envPath}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  if (isProduction) {
    console.warn(
      `[Env] ⚠️  Production env file not found. Expected: ${explicitEnvFile || defaultProductionEnvFile}`
    );
  } else {
    console.warn('[Env] ⚠️  No server .env file found');
  }
}
