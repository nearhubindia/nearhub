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
  const possiblePaths = [
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    '/home/pavanprasad/Downloads/nearhub/.env',
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      console.log(`[${scriptName}] Loading .env from: ${envPath}`);
      dotenv.config({ path: envPath });
      return true;
    }
  }

  console.warn(`[${scriptName}] ⚠️  No .env file found, using environment variables`);
  return false;
}
