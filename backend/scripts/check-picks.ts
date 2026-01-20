import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPicks() {
  try {
    // Check all 2026 round 2 picks
    const result = await pool.query(`
      SELECT dp.pick_number, dp.round, dp.season, t.team_name as current_team, t2.team_name as original_team
      FROM draft_picks dp 
      JOIN teams t ON dp.current_team_id = t.id 
      JOIN teams t2 ON dp.original_team_id = t2.id
      WHERE dp.season = 2026 AND dp.round = 2 
      ORDER BY dp.pick_number
    `);
    
    console.log('2026 Round 2 picks:');
    result.rows.forEach(r => {
      const pickInRound = ((r.pick_number - 1) % 12) + 1;
      console.log(`2.${pickInRound.toString().padStart(2, '0')} (pick ${r.pick_number}): ${r.current_team} ${r.current_team !== r.original_team ? `(via ${r.original_team})` : ''}`);
    });
    
    // Check 2027 round 2 picks
    const result2027 = await pool.query(`
      SELECT dp.round, dp.season, t.team_name as current_team, t2.team_name as original_team
      FROM draft_picks dp 
      JOIN teams t ON dp.current_team_id = t.id 
      JOIN teams t2 ON dp.original_team_id = t2.id
      WHERE dp.season = 2027 AND dp.round = 2 
      ORDER BY t2.team_name
    `);
    
    console.log('\n2027 Round 2 picks:');
    result2027.rows.forEach(r => {
      console.log(`${r.original_team}'s pick: owned by ${r.current_team}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkPicks();
