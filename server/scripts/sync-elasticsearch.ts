#!/usr/bin/env node

/**
 * Script to sync all listings to Elasticsearch
 * Usage: node scripts/sync-elasticsearch.js
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log(`[Env] Loading from: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`[Env] No .env file found at ${envPath}`);
}

import {
  syncAllListings,
  initializeElasticsearch,
} from '../features/search/services/elasticsearch';

async function main() {
  console.log(`
╔═══════════════════════════════════════╗
║   Elasticsearch Listings Sync Script    ║
╚═══════════════════════════════════════╝
  `);

  try {
    // Initialize Elasticsearch
    console.log('\n[1/2] Initializing Elasticsearch...');
    await initializeElasticsearch();

    // Sync listings
    console.log('\n[2/2] Syncing listings...');
    const result = await syncAllListings();

    console.log(`
╔═══════════════════════════════════════╗
║             SYNC COMPLETE               ║
╠═══════════════════════════════════════╣
║ Synced:  ${result.synced.toString().padStart(30)}│
║ Failed:  ${result.failed.toString().padStart(30)}│
╚═══════════════════════════════════════╝
    `);

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n[ERROR] Sync failed:', error);
    process.exit(1);
  }
}

main();
