import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixTonysPicks() {
  try {
    // Get team IDs
    const tonyResult = await pool.query(`SELECT id FROM teams WHERE team_name = 'The Great Replacement'`);
    const danResult = await pool.query(`SELECT id FROM teams WHERE team_name = 'Danny Dimes Era'`);
    
    const tonyTeamId = tonyResult.rows[0]?.id;
    const danTeamId = danResult.rows[0]?.id;
    
    if (!tonyTeamId || !danTeamId) {
      console.error('Could not find team IDs');
      return;
    }
    
    console.log('Tony team ID:', tonyTeamId);
    console.log('Dan team ID:', danTeamId);
    
    // Trade 26.02: Tony gets Dan's 2027 2nd round pick
    const updateResult = await pool.query(`
      UPDATE draft_picks 
      SET current_team_id = $1, updated_at = NOW()
      WHERE original_team_id = $2 
        AND season = 2027 
        AND round = 2
      RETURNING *
    `, [tonyTeamId, danTeamId]);
    
    if (updateResult.rowCount && updateResult.rowCount > 0) {
      console.log('✅ Updated: Dan\'s 2027 2nd round pick now belongs to Tony');
    } else {
      console.log('❌ No picks updated - pick may already be transferred or not exist');
    }
    
    // Verify the change
    const verifyResult = await pool.query(`
      SELECT dp.season, dp.round, t.team_name as current_team, t2.team_name as original_team
      FROM draft_picks dp 
      JOIN teams t ON dp.current_team_id = t.id 
      JOIN teams t2 ON dp.original_team_id = t2.id
      WHERE dp.original_team_id = $1 AND dp.season = 2027 AND dp.round = 2
    `, [danTeamId]);
    
    console.log('\nVerification - Dan\'s 2027 2nd:');
    console.log(verifyResult.rows[0]);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixTonysPicks();
