import pg from 'pg';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// migrations are at project root /migrations/postgres/...
const MIGRATION_DIRS = [
  join(__dirname, '..', '..', 'migrations', 'postgres', 'core'),
  join(__dirname, '..', '..', 'migrations', 'postgres', 'timescaledb'),
  join(__dirname, '..', '..', 'migrations', 'postgres', 'rls'),
];

async function checkTimescaleDB(client: any): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb' LIMIT 1`
  );
  return res.rows.length > 0;
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString, max: 1 });

  try {
    const client = await pool.connect();
    console.log('Connected to database. Running migrations...');

    // Check if TimescaleDB is available
    const hasTimescaleDB = await checkTimescaleDB(client);
    if (!hasTimescaleDB) {
      console.warn('⚠️  TimescaleDB extension not available. Skipping TimescaleDB-specific migrations.');
    }

    for (const dir of MIGRATION_DIRS) {
      // Skip timescaledb directory if extension not available
      if (!hasTimescaleDB && dir.includes('timescaledb')) {
        console.log(`  Skipping ${dir} (TimescaleDB not installed)`);
        continue;
      }

      const files = await readdir(dir).then(files => files.filter(f => f.endsWith('.sql')).sort());
      for (const file of files) {
        const filePath = join(dir, file);
        console.log(`  Applying ${filePath}`);
        const sql = await readFile(filePath, 'utf-8');
        await client.query(sql);
      }
    }

    console.log('Migrations completed successfully.');
    client.release();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
