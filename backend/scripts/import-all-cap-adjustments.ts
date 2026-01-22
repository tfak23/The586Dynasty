import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Cap adjustment data by owner name (Sleeper usernames)
// HITS are positive (charge cap), CREDITS are negative (give cap back)
const capAdjustmentsData: Record<string, {
  hits: Array<{ description: string; amount_2026: number; amount_2027: number }>;
  credits: Array<{ description: string; amount_2026: number; amount_2027: number }>;
}> = {
  // Akshay (abhanot11 - Healthcare Hero)
  'abhanot11': {
    hits: [
      { description: 'Dameon Pierce cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Rico Dowdle cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Dameon Pierce (2nd entry)', amount_2026: 7, amount_2027: 0 },
      { description: 'Gabe Davis cut', amount_2026: 3, amount_2027: 0 },
    ],
    credits: [],
  },

  // Brian (brcarnag - Trust the Process)
  'brcarnag': {
    hits: [
      { description: 'Trade 25.19', amount_2026: 10, amount_2027: 0 },
      { description: 'Trade 25.23', amount_2026: 10, amount_2027: 0 },
      { description: 'Kendre Miller cut', amount_2026: 2, amount_2027: 1 },
    ],
    credits: [
      { description: 'Trade 24.25 (credit)', amount_2026: 12, amount_2027: 0 },
    ],
  },

  // Dan (CanThePan - Lamborghini Love)
  'CanThePan': {
    hits: [
      { description: 'Trade 24.25', amount_2026: 12, amount_2027: 0 },
      { description: 'Javonte Williams cut', amount_2026: 12, amount_2027: 5 },
      { description: 'Devin Singletary cut', amount_2026: 5, amount_2027: 0 },
      { description: 'Trevor Lawrence trade', amount_2026: 12, amount_2027: 5 },
      { description: 'Devontez Walker cut', amount_2026: 1, amount_2027: 0 },
    ],
    credits: [
      { description: 'Trade 26.02 (credit)', amount_2026: 53, amount_2027: 0 },
      { description: 'Trade 25.17 (credit)', amount_2026: 9, amount_2027: 0 },
      { description: 'Trade 25.23 (credit)', amount_2026: 10, amount_2027: 0 },
    ],
  },

  // Dom (DomDuhBomb - Mazda Marv)
  'DomDuhBomb': {
    hits: [
      { description: 'Darren Waller cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Kadarius Toney cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Isiah Pacheco trade', amount_2026: 7, amount_2027: 3 },
    ],
    credits: [
      { description: 'Trade 25.19 (credit)', amount_2026: 10, amount_2027: 0 },
    ],
  },

  // Jamie (Gazarato - CeeDeeC guidelines)
  'Gazarato': {
    hits: [
      { description: 'Kenny Pickett cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Jermaine Burton cut', amount_2026: 3, amount_2027: 0 },
      { description: 'Dontayvion Wicks cut', amount_2026: 4, amount_2027: 0 },
      { description: 'Trade 25.03', amount_2026: 15, amount_2027: 0 },
      { description: 'Brenden Rice cut', amount_2026: 1, amount_2027: 0 },
    ],
    credits: [],
  },

  // Karl (Klucido08 - Jeanty juice)
  'Klucido08': {
    hits: [
      { description: 'Audric Estime cut', amount_2026: 1, amount_2027: 0 },
      { description: 'Jaylen Wright cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Javon Baker cut', amount_2026: 1, amount_2027: 0 },
    ],
    credits: [],
  },

  // Nick (NickDnof - Danny Dimes Era)
  'NickDnof': {
    hits: [
      { description: 'Pat Freiermuth trade', amount_2026: 5, amount_2027: 2 },
      { description: 'Jahan Dotson trade', amount_2026: 3, amount_2027: 0 },
      { description: 'Tyreek Hill trade', amount_2026: 10, amount_2027: 0 },
      { description: 'Jaylin Hyatt cut', amount_2026: 1, amount_2027: 0 },
      { description: 'Anthony Richardson trade', amount_2026: 7, amount_2027: 3 },
    ],
    credits: [
      { description: 'Trade 25.03 (credit)', amount_2026: 15, amount_2027: 0 },
    ],
  },

  // Tony (TonyFF - The Great Replacement)
  'TonyFF': {
    hits: [
      { description: 'Amari Cooper cut', amount_2026: 4, amount_2027: 2 },
      { description: 'Trade 26.02', amount_2026: 53, amount_2027: 0 },
      { description: 'Tyler Lockett cut', amount_2026: 2, amount_2027: 0 },
      { description: 'Spencer Rattler cut', amount_2026: 4, amount_2027: 2 },
    ],
    credits: [],
  },

  // Trudy (TrevorH42 - Davante's Inferno)
  'TrevorH42': {
    hits: [
      { description: 'Quentin Johnston trade', amount_2026: 6, amount_2027: 3 },
      { description: 'Trade 25.25', amount_2026: 8, amount_2027: 0 },
      { description: 'Trade 25.17', amount_2026: 9, amount_2027: 0 },
      { description: 'Trevor Etienne cut', amount_2026: 1, amount_2027: 0 },
    ],
    credits: [],
  },

  // Willy (bigwily57 - Teta tots)
  'bigwily57': {
    hits: [
      { description: 'Hendon Hooker cut', amount_2026: 4, amount_2027: 2 },
    ],
    credits: [
      { description: 'Trade 25.25 (credit)', amount_2026: 8, amount_2027: 0 },
    ],
  },

  // Zach (zachg1313 - J Jet2Holiday)
  'zachg1313': {
    hits: [
      { description: 'Ben Sinnott trade', amount_2026: 3, amount_2027: 2 },
      { description: 'Jahan Dotson trade', amount_2026: 2, amount_2027: 0 },
      { description: 'Justin Fields trade', amount_2026: 12, amount_2027: 0 },
    ],
    credits: [],
  },

  // Mike (miket1326 - Bed, Bath & Bijan)
  'miket1326': {
    hits: [],
    credits: [],
  },
};

async function importAllCapAdjustments() {
  try {
    console.log('🚀 Starting cap adjustments import...\n');

    // Get league ID (assuming there's only one league)
    const leagueResult = await pool.query(`SELECT id FROM leagues LIMIT 1`);
    const leagueId = leagueResult.rows[0]?.id;

    if (!leagueId) {
      console.error('❌ Could not find league');
      return;
    }

    console.log(`📍 League ID: ${leagueId}\n`);

    // First, clear existing cap_adjustments (optional - comment out if you want to keep existing)
    const clearResult = await pool.query(`DELETE FROM cap_adjustments WHERE league_id = $1`, [leagueId]);
    console.log(`🗑️  Cleared ${clearResult.rowCount} existing cap adjustments\n`);

    let totalAdded = 0;

    for (const [ownerName, data] of Object.entries(capAdjustmentsData)) {
      // Find team by owner name (case-insensitive)
      const teamResult = await pool.query(
        `SELECT id, team_name FROM teams WHERE LOWER(owner_name) = LOWER($1) AND league_id = $2`,
        [ownerName, leagueId]
      );

      if (teamResult.rows.length === 0) {
        console.error(`❌ Could not find team for owner: ${ownerName}`);
        continue;
      }

      const teamId = teamResult.rows[0].id;
      const teamName = teamResult.rows[0].team_name;
      console.log(`\n👤 ${ownerName} (${teamName})`);

      // Add cap hits (positive values)
      for (const hit of data.hits) {
        await pool.query(`
          INSERT INTO cap_adjustments (
            team_id, league_id, adjustment_type, description,
            amount_2026, amount_2027, amount_2028, amount_2029, amount_2030
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          teamId,
          leagueId,
          'cap_hit',
          hit.description,
          hit.amount_2026,
          hit.amount_2027,
          0,
          0,
          0,
        ]);
        console.log(`   ✅ Hit: ${hit.description} (+$${hit.amount_2026}/${hit.amount_2027})`);
        totalAdded++;
      }

      // Add cap credits (negative values stored as negative)
      for (const credit of data.credits) {
        await pool.query(`
          INSERT INTO cap_adjustments (
            team_id, league_id, adjustment_type, description,
            amount_2026, amount_2027, amount_2028, amount_2029, amount_2030
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          teamId,
          leagueId,
          'cap_credit',
          credit.description,
          -credit.amount_2026, // Negative for credits
          -credit.amount_2027, // Negative for credits
          0,
          0,
          0,
        ]);
        console.log(`   💰 Credit: ${credit.description} (-$${credit.amount_2026}/${credit.amount_2027})`);
        totalAdded++;
      }
    }

    console.log(`\n\n✅ Import complete! Added ${totalAdded} cap adjustments.`);

    // Print summary by team
    console.log('\n📊 Summary by Team:');
    console.log('─'.repeat(80));
    console.log('Team'.padEnd(25) + '2026 Hits'.padStart(12) + '2026 Credits'.padStart(14) + '2026 Net'.padStart(12) + '2027 Net'.padStart(12));
    console.log('─'.repeat(80));

    const summaryResult = await pool.query(`
      SELECT
        t.team_name,
        t.owner_name,
        SUM(CASE WHEN ca.amount_2026 > 0 THEN ca.amount_2026 ELSE 0 END) as hits_2026,
        SUM(CASE WHEN ca.amount_2026 < 0 THEN ABS(ca.amount_2026) ELSE 0 END) as credits_2026,
        SUM(ca.amount_2026) as net_2026,
        SUM(ca.amount_2027) as net_2027
      FROM cap_adjustments ca
      JOIN teams t ON ca.team_id = t.id
      WHERE ca.league_id = $1
      GROUP BY t.id, t.team_name, t.owner_name
      ORDER BY t.owner_name
    `, [leagueId]);

    for (const row of summaryResult.rows) {
      console.log(
        `${row.owner_name.padEnd(25)}` +
        `$${row.hits_2026}`.padStart(12) +
        `$${row.credits_2026}`.padStart(14) +
        `$${row.net_2026}`.padStart(12) +
        `$${row.net_2027}`.padStart(12)
      );
    }

    console.log('─'.repeat(80));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

importAllCapAdjustments();
