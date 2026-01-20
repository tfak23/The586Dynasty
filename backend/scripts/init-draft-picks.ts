import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function query(sql: string, params: any[] = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function execute(sql: string, params: any[] = []) {
  await pool.query(sql, params);
}

async function initDraftPicks() {
  console.log('Initializing draft picks for 2026, 2027, 2028...\n');

  // Get the league
  const leagues = await query("SELECT * FROM leagues LIMIT 1");
  if (leagues.length === 0) {
    console.error('No league found!');
    process.exit(1);
  }
  const league = leagues[0];
  console.log(`League: ${league.name} (${league.id})`);

  // Get all teams
  const teams = await query("SELECT * FROM teams WHERE league_id = $1 ORDER BY team_name", [league.id]);
  console.log(`Found ${teams.length} teams\n`);

  const seasons = [2026, 2027, 2028];
  const rounds = [1, 2, 3, 4, 5]; // 5 rounds of rookie draft

  let created = 0;
  let skipped = 0;

  for (const team of teams) {
    console.log(`Processing ${team.team_name}...`);
    
    for (const season of seasons) {
      for (const round of rounds) {
        // Check if pick already exists
        const existing = await query(
          `SELECT id FROM draft_picks 
           WHERE league_id = $1 AND original_team_id = $2 AND season = $3 AND round = $4`,
          [league.id, team.id, season, round]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Create the pick (original_team_id = current_team_id initially)
        await execute(
          `INSERT INTO draft_picks (league_id, season, round, original_team_id, current_team_id, is_used)
           VALUES ($1, $2, $3, $4, $4, false)`,
          [league.id, season, round, team.id]
        );
        created++;
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Draft picks created: ${created}`);
  console.log(`Already existed (skipped): ${skipped}`);
  console.log(`Total picks per team: ${seasons.length * rounds.length}`);
  console.log(`Total picks in system: ${teams.length * seasons.length * rounds.length}`);

  process.exit(0);
}

initDraftPicks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
