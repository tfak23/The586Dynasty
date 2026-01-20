import { execute, query, pool } from '../src/db/index.js';

/**
 * Comprehensive fix for salary cap calculations:
 * 1. Recreate team_cap_summary view with proper season filtering
 * 2. Include cap_adjustments table (trade dead money) in calculations
 * 3. Properly join all tables to avoid SQL errors
 */
async function fixCapCalculations() {
  console.log('🔧 Fixing salary cap calculations...\n');

  try {
    // Step 1: Drop existing view
    console.log('Step 1: Dropping existing view...');
    await execute(`DROP VIEW IF EXISTS team_cap_summary CASCADE`);
    console.log('  ✅ Dropped team_cap_summary view\n');

    // Step 2: Recreate view with proper logic
    console.log('Step 2: Creating fixed team_cap_summary view...');
    await execute(`
      CREATE VIEW team_cap_summary AS
      WITH contract_totals AS (
        -- Get contract totals filtered by current season
        SELECT
          c.team_id,
          t.league_id,
          SUM(c.salary) as total_salary,
          COUNT(c.id) as active_contracts,
          SUM(c.years_remaining) as total_contract_years
        FROM contracts c
        JOIN teams t ON c.team_id = t.id
        JOIN leagues l ON t.league_id = l.id
        WHERE c.status = 'active'
          AND c.start_season <= l.current_season
          AND c.end_season >= l.current_season
        GROUP BY c.team_id, t.league_id
      ),
      dead_money_totals AS (
        -- Get dead money from cap_transactions
        SELECT
          ct.team_id,
          t.league_id,
          l.current_season,
          SUM(ct.amount) as dead_money
        FROM cap_transactions ct
        JOIN teams t ON ct.team_id = t.id
        JOIN leagues l ON t.league_id = l.id
        WHERE ct.transaction_type = 'dead_money'
          AND ct.season = l.current_season
        GROUP BY ct.team_id, t.league_id, l.current_season
      ),
      cap_adjustment_totals AS (
        -- Get cap adjustments (trade dead money) for current season
        SELECT
          ca.team_id,
          t.league_id,
          l.current_season,
          SUM(
            CASE l.current_season
              WHEN 2026 THEN COALESCE(ca.amount_2026, 0)
              WHEN 2027 THEN COALESCE(ca.amount_2027, 0)
              WHEN 2028 THEN COALESCE(ca.amount_2028, 0)
              WHEN 2029 THEN COALESCE(ca.amount_2029, 0)
              WHEN 2030 THEN COALESCE(ca.amount_2030, 0)
              ELSE 0
            END
          ) as cap_adjustment
        FROM cap_adjustments ca
        JOIN teams t ON ca.team_id = t.id
        JOIN leagues l ON t.league_id = l.id
        GROUP BY ca.team_id, t.league_id, l.current_season
      )
      SELECT
        t.id as team_id,
        t.team_name,
        t.owner_name,
        l.salary_cap,
        l.current_season,
        COALESCE(ct.total_salary, 0) as total_salary,
        COALESCE(ct.active_contracts, 0)::int as active_contracts,
        COALESCE(ct.total_contract_years, 0) as total_contract_years,
        COALESCE(dm.dead_money, 0) as dead_money_releases,
        COALESCE(cat.cap_adjustment, 0) as dead_money_trades,
        COALESCE(dm.dead_money, 0) + COALESCE(cat.cap_adjustment, 0) as dead_money,
        l.salary_cap
          - COALESCE(ct.total_salary, 0)
          - COALESCE(dm.dead_money, 0)
          - COALESCE(cat.cap_adjustment, 0) as cap_room
      FROM teams t
      JOIN leagues l ON t.league_id = l.id
      LEFT JOIN contract_totals ct ON ct.team_id = t.id AND ct.league_id = l.id
      LEFT JOIN dead_money_totals dm ON dm.team_id = t.id AND dm.league_id = l.id
      LEFT JOIN cap_adjustment_totals cat ON cat.team_id = t.id AND cat.league_id = l.id
    `);
    console.log('  ✅ Created fixed team_cap_summary view\n');

    // Step 3: Verify the fix
    console.log('Step 3: Verifying cap calculations...');
    const results = await query(`
      SELECT
        team_name,
        owner_name,
        total_salary,
        dead_money_releases,
        dead_money_trades,
        dead_money,
        cap_room,
        active_contracts
      FROM team_cap_summary
      ORDER BY cap_room DESC
    `);

    console.log('\n📊 Updated Cap Summary:');
    console.log('─'.repeat(100));
    console.log(
      'Owner'.padEnd(15) +
      'Salary'.padStart(10) +
      'Dead(Rel)'.padStart(12) +
      'Dead(Trade)'.padStart(12) +
      'Total Dead'.padStart(12) +
      'Cap Room'.padStart(12) +
      'Contracts'.padStart(10)
    );
    console.log('─'.repeat(100));

    results.forEach((row: any) => {
      console.log(
        row.owner_name?.substring(0, 14).padEnd(15) +
        `$${parseFloat(row.total_salary).toFixed(0)}`.padStart(10) +
        `$${parseFloat(row.dead_money_releases).toFixed(0)}`.padStart(12) +
        `$${parseFloat(row.dead_money_trades).toFixed(0)}`.padStart(12) +
        `$${parseFloat(row.dead_money).toFixed(0)}`.padStart(12) +
        `$${parseFloat(row.cap_room).toFixed(0)}`.padStart(12) +
        row.active_contracts.toString().padStart(10)
      );
    });

    console.log('\n✅ Cap calculations fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing cap calculations:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixCapCalculations();
