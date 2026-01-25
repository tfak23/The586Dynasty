/**
 * Import League History from The 586 Dynasty CSV
 * 
 * This script parses the CSV file and imports owner statistics into the database
 */

import { pool, query, execute } from '../src/db/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Data extracted from "The 586 Dynasty - The 586 Dynasty.csv"
const ownerData = [
  {
    owner_name: 'Brian',
    phone: '586-808-2234',
    titles: 1,
    sb_appearances: 1,
    division_titles: 2,
    playoff_appearances: 2,
    total_winnings: 1400,
    net_winnings: 800,
    total_wins: 24,
    total_losses: 18,
    total_ties: 0,
    total_points: 4984.55,
    legacy_score: 259.2,
    is_active: true,
    season_records: [
      { season: 2023, wins: 3, losses: 11, ties: 0, points: 1156.35, placing: 11, playoffs: false },
      { season: 2024, wins: 10, losses: 4, ties: 0, points: 1961.55, placing: 3, playoffs: true },
      { season: 2025, wins: 11, losses: 3, ties: 0, points: 1866.65, placing: 1, playoffs: true, title: true }
    ]
  },
  {
    owner_name: 'Jamie',
    phone: '231-330-5507',
    titles: 1,
    sb_appearances: 1,
    division_titles: 0,
    playoff_appearances: 2,
    total_winnings: 1200,
    net_winnings: 600,
    total_wins: 22,
    total_losses: 20,
    total_ties: 0,
    total_points: 5569.85,
    legacy_score: 252.6,
    is_active: true,
    season_records: [
      { season: 2023, wins: 7, losses: 7, ties: 0, points: 1945.80, placing: 1, playoffs: true, title: true },
      { season: 2024, wins: 7, losses: 7, ties: 0, points: 1906.20, placing: 4, playoffs: true },
      { season: 2025, wins: 8, losses: 6, ties: 0, points: 1717.85, placing: 7, playoffs: false }
    ]
  },
  {
    owner_name: 'Dom',
    phone: '586-549-0149',
    titles: 0,
    sb_appearances: 1,
    division_titles: 0,
    playoff_appearances: 1,
    total_winnings: 900,
    net_winnings: 300,
    total_wins: 14,
    total_losses: 28,
    total_ties: 0,
    total_points: 4714.05,
    legacy_score: 157.3,
    is_active: true,
    season_records: [
      { season: 2023, wins: 2, losses: 12, ties: 0, points: 1255.80, placing: 12, playoffs: false },
      { season: 2024, wins: 8, losses: 6, ties: 0, points: 1834.15, placing: 2, playoffs: true },
      { season: 2025, wins: 4, losses: 10, ties: 0, points: 1624.10, placing: 10, playoffs: false }
    ]
  },
  {
    owner_name: 'Nick',
    phone: '586-243-3178',
    titles: 0,
    sb_appearances: 0,
    division_titles: 0,
    playoff_appearances: 1,
    total_winnings: 0,
    net_winnings: -600,
    total_wins: 16,
    total_losses: 26,
    total_ties: 0,
    total_points: 4939.35,
    legacy_score: 136.1,
    is_active: true,
    season_records: [
      { season: 2023, wins: 7, losses: 7, ties: 0, points: 1686.00, placing: 6, playoffs: true },
      { season: 2024, wins: 5, losses: 9, ties: 0, points: 1686.85, placing: 7, playoffs: false },
      { season: 2025, wins: 4, losses: 10, ties: 0, points: 1566.50, placing: 9, playoffs: false }
    ]
  },
  {
    owner_name: 'Dan',
    phone: '248-891-4058',
    titles: 0,
    sb_appearances: 0,
    division_titles: 1,
    playoff_appearances: 1,
    total_winnings: 100,
    net_winnings: -500,
    total_wins: 17,
    total_losses: 25,
    total_ties: 0,
    total_points: 5066.20,
    legacy_score: 147.5,
    is_active: true,
    season_records: [
      { season: 2023, wins: 6, losses: 8, ties: 0, points: 1789.10, placing: 7, playoffs: false },
      { season: 2024, wins: 8, losses: 6, ties: 0, points: 1862.00, placing: 4, playoffs: true, division: true },
      { season: 2025, wins: 3, losses: 11, ties: 0, points: 1415.10, placing: 12, playoffs: false }
    ]
  },
  {
    owner_name: 'Zach',
    phone: '586-838-7883',
    titles: 0,
    sb_appearances: 1,
    division_titles: 0,
    playoff_appearances: 1,
    total_winnings: 800,
    net_winnings: 700,
    total_wins: 9,
    total_losses: 5,
    total_ties: 0,
    total_points: 1789.15,
    legacy_score: 91.8,
    is_active: true,
    season_records: [
      { season: 2025, wins: 9, losses: 5, ties: 0, points: 1789.15, placing: 2, playoffs: true }
    ]
  },
  {
    owner_name: 'Akshay',
    phone: '586-260-8396',
    titles: 0,
    sb_appearances: 0,
    division_titles: 1,
    playoff_appearances: 1,
    total_winnings: 50,
    net_winnings: -350,
    total_wins: 26,
    total_losses: 16,
    total_ties: 0,
    total_points: 5007.50,
    legacy_score: 182.3,
    is_active: true,
    season_records: [
      { season: 2023, wins: 12, losses: 2, ties: 0, points: 1752.50, placing: 4, playoffs: true, division: true },
      { season: 2024, wins: 6, losses: 8, ties: 0, points: 1496.05, placing: 11, playoffs: false },
      { season: 2025, wins: 8, losses: 6, ties: 0, points: 1758.95, placing: 3, playoffs: true }
    ]
  },
  {
    owner_name: 'Karl',
    phone: '586-246-0289',
    titles: 0,
    sb_appearances: 0,
    division_titles: 1,
    playoff_appearances: 1,
    total_winnings: 100,
    net_winnings: 0,
    total_wins: 9,
    total_losses: 5,
    total_ties: 0,
    total_points: 1769.65,
    legacy_score: 60.6,
    is_active: true,
    season_records: [
      { season: 2025, wins: 9, losses: 5, ties: 0, points: 1769.65, placing: 6, playoffs: true, division: true }
    ]
  },
  {
    owner_name: 'Tony',
    phone: '586-713-3079',
    titles: 0,
    sb_appearances: 0,
    division_titles: 0,
    playoff_appearances: 0,
    total_winnings: 0,
    net_winnings: 0,
    total_wins: 0,
    total_losses: 0,
    total_ties: 0,
    total_points: 0,
    legacy_score: 0,
    is_active: true,
    season_records: []
  },
  {
    owner_name: 'Willy',
    phone: '231-330-9342',
    titles: 0,
    sb_appearances: 0,
    division_titles: 0,
    playoff_appearances: 1,
    total_winnings: 0,
    net_winnings: -400,
    total_wins: 21,
    total_losses: 21,
    total_ties: 0,
    total_points: 4952.15,
    legacy_score: 145.3,
    is_active: true,
    season_records: [
      { season: 2023, wins: 6, losses: 8, ties: 0, points: 1609.75, placing: 9, playoffs: false },
      { season: 2024, wins: 6, losses: 8, ties: 0, points: 1658.50, placing: 9, playoffs: false },
      { season: 2025, wins: 9, losses: 5, ties: 0, points: 1683.90, placing: 5, playoffs: true }
    ]
  },
  {
    owner_name: 'Trudy',
    phone: '586-306-5786',
    titles: 0,
    sb_appearances: 0,
    division_titles: 2,
    playoff_appearances: 3,
    total_winnings: 600,
    net_winnings: 0,
    total_wins: 30,
    total_losses: 12,
    total_ties: 0,
    total_points: 5841.50,
    legacy_score: 218.5,
    is_active: true,
    season_records: [
      { season: 2023, wins: 12, losses: 2, ties: 0, points: 1935.45, placing: 3, playoffs: true, division: true },
      { season: 2024, wins: 8, losses: 6, ties: 0, points: 1922.40, placing: 5, playoffs: true },
      { season: 2025, wins: 10, losses: 4, ties: 0, points: 1983.65, placing: 4, playoffs: true, division: true }
    ]
  },
  {
    owner_name: 'Trevor',
    phone: '906-259-3039',
    titles: 0,
    sb_appearances: 1,
    division_titles: 1,
    playoff_appearances: 1,
    total_winnings: 750,
    net_winnings: 150,
    total_wins: 20,
    total_losses: 22,
    total_ties: 0,
    total_points: 5315.05,
    legacy_score: 185.1,
    is_active: true,
    season_records: [
      { season: 2023, wins: 10, losses: 4, ties: 0, points: 1959.60, placing: 2, playoffs: true, division: true },
      { season: 2024, wins: 3, losses: 11, ties: 0, points: 1609.40, placing: 8, playoffs: false },
      { season: 2025, wins: 7, losses: 7, ties: 0, points: 1746.05, placing: 8, playoffs: false }
    ]
  },
  // Former/Legacy Owners
  {
    owner_name: 'Mike',
    phone: null,
    titles: 0,
    sb_appearances: 0,
    division_titles: 0,
    playoff_appearances: 1,
    total_winnings: 0,
    net_winnings: -400,
    total_wins: 16,
    total_losses: 12,
    total_ties: 0,
    total_points: 3535.10,
    legacy_score: 0,
    is_active: false,
    season_records: [
      { season: 2023, wins: 9, losses: 5, ties: 0, points: 1795.35, placing: 5, playoffs: true },
      { season: 2024, wins: 7, losses: 7, ties: 0, points: 1739.75, placing: 10, playoffs: false }
    ]
  },
  {
    owner_name: 'Elliot',
    phone: null,
    titles: 0,
    sb_appearances: 0,
    division_titles: 0,
    playoff_appearances: 0,
    total_winnings: 0,
    net_winnings: -400,
    total_wins: 10,
    total_losses: 18,
    total_ties: 0,
    total_points: 2677.25,
    legacy_score: 0,
    is_active: false,
    season_records: [
      { season: 2023, wins: 4, losses: 10, ties: 0, points: 1215.30, placing: 10, playoffs: false },
      { season: 2024, wins: 6, losses: 8, ties: 0, points: 1461.95, placing: 12, playoffs: false }
    ]
  },
  {
    owner_name: 'Vinny',
    phone: null,
    titles: 1,
    sb_appearances: 1,
    division_titles: 1,
    playoff_appearances: 1,
    total_winnings: 1000,
    net_winnings: -600,
    total_wins: 18,
    total_losses: 24,
    total_ties: 0,
    total_points: 5000.05,
    legacy_score: 0,
    is_active: false,
    season_records: [
      { season: 2023, wins: 6, losses: 8, ties: 0, points: 1761.75, placing: 8, playoffs: false },
      { season: 2024, wins: 10, losses: 4, ties: 0, points: 2041.85, placing: 1, playoffs: true, title: true, division: true },
      { season: 2025, wins: 2, losses: 12, ties: 0, points: 1196.45, placing: 11, playoffs: false }
    ]
  }
];

// Playoff results by year
const playoffResults = {
  2023: {
    wildcard: [
      { matchup: 'Mike (4) vs Jamie (5)', winner: 'Jamie' },
      { matchup: 'Nick (6) vs Trevor (3)', winner: 'Trevor' }
    ],
    semis: [
      { matchup: 'Akshay (2) vs Trevor', winner: 'Trevor' },
      { matchup: 'Trudy (1) vs Jamie', winner: 'Jamie' }
    ],
    thirdPlace: { matchup: 'Trudy over Akshay', winner: 'Trudy' },
    championship: { matchup: 'Jamie over Trevor', winner: 'Jamie' }
  },
  2024: {
    wildcard: [
      { matchup: 'Dan (4) vs Jamie (6)', winner: 'Jamie' },
      { matchup: 'Trudy (3) vs Dom (5)', winner: 'Dom' }
    ],
    semis: [
      { matchup: 'Vinny (1) over Jamie', winner: 'Vinny' },
      { matchup: 'Dom over Brian (2)', winner: 'Dom' }
    ],
    thirdPlace: { matchup: 'Brian over Jamie', winner: 'Brian' },
    championship: { matchup: 'Vinny over Dom', winner: 'Vinny' }
  },
  2025: {
    wildcard: [
      { matchup: 'Karl (3) vs Akshay (6)', winner: 'Akshay' },
      { matchup: 'Zach/Tony (4) vs Willy (5)', winner: 'Zach/Tony' }
    ],
    semis: [
      { matchup: 'Brian (1) vs Akshay', winner: 'Brian' },
      { matchup: 'Trudy (2) vs Zach/Tony', winner: 'Zach/Tony' }
    ],
    thirdPlace: { matchup: 'Akshay over Trudy', winner: 'Akshay' },
    championship: { matchup: 'Brian over Zach/Tony', winner: 'Brian' }
  }
};

async function importLeagueHistory() {
  console.log('🏈 Starting League History Import...\n');

  try {
    // Get the league ID for The 586 Dynasty
    const leagues = await query<{ id: string; name: string }>(
      `SELECT id, name FROM leagues WHERE sleeper_league_id = $1`,
      ['1315789488873553920']
    );

    if (leagues.length === 0) {
      console.error('❌ League not found! Please initialize the league first.');
      console.log('   Run: POST /api/sync/initialize with { sleeper_league_id: "1315789488873553920" }');
      process.exit(1);
    }

    const leagueId = leagues[0].id;
    console.log(`✅ Found league: ${leagues[0].name} (${leagueId})\n`);

    // Calculate buy-in for each owner (3 seasons * $200 = $600 per active owner, less for new owners)
    const buyInPerSeason = 200;

    // Import each owner
    for (const owner of ownerData) {
      const seasonsPlayed = owner.season_records.length;
      const totalBuyIns = seasonsPlayed * buyInPerSeason;
      
      // Calculate win percentage
      const totalGames = owner.total_wins + owner.total_losses + owner.total_ties;
      const winPercentage = totalGames > 0 ? owner.total_wins / totalGames : 0;

      console.log(`📊 Importing ${owner.owner_name}...`);
      console.log(`   Record: ${owner.total_wins}-${owner.total_losses}-${owner.total_ties} (${(winPercentage * 100).toFixed(1)}%)`);
      console.log(`   Legacy Score: ${owner.legacy_score}`);
      console.log(`   Titles: ${owner.titles}, SB Apps: ${owner.sb_appearances}`);

      await query(
        `INSERT INTO league_history (
          league_id, owner_name, phone, titles, sb_appearances, 
          division_titles, playoff_appearances, total_winnings, total_buy_ins,
          net_winnings, total_wins, total_losses, total_ties, total_points,
          win_percentage, legacy_score, season_records, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (league_id, owner_name) 
        DO UPDATE SET
          phone = EXCLUDED.phone,
          titles = EXCLUDED.titles,
          sb_appearances = EXCLUDED.sb_appearances,
          division_titles = EXCLUDED.division_titles,
          playoff_appearances = EXCLUDED.playoff_appearances,
          total_winnings = EXCLUDED.total_winnings,
          total_buy_ins = EXCLUDED.total_buy_ins,
          net_winnings = EXCLUDED.net_winnings,
          total_wins = EXCLUDED.total_wins,
          total_losses = EXCLUDED.total_losses,
          total_ties = EXCLUDED.total_ties,
          total_points = EXCLUDED.total_points,
          win_percentage = EXCLUDED.win_percentage,
          legacy_score = EXCLUDED.legacy_score,
          season_records = EXCLUDED.season_records,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP`,
        [
          leagueId,
          owner.owner_name,
          owner.phone,
          owner.titles,
          owner.sb_appearances,
          owner.division_titles,
          owner.playoff_appearances,
          owner.total_winnings,
          totalBuyIns,
          owner.net_winnings,
          owner.total_wins,
          owner.total_losses,
          owner.total_ties,
          owner.total_points,
          winPercentage,
          owner.legacy_score,
          JSON.stringify(owner.season_records),
          owner.is_active
        ]
      );
      console.log(`   ✅ Done\n`);
    }

    // Print summary
    const historyCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM league_history WHERE league_id = $1`,
      [leagueId]
    );
    
    const activeCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM league_history WHERE league_id = $1 AND is_active = true`,
      [leagueId]
    );

    console.log('═══════════════════════════════════════════');
    console.log('✅ LEAGUE HISTORY IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════');
    console.log(`   Total owners imported: ${historyCount[0].count}`);
    console.log(`   Active owners: ${activeCount[0].count}`);
    console.log(`   Inactive/Former: ${parseInt(historyCount[0].count) - parseInt(activeCount[0].count)}`);
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the import
importLeagueHistory();
