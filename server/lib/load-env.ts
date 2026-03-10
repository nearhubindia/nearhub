/**
 * Environment Loader Utility
 * Shared utility for loading .env files in scripts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Load environment variables from the first available .env file
 * @param scriptName - Name of the script (for logging)
 * @returns boolean - true if .env was loaded
 */
export function loadEnv(scriptName: string = 'Script'): boolean {
  const cwd = process.cwd();
  const envPath =
    path.basename(cwd) === 'server' ? path.resolve(cwd, '.env') : path.resolve(cwd, 'server/.env');
  if (fs.existsSync(envPath)) {
    console.log(`[${scriptName}] Loading .env from: ${envPath}`);
    dotenv.config({ path: envPath });
    return true;
  }

  console.warn(`[${scriptName}] ⚠️  No server .env file found, using environment variables`);
  return false;
}
