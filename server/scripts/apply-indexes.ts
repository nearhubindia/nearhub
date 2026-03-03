import { sql } from 'drizzle-orm';
import { db } from '../data/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyIndexes() {
  console.log('📊 Applying performance indexes...\n');

  // Read the SQL file
  const sqlFilePath = path.join(__dirname, '../migrations/add-performance-indexes.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Split by semicolon and filter out comments and empty lines
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    if (statement.toLowerCase().includes('create index')) {
      // Extract index name for logging
      const indexMatch = statement.match(/idx_\w+/i);
      const indexName = indexMatch ? indexMatch[0] : 'unknown';

      try {
        await db.execute(sql.raw(statement));
        console.log(`✅ Created: ${indexName}`);
        successCount++;
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`⏭️  Skipped: ${indexName} (already exists)`);
          skipCount++;
        } else {
          console.error(`❌ Failed: ${indexName}`, error.message);
          errorCount++;
        }
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   Total: ${successCount + skipCount + errorCount}`);

  process.exit(0);
}

applyIndexes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
