import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔄 Running PostgreSQL Schema Migrations...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    // Drop products and dependent tables if schema column structure changed
    await pool.query(`
      DROP TABLE IF EXISTS inventory_logs CASCADE;
      DROP TABLE IF EXISTS order_items CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS sub_categories CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
    `);

    await pool.query(sql);
    console.log('✅ PostgreSQL Schema tables, indexes, and constraints created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
