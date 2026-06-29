import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  try {
    await pool.query(schema);
    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
  } finally {
    await pool.end();
  }
}

initDb();
