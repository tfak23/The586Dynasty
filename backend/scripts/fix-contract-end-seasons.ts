import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixContractEndSeasons() {
  try {
    console.log('🔧 Fixing contract end_season values...\n');

    // Get all active contracts
    const contracts = await pool.query(`
      SELECT id, salary, years_total, years_remaining, start_season, end_season
      FROM contracts
      WHERE status = 'active'
    `);

    console.log(`Found ${contracts.rows.length} active contracts\n`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const contract of contracts.rows) {
      // Calculate what end_season should be
      // end_season = start_season + years_total - 1
      const expectedEndSeason = contract.start_season + contract.years_total - 1;

      if (contract.end_season !== expectedEndSeason) {
        console.log(`Contract ${contract.id}:`);
        console.log(`  Current: start=${contract.start_season}, years_total=${contract.years_total}, end=${contract.end_season}`);
        console.log(`  Expected end_season: ${expectedEndSeason}`);

        // Fix it
        await pool.query(
          `UPDATE contracts SET end_season = $1 WHERE id = $2`,
          [expectedEndSeason, contract.id]
        );
        console.log(`  ✅ Fixed!\n`);
        fixed++;
      } else {
        alreadyCorrect++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Already correct: ${alreadyCorrect}`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Total: ${contracts.rows.length}`);

    // Now verify by checking projection data
    console.log('\n📈 Verifying cap projections...');
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      const result = await pool.query(`
        SELECT COUNT(*) as contract_count, COALESCE(SUM(salary), 0) as total_salary
        FROM contracts
        WHERE status = 'active'
          AND start_season <= $1
          AND end_season >= $1
      `, [year]);

      console.log(`  ${year}: ${result.rows[0].contract_count} contracts, $${parseFloat(result.rows[0].total_salary).toFixed(2)} total`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixContractEndSeasons();
