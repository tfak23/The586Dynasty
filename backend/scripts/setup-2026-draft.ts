import { execute, query, queryOne, pool } from '../src/db/index.js';

/**
 * Set up the 2026 rookie draft order and pick assignments
 * Based on the established draft order and trades
 */

// Map owner names to their database team info
const ownerMap: Record<string, string> = {
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

// Original draft order (determines original_team_id)
const draftOrder = ['Dan', 'Tony', 'Dom', 'Nick', 'Trevor', 'Jamie', 'Karl', 'Willy', 'Trudy', 'Akshay', 'Zach', 'Brian'];

// Round 1 picks after trades (pick 1-12) - who currently owns each pick
const round1Owners = [
  { pick: 1, owner: 'Dan', originalOwner: 'Dan' },
  { pick: 2, owner: 'Tony', originalOwner: 'Tony' },
  { pick: 3, owner: 'Dom', originalOwner: 'Dom' },
  { pick: 4, owner: 'Dom', originalOwner: 'Nick' },  // Via Nick
  { pick: 5, owner: 'Dan', originalOwner: 'Trevor' },  // Via Trevor
  { pick: 6, owner: 'Tony', originalOwner: 'Jamie' },  // Via Jamie
  { pick: 7, owner: 'Karl', originalOwner: 'Karl' },
  { pick: 8, owner: 'Willy', originalOwner: 'Willy' },
  { pick: 9, owner: 'Dan', originalOwner: 'Trudy' },  // Via Trudy
  { pick: 10, owner: 'Akshay', originalOwner: 'Akshay' },
  { pick: 11, owner: 'Tony', originalOwner: 'Zach' },  // Via Zach
  { pick: 12, owner: 'Dom', originalOwner: 'Brian' },  // Via Brian
];

// Round 2 picks after trades (pick 13-24)
const round2Owners = [
  { pick: 13, owner: 'Nick', originalOwner: 'Dan' },  // Via Dan
  { pick: 14, owner: 'Tony', originalOwner: 'Tony' },
  { pick: 15, owner: 'Brian', originalOwner: 'Dom' },  // Via Dom
  { pick: 16, owner: 'Tony', originalOwner: 'Nick' },  // Via Nick
  { pick: 17, owner: 'Nick', originalOwner: 'Trevor' },  // Via Trevor
  { pick: 18, owner: 'Jamie', originalOwner: 'Jamie' },
  { pick: 19, owner: 'Karl', originalOwner: 'Karl' },
  { pick: 20, owner: 'Willy', originalOwner: 'Willy' },
  { pick: 21, owner: 'Willy', originalOwner: 'Trudy' },  // Via Trudy
  { pick: 22, owner: 'Tony', originalOwner: 'Akshay' },  // Via Akshay
  { pick: 23, owner: 'Tony', originalOwner: 'Zach' },  // Via Zach
  { pick: 24, owner: 'Brian', originalOwner: 'Brian' },
];

// Round 3 picks after trades (pick 25-36)
const round3Owners = [
  { pick: 25, owner: 'Dan', originalOwner: 'Dan' },
  { pick: 26, owner: 'Tony', originalOwner: 'Tony' },
  { pick: 27, owner: 'Dom', originalOwner: 'Dom' },
  { pick: 28, owner: 'Willy', originalOwner: 'Nick' },  // Via Nick
  { pick: 29, owner: 'Trevor', originalOwner: 'Trevor' },
  { pick: 30, owner: 'Nick', originalOwner: 'Jamie' },  // Via Jamie
  { pick: 31, owner: 'Karl', originalOwner: 'Karl' },
  { pick: 32, owner: 'Willy', originalOwner: 'Willy' },
  { pick: 33, owner: 'Trudy', originalOwner: 'Trudy' },
  { pick: 34, owner: 'Karl', originalOwner: 'Akshay' },  // Via Akshay
  { pick: 35, owner: 'Dan', originalOwner: 'Zach' },  // Via Zach
  { pick: 36, owner: 'Trevor', originalOwner: 'Brian' },  // Via Brian
];

// Cap values by pick number
const pickCapValues: Record<number, number> = {
  // Round 1
  1: 45, 2: 38, 3: 32, 4: 27, 5: 23, 6: 19, 7: 16, 8: 14, 9: 13, 10: 12, 11: 11, 12: 10,
  // Round 2
  13: 9, 14: 9, 15: 9, 16: 8, 17: 8, 18: 8, 19: 7, 20: 7, 21: 6, 22: 6, 23: 5, 24: 5,
  // Round 3
  25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1,
};

async function setup2026Draft() {
  console.log('🏈 Setting up 2026 Rookie Draft...\n');

  try {
    // Get league ID
    const league = await queryOne('SELECT id FROM leagues WHERE name = $1', ['The 586']);
    if (!league) {
      throw new Error('League not found');
    }
    const leagueId = league.id;
    console.log(`✅ Found league: ${leagueId}\n`);

    // Get all teams
    const teams = await query('SELECT id, owner_name FROM teams WHERE league_id = $1', [leagueId]);
    const teamByOwner: Record<string, string> = {};
    teams.forEach((t: any) => {
      teamByOwner[t.owner_name] = t.id;
    });

    console.log('📋 Team mappings:');
    Object.entries(ownerMap).forEach(([shortName, ownerName]) => {
      const teamId = teamByOwner[ownerName];
      console.log(`   ${shortName} => ${ownerName} => ${teamId ? '✅' : '❌ NOT FOUND'}`);
    });
    console.log('');

    // Delete existing 2026 picks to start fresh
    const deleted = await execute(
      'DELETE FROM draft_picks WHERE league_id = $1 AND season = 2026',
      [leagueId]
    );
    console.log(`🗑️  Cleared existing 2026 picks\n`);

    // Insert all picks
    const allPicks = [...round1Owners, ...round2Owners, ...round3Owners];
    
    console.log('📝 Inserting 2026 draft picks...\n');
    
    for (const pick of allPicks) {
      const round = pick.pick <= 12 ? 1 : (pick.pick <= 24 ? 2 : 3);
      const currentOwnerName = ownerMap[pick.owner];
      const originalOwnerName = ownerMap[pick.originalOwner];
      
      const currentTeamId = teamByOwner[currentOwnerName];
      const originalTeamId = teamByOwner[originalOwnerName];
      
      if (!currentTeamId || !originalTeamId) {
        console.log(`❌ Pick ${pick.pick}: Could not find team IDs`);
        continue;
      }

      await execute(
        `INSERT INTO draft_picks (
          league_id, season, round, pick_number, 
          original_team_id, current_team_id, is_used
        ) VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [leagueId, 2026, round, pick.pick, originalTeamId, currentTeamId]
      );

      const capValue = pickCapValues[pick.pick];
      const viaText = pick.owner !== pick.originalOwner ? ` (via ${pick.originalOwner})` : '';
      console.log(`   Pick ${pick.pick.toString().padStart(2, '0')} (Rd ${round}): ${pick.owner}${viaText} - $${capValue}`);
    }

    console.log('\n✅ 2026 Draft picks created!\n');

    // Summary by team
    console.log('📊 Pick Summary by Team:\n');
    
    const summaryQuery = `
      SELECT 
        t.owner_name,
        COUNT(*) as total_picks,
        SUM(CASE WHEN dp.round = 1 THEN 1 ELSE 0 END) as r1_picks,
        SUM(CASE WHEN dp.round = 2 THEN 1 ELSE 0 END) as r2_picks,
        SUM(CASE WHEN dp.round = 3 THEN 1 ELSE 0 END) as r3_picks
      FROM draft_picks dp
      JOIN teams t ON dp.current_team_id = t.id
      WHERE dp.league_id = $1 AND dp.season = 2026
      GROUP BY t.owner_name
      ORDER BY total_picks DESC
    `;
    
    const summary = await query(summaryQuery, [leagueId]);
    
    summary.forEach((row: any) => {
      console.log(`   ${row.owner_name}: ${row.total_picks} picks (R1: ${row.r1_picks}, R2: ${row.r2_picks}, R3: ${row.r3_picks})`);
    });

    // Calculate cap hits by team
    console.log('\n💰 Cap Hit by Team (2026 picks):\n');
    
    const capQuery = `
      SELECT 
        t.owner_name,
        dp.pick_number,
        dp.round
      FROM draft_picks dp
      JOIN teams t ON dp.current_team_id = t.id
      WHERE dp.league_id = $1 AND dp.season = 2026
      ORDER BY t.owner_name, dp.pick_number
    `;
    
    const picksByTeam = await query(capQuery, [leagueId]);
    
    // Group by team
    const teamCaps: Record<string, { picks: number[], total: number }> = {};
    picksByTeam.forEach((row: any) => {
      if (!teamCaps[row.owner_name]) {
        teamCaps[row.owner_name] = { picks: [], total: 0 };
      }
      const capValue = pickCapValues[row.pick_number];
      teamCaps[row.owner_name].picks.push(row.pick_number);
      teamCaps[row.owner_name].total += capValue;
    });
    
    // Sort by total cap hit
    const sortedTeams = Object.entries(teamCaps).sort((a, b) => b[1].total - a[1].total);
    
    sortedTeams.forEach(([owner, data]) => {
      console.log(`   ${owner}: $${data.total} (picks: ${data.picks.join(', ')})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

setup2026Draft();
