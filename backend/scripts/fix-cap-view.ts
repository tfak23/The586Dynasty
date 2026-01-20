import { execute, query, pool } from '../src/db/index.js';

/**
 * Fix the team_cap_summary view to:
 * 1. Only count contracts valid for the current season
 * 2. Include cap_adjustments (dead money from trades/cuts)
 */
async function fixCapView() {
  console.log('🔧 Fixing team_cap_summary view...\n');

  try {
    // Drop and recreate the view
    await execute(`DROP VIEW IF EXISTS team_cap_summary CASCADE`);
    
    // Recreate with proper season filtering AND cap_adjustments
    await execute(`
      CREATE VIEW team_cap_summary AS
      SELECT 
          t.id as team_id,
          t.team_name,
          t.owner_name,
          l.salary_cap,
          l.current_season,
          COALESCE(contract_totals.total_salary, 0) as total_salary,
          l.salary_cap - COALESCE(contract_totals.total_salary, 0) - COALESCE(dm.dead_money, 0) - COALESCE(ca_totals.cap_adjustment, 0) as cap_room,
          COALESCE(contract_totals.active_contracts, 0) as active_contracts,
          COALESCE(contract_totals.total_contract_years, 0) as total_contract_years,
          COALESCE(dm.dead_money, 0) + COALESCE(ca_totals.cap_adjustment, 0) as dead_money
      FROM teams t
      JOIN leagues l ON t.league_id = l.id
      LEFT JOIN (
          SELECT 
              c.team_id,
              SUM(c.salary) as total_salary,
              COUNT(c.id) as active_contracts,
              SUM(c.years_remaining) as total_contract_years
          FROM contracts c
          JOIN teams t2 ON c.team_id = t2.id
          JOIN leagues l2 ON t2.league_id = l2.id
          WHERE c.status = 'active'
            AND c.start_season <= l2.current_season
            AND c.end_season >= l2.current_season
          GROUP BY c.team_id
      ) contract_totals ON contract_totals.team_id = t.id
      LEFT JOIN (
          SELECT team_id, season, SUM(amount) as dead_money
          FROM cap_transactions
          WHERE transaction_type = 'dead_money'
          GROUP BY team_id, season
      ) dm ON dm.team_id = t.id AND dm.season = l.current_season
      LEFT JOIN (
          SELECT 
              team_id,
              SUM(
                  CASE 
                      WHEN l.current_season = 2026 THEN amount_2026
                      WHEN l.current_season = 2027 THEN amount_2027
                      WHEN l.current_season = 2028 THEN amount_2028
                      WHEN l.current_season = 2029 THEN amount_2029
                      WHEN l.current_season = 2030 THEN amount_2030
                      ELSE 0
                  END
              ) as cap_adjustment
          FROM cap_adjustments ca
          JOIN teams t3 ON ca.team_id = t3.id
          JOIN leagues l ON t3.league_id = l.id
          GROUP BY ca.team_id, l.current_season
      ) ca_totals ON ca_totals.team_id = t.id
      GROUP BY t.id, t.team_name, t.owner_name, l.salary_cap, l.current_season, 
               contract_totals.total_salary, contract_totals.active_contracts, 
               contract_totals.total_contract_years, dm.dead_money, ca_totals.cap_adjustment
    `);

    console.log('✅ View updated successfully!\n');

    // Test the view
    const results = await query(`
      SELECT team_name, owner_name, total_salary, dead_money, cap_room, active_contracts 
      FROM team_cap_summary 
      ORDER BY cap_room DESC
    `);

    console.log('📊 Updated Cap Summary (with cap adjustments):');
    console.log('-------------------------------------------------------');
    results.forEach((row: any) => {
      const deadStr = parseFloat(row.dead_money) > 0 ? ` (dead: $${parseFloat(row.dead_money).toFixed(0)})` : '';
      console.log(`${row.owner_name}: $${parseFloat(row.total_salary).toFixed(0)} salary${deadStr}, $${parseFloat(row.cap_room).toFixed(0)} room (${row.active_contracts} contracts)`);
    });

  } catch (error) {
    console.error('❌ Error fixing view:', error);
  } finally {
    await pool.end();
  }
}

fixCapView();
