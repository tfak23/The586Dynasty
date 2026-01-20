// Script to sync players from Sleeper API to database
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

async function syncPlayers() {
  console.log('Fetching players from Sleeper API...');
  
  const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`);
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.status}`);
  }
  
  const players = await response.json() as Record<string, any>;
  console.log(`Fetched ${Object.keys(players).length} players from Sleeper`);
  
  const validPositions = ['QB', 'RB', 'WR', 'TE'];
  let synced = 0;
  let skipped = 0;
  
  const entries = Object.entries(players);
  
  for (const [sleeperId, player] of entries) {
    // Only sync relevant fantasy positions
    if (!validPositions.includes(player.position)) {
      skipped++;
      continue;
    }
    
    // Skip players without names
    if (!player.full_name || player.full_name.trim() === '') {
      skipped++;
      continue;
    }
    
    const searchFullName = player.full_name.toLowerCase().replace(/[^a-z\s]/g, '');
    const searchLastName = player.last_name?.toLowerCase().replace(/[^a-z\s]/g, '') || '';
    
    try {
      await pool.query(
        `INSERT INTO players (
          sleeper_player_id, full_name, first_name, last_name, position,
          team, age, years_exp, college, number, status,
          search_full_name, search_last_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (sleeper_player_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          position = EXCLUDED.position,
          team = EXCLUDED.team,
          age = EXCLUDED.age,
          years_exp = EXCLUDED.years_exp,
          college = EXCLUDED.college,
          number = EXCLUDED.number,
          status = EXCLUDED.status,
          search_full_name = EXCLUDED.search_full_name,
          search_last_name = EXCLUDED.search_last_name,
          updated_at = CURRENT_TIMESTAMP`,
        [
          sleeperId,
          player.full_name,
          player.first_name || '',
          player.last_name || '',
          player.position,
          player.team,
          player.age,
          player.years_exp || 0,
          player.college,
          player.number,
          player.status || 'Active',
          searchFullName,
          searchLastName
        ]
      );
      synced++;
      
      if (synced % 500 === 0) {
        console.log(`  Synced ${synced} players...`);
      }
    } catch (err) {
      console.error(`Error syncing player ${player.full_name}:`, err);
    }
  }
  
  console.log(`\n========== SYNC COMPLETE ==========`);
  console.log(`Total from API: ${entries.length}`);
  console.log(`Synced: ${synced}`);
  console.log(`Skipped: ${skipped}`);
  
  await pool.end();
}

syncPlayers().catch(console.error);
