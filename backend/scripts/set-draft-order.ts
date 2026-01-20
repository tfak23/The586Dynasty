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

// Rookie contract values by overall pick number
const ROOKIE_VALUES: Record<number, number> = {
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
  // Rounds 4-5 are all $1
  37: 1, 38: 1, 39: 1, 40: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1,
  49: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1, 58: 1, 59: 1, 60: 1,
};

// Owner nickname to Sleeper username mapping
const ownerNicknames: Record<string, string> = {
  'Dan': 'CanThePan',
  'Tony': 'TonyFF',
  'Dom': 'DomDuhBomb',
  'Nick': 'NickDnof',
  'Trevor': 'TrevorH42',
  'Jamie': 'Gazarato',
  'Karl': 'Klucido08',
  'Willy': 'bigwily57',
  'Trudy': 'miket1326',
  'Akshay': 'abhanot11',
  'Zach': 'zachg1313',
  'Brian': 'brcarnag',
};

// 2026 Draft Order (original draft position)
const draftOrder2026 = [
  'Dan', 'Tony', 'Dom', 'Nick', 'Trevor', 'Jamie',
  'Karl', 'Willy', 'Trudy', 'Akshay', 'Zach', 'Brian'
];

// 2026 Pick Allocations (who currently owns each pick)
// Format: [current_owner, original_owner] - if same, original owner still has it
const round1Allocations = [
  ['Dan', 'Dan'],           // 1.01
  ['Tony', 'Tony'],         // 1.02
  ['Dom', 'Dom'],           // 1.03
  ['Dom', 'Nick'],          // 1.04 - Nick's pick to Dom
  ['Dan', 'Trevor'],        // 1.05 - Trevor's pick to Dan
  ['Tony', 'Jamie'],        // 1.06 - Jamie's pick to Tony
  ['Karl', 'Karl'],         // 1.07
  ['Willy', 'Willy'],       // 1.08
  ['Dan', 'Trudy'],         // 1.09 - Trudy's pick to Dan
  ['Akshay', 'Akshay'],     // 1.10
  ['Tony', 'Zach'],         // 1.11 - Zach's pick to Tony
  ['Dom', 'Brian'],         // 1.12 - Brian's pick to Dom
];

const round2Allocations = [
  ['Nick', 'Dan'],          // 2.01 - Dan's pick to Nick
  ['Tony', 'Tony'],         // 2.02
  ['Brian', 'Dom'],         // 2.03 - Dom's pick to Brian
  ['Nick', 'Nick'],         // 2.04 - Assuming Vinny = Nick typo, keeping with Nick
  ['Nick', 'Trevor'],       // 2.05 - Trevor's pick to Nick
  ['Jamie', 'Jamie'],       // 2.06
  ['Karl', 'Karl'],         // 2.07
  ['Willy', 'Willy'],       // 2.08
  ['Willy', 'Trudy'],       // 2.09 - Trudy's pick to Willy
  ['Tony', 'Akshay'],       // 2.10 - Akshay's pick to Tony
  ['Tony', 'Zach'],         // 2.11 - Zach's pick to Tony
  ['Brian', 'Brian'],       // 2.12
];

const round3Allocations = [
  ['Dan', 'Dan'],           // 3.01
  ['Tony', 'Tony'],         // 3.02
  ['Dom', 'Dom'],           // 3.03
  ['Willy', 'Nick'],        // 3.04 - Nick's pick to Willy
  ['Trevor', 'Trevor'],     // 3.05
  ['Nick', 'Jamie'],        // 3.06 - Jamie's pick to Nick
  ['Karl', 'Karl'],         // 3.07
  ['Willy', 'Willy'],       // 3.08
  ['Trudy', 'Trudy'],       // 3.09
  ['Karl', 'Akshay'],       // 3.10 - Akshay's pick to Karl
  ['Dan', 'Zach'],          // 3.11 - Zach's pick to Dan
  ['Trevor', 'Brian'],      // 3.12 - Brian's pick to Trevor
];

// Rounds 4-5: Assume no trades, original owners keep picks
const round4Allocations = draftOrder2026.map(owner => [owner, owner]);
const round5Allocations = draftOrder2026.map(owner => [owner, owner]);

async function setDraftOrder() {
  console.log('Setting 2026 draft order and pick allocations...\n');

  // Get the league
  const leagues = await query("SELECT * FROM leagues LIMIT 1");
  if (leagues.length === 0) {
    console.error('No league found!');
    process.exit(1);
  }
  const league = leagues[0];
  console.log(`League: ${league.name} (${league.id})`);

  // Get all teams and create a map by owner_name
  const teams = await query("SELECT * FROM teams WHERE league_id = $1", [league.id]);
  const teamByOwner: Record<string, any> = {};
  teams.forEach((team: any) => {
    teamByOwner[team.owner_name] = team;
  });

  console.log(`Found ${teams.length} teams\n`);

  // Map nicknames to team IDs
  const getTeamId = (nickname: string): string | null => {
    const sleeperUsername = ownerNicknames[nickname];
    if (!sleeperUsername) {
      console.error(`Unknown nickname: ${nickname}`);
      return null;
    }
    const team = teamByOwner[sleeperUsername];
    if (!team) {
      console.error(`Team not found for: ${sleeperUsername}`);
      return null;
    }
    return team.id;
  };

  // Process all rounds
  const allAllocations = [
    { round: 1, allocations: round1Allocations },
    { round: 2, allocations: round2Allocations },
    { round: 3, allocations: round3Allocations },
    { round: 4, allocations: round4Allocations },
    { round: 5, allocations: round5Allocations },
  ];

  let updated = 0;
  let errors = 0;

  for (const { round, allocations } of allAllocations) {
    console.log(`\nProcessing Round ${round}...`);
    
    for (let i = 0; i < allocations.length; i++) {
      const [currentOwner, originalOwner] = allocations[i];
      const pickInRound = i + 1;
      const overallPick = (round - 1) * 12 + pickInRound;
      const pickValue = ROOKIE_VALUES[overallPick] || 1;
      
      const currentTeamId = getTeamId(currentOwner);
      const originalTeamId = getTeamId(originalOwner);
      
      if (!currentTeamId || !originalTeamId) {
        console.error(`  Skipping ${round}.${pickInRound.toString().padStart(2, '0')} - team not found`);
        errors++;
        continue;
      }

      // Find the existing pick by original_team_id, season, round
      const existingPick = await query(
        `SELECT id FROM draft_picks 
         WHERE league_id = $1 AND original_team_id = $2 AND season = $3 AND round = $4`,
        [league.id, originalTeamId, 2026, round]
      );

      if (existingPick.length === 0) {
        console.error(`  Pick not found: ${round}.${pickInRound.toString().padStart(2, '0')} (${originalOwner}'s pick)`);
        errors++;
        continue;
      }

      // Update the pick with pick_number and current_team_id
      await execute(
        `UPDATE draft_picks 
         SET pick_number = $1, current_team_id = $2
         WHERE id = $3`,
        [overallPick, currentTeamId, existingPick[0].id]
      );

      const tradedNote = currentOwner !== originalOwner ? ` (from ${originalOwner})` : '';
      console.log(`  ${round}.${pickInRound.toString().padStart(2, '0')} - $${pickValue} - ${currentOwner}${tradedNote}`);
      updated++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Picks updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  // Show pick distribution by team
  console.log('\n--- 2026 Picks by Team ---');
  const picksByTeam = await query(
    `SELECT t.team_name, t.owner_name, COUNT(*) as pick_count,
            STRING_AGG(
              CASE WHEN dp.round <= 2 
                THEN dp.round || '.' || LPAD(((dp.pick_number - 1) % 12 + 1)::text, 2, '0')
                ELSE dp.round || '.' || LPAD(((dp.pick_number - 1) % 12 + 1)::text, 2, '0')
              END, 
              ', ' ORDER BY dp.pick_number
            ) as picks
     FROM draft_picks dp
     JOIN teams t ON dp.current_team_id = t.id
     WHERE dp.season = 2026 AND dp.league_id = $1
     GROUP BY t.id, t.team_name, t.owner_name
     ORDER BY pick_count DESC`,
    [league.id]
  );

  for (const row of picksByTeam) {
    console.log(`  ${row.team_name} (${row.owner_name}): ${row.pick_count} picks`);
    console.log(`    ${row.picks}`);
  }

  process.exit(0);
}

setDraftOrder().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
