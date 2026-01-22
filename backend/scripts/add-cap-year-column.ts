import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addCapYearColumn() {
  try {
    console.log('Adding cap_year column to trade_assets table...');

    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'trade_assets' AND column_name = 'cap_year'
    `);

    if (checkResult.rows.length > 0) {
      console.log('cap_year column already exists');
      return;
    }

    // Add the column
    await pool.query(`
      ALTER TABLE trade_assets
      ADD COLUMN cap_year INT DEFAULT 2026
      CHECK (cap_year >= 2026 AND cap_year <= 2030)
    `);

    console.log('✅ cap_year column added successfully');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

addCapYearColumn();
