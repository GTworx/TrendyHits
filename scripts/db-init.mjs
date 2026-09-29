// Creates the `tracks` table (db/schema.sql). Usage: npm run db:init
// (The functions also create it lazily on first use, so this is optional.)
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import './agents/lib/env.mjs';

const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('✖ Set NETLIFY_DATABASE_URL or DATABASE_URL (or run via `netlify dev:exec npm run db:init`).');
  process.exit(1);
}
const sql = neon(url);
await sql.query(readFileSync('db/schema.sql', 'utf8'));
console.log('✔ tracks table ready');
