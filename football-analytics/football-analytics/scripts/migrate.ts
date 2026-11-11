import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url });
  const sql = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  await pool.end();
  console.log('Схема применена.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
