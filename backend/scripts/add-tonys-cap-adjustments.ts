import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addTonysCapAdjustments() {
  try {
    // Get Tony's team ID and league ID
    const teamResult = await pool.query(`SELECT id, league_id FROM teams WHERE team_name = 'The Great Replacement'`);
    const tonyTeamId = teamResult.rows[0]?.id;
    const leagueId = teamResult.rows[0]?.league_id;
    
    if (!tonyTeamId || !leagueId) {
      console.error('Could not find Tony\'s team');
      return;
    }
    
    console.log('Tony team ID:', tonyTeamId);
    console.log('League ID:', leagueId);
    
    // Tony's cap adjustments from the provided data:
    // CAP HITS    2026  2027  2028  2029  2030
    // Amari Cooper   4     2
    // Trade 26.02   53
    // Tyler Lockett  2
    // Spencer Rattler 4     2
    
    const adjustments = [
      {
        type: 'player_cut',
        description: 'Amari Cooper - trade/release cap hit',
        playerName: 'Amari Cooper',
        amount_2026: 4,
        amount_2027: 2,
      },
      {
        type: 'trade_cap_hit',
        description: 'Trade 26.02 - DK Metcalf trade cap hit',
        playerName: 'DK Metcalf',
        amount_2026: 53,
      },
      {
        type: 'player_cut',
        description: 'Tyler Lockett - release cap hit',
        playerName: 'Tyler Lockett',
        amount_2026: 2,
      },
      {
        type: 'player_cut',
        description: 'Spencer Rattler - release cap hit',
        playerName: 'Spencer Rattler',
        amount_2026: 4,
        amount_2027: 2,
      },
    ];
    
    for (const adj of adjustments) {
      await pool.query(`
        INSERT INTO cap_adjustments (
          team_id, league_id, adjustment_type, description, player_name,
          amount_2026, amount_2027, amount_2028, amount_2029, amount_2030
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        tonyTeamId,
        leagueId,
        adj.type,
        adj.description,
        adj.playerName,
        adj.amount_2026 || 0,
        adj.amount_2027 || 0,
        adj.amount_2028 || 0,
        adj.amount_2029 || 0,
        adj.amount_2030 || 0,
      ]);
      console.log(`✅ Added: ${adj.description}`);
    }
    
    // Verify the additions
    const verifyResult = await pool.query(`
      SELECT description, player_name, 
             amount_2026, amount_2027, amount_2028
      FROM cap_adjustments 
      WHERE team_id = $1
      ORDER BY created_at
    `, [tonyTeamId]);
    
    console.log('\n📊 Tony\'s cap adjustments:');
    console.log('Description                                | 2026 | 2027 | 2028');
    console.log('-'.repeat(60));
    verifyResult.rows.forEach(r => {
      console.log(`${r.description.padEnd(42)} | $${r.amount_2026.toString().padStart(3)} | $${r.amount_2027.toString().padStart(3)} | $${r.amount_2028.toString().padStart(3)}`);
    });
    
    // Calculate totals
    const totalsResult = await pool.query(`
      SELECT 
        SUM(amount_2026) as total_2026,
        SUM(amount_2027) as total_2027,
        SUM(amount_2028) as total_2028
      FROM cap_adjustments 
      WHERE team_id = $1
    `, [tonyTeamId]);
    
    const totals = totalsResult.rows[0];
    console.log('-'.repeat(60));
    console.log(`${'TOTAL'.padEnd(42)} | $${totals.total_2026.toString().padStart(3)} | $${totals.total_2027.toString().padStart(3)} | $${totals.total_2028.toString().padStart(3)}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

addTonysCapAdjustments();
