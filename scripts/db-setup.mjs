// Applies supabase/schema.sql to the database in SUPABASE_DB_URL (Session pooler connection string).
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL manquant (Supabase → Connect → Session pooler).');
  process.exit(1);
}

const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('folders', 'items') order by 1",
  );
  console.log('Schéma appliqué. Tables :', rows.map((r) => r.table_name).join(', '));
} finally {
  await client.end();
}
