import pg from 'pg';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_DIRS = [
  join(__dirname, '..', 'migrations', 'postgres', 'core'),
  join(__dirname, '..', 'migrations', 'postgres', 'timescaledb'),
  join(__dirname, '..', 'migrations', 'postgres', 'rls'),
];

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

    for (const dir of MIGRATION_DIRS) {
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
