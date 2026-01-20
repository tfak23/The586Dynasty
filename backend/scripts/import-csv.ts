// Script to import contracts from the CSV file
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const LEAGUE_ID = '145ca3d5-d31d-46ab-8358-6877bb8a7965';
const CURRENT_SEASON = 2025;

// Map CSV owner names to Sleeper usernames
const OWNER_NAME_MAP: Record<string, string> = {
  'Brian Carnaghi': 'brcarnag',
  'Mike Trudel': 'miket1326',
  'Dominic Puzzuoli': 'DomDuhBomb',
  'Jimmy Wilson': 'bigwily57',
  'Tony Fakhouri': 'TonyFF',
  'James Gazarato': 'Gazarato',
  'Dan Carnaghi': 'CanThePan',
  'Trevor Hurd': 'TrevorH42',
  'Akshay Bhanot': 'abhanot11',
  'Nick D\'Onofrio': 'NickDnof',
  'Zach Gravatas': 'zachg1313',
  'Karl Lucido': 'Klucido08',
};

interface ContractRow {
  playerName: string;
  position: string;
  salary: number | null;
  year2025: number | string | null;
  year2026: number | string | null;
  year2027: number | string | null;
  year2028: number | string | null;
  year2029: number | string | null;
  owner: string;
  rosterStatus: string;
  isRookie: boolean;
  isFranchiseTagged: boolean;
}

function parseYearValue(val: string | undefined): number | string | null {
  if (!val || val === '' || val === '#N/A') return null;
  if (val === 'OPT') return 'OPT';
  const num = parseFloat(val.replace('$', '').replace(',', ''));
  return isNaN(num) ? null : num;
}

async function findTeamByOwner(ownerName: string): Promise<any | null> {
  const mappedUsername = OWNER_NAME_MAP[ownerName];
  if (!mappedUsername) {
    console.log(`  No mapping for owner: ${ownerName}`);
    return null;
  }
  
  const result = await pool.query(
    `SELECT * FROM teams WHERE league_id = $1 AND LOWER(owner_name) = LOWER($2)`,
    [LEAGUE_ID, mappedUsername]
  );
  
  return result.rows[0] || null;
}

async function findPlayerByName(name: string, position: string): Promise<any | null> {
  // Clean the name
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, '');
  
  // Try search_full_name match
  let result = await pool.query(
    `SELECT * FROM players WHERE REPLACE(search_full_name, ' ', '') = $1 AND position = $2`,
    [cleanName, position]
  );
  
  if (result.rows[0]) return result.rows[0];
  
  // Try with just last name
  const nameParts = name.split(' ');
  if (nameParts.length >= 2) {
    const lastName = nameParts[nameParts.length - 1].toLowerCase();
    result = await pool.query(
      `SELECT * FROM players WHERE search_last_name = $1 AND position = $2 LIMIT 1`,
      [lastName, position]
    );
  }
  
  return result.rows[0] || null;
}

async function main() {
  console.log('Reading CSV file...');
  const csvContent = readFileSync('../The 586 Dynasty - Master Roster.csv', 'utf-8');
  const rows = csvContent.split('\n');
  
  // Parse the contract data - it starts at row 15 (index 14) in columns R-AA
  // Which are columns 17-26 (0-indexed)
  const contracts: ContractRow[] = [];
  
  for (let i = 14; i < rows.length; i++) {
    const row = rows[i];
    const cols = row.split(',');
    
    // The contract data is in columns R-AA (indices 17-26)
    // Player = col 17, CON = col 18, POS = col 19, 2025 = col 20, 2026 = col 21, 
    // 2027 = col 22, 2028 = col 23, 2029 = col 24, Owner = col 25, Roster Status = col 26
    const playerRaw = cols[17]?.trim() || '';
    const conRaw = cols[18]?.trim() || '';
    const pos = cols[19]?.trim() || '';
    const year2025 = parseYearValue(cols[20]?.trim());
    const year2026 = parseYearValue(cols[21]?.trim());
    const year2027 = parseYearValue(cols[22]?.trim());
    const year2028 = parseYearValue(cols[23]?.trim());
    const year2029 = parseYearValue(cols[24]?.trim());
    const owner = cols[25]?.trim() || '';
    const rosterStatus = cols[26]?.trim() || '';
    
    // Skip empty rows or rows without player/owner
    if (!playerRaw || !owner || owner === '#N/A') continue;
    
    // Check for ,RK, or ,TAG, markers in the player name
    const isRookie = playerRaw.includes(',RK,') || conRaw === 'RK';
    const isFranchiseTagged = playerRaw.includes(',TAG,') || conRaw === 'TAG';
    
    // Clean the player name
    const playerName = playerRaw
      .replace(',RK,', ' ')
      .replace(',TAG,', ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Parse salary from CON column if it's a number
    let salary: number | null = null;
    if (conRaw && conRaw !== 'RK' && conRaw !== 'TAG') {
      const parsed = parseFloat(conRaw.replace('$', ''));
      if (!isNaN(parsed)) salary = parsed;
    }
    
    // Use year values to determine salary if CON is missing
    if (salary === null && typeof year2025 === 'number') {
      salary = year2025;
    }
    
    if (playerName && pos && owner && pos !== 'PICK') {  // Skip draft picks for now
      contracts.push({
        playerName,
        position: pos,
        salary,
        year2025,
        year2026,
        year2027,
        year2028,
        year2029,
        owner,
        rosterStatus,
        isRookie,
        isFranchiseTagged,
      });
    }
  }
  
  console.log(`Found ${contracts.length} contracts to import`);
  
  // Import contracts
  let imported = 0;
  let errors = 0;
  const warnings: string[] = [];
  
  for (const contract of contracts) {
    try {
      // Find team
      const team = await findTeamByOwner(contract.owner);
      if (!team) {
        warnings.push(`Could not find team for owner: ${contract.owner}`);
        errors++;
        continue;
      }
      
      // Find player
      const player = await findPlayerByName(contract.playerName, contract.position);
      if (!player) {
        warnings.push(`Could not find player: ${contract.playerName} (${contract.position})`);
        errors++;
        continue;
      }
      
      // Calculate contract duration
      const yearValues = [contract.year2025, contract.year2026, contract.year2027, contract.year2028, contract.year2029];
      const activeYears = yearValues.filter(v => v !== null && v !== 'OPT').length;
      const hasOption = yearValues.includes('OPT');
      let optionYear: number | null = null;
      if (hasOption) {
        optionYear = 2025 + yearValues.findIndex(v => v === 'OPT');
      }
      
      // Find end season (last year with salary)
      let endSeason = CURRENT_SEASON;
      for (let i = yearValues.length - 1; i >= 0; i--) {
        if (yearValues[i] !== null && yearValues[i] !== 'OPT') {
          endSeason = 2025 + i;
          break;
        }
      }
      
      const yearsTotal = activeYears > 0 ? activeYears : 1;
      const startSeason = endSeason - yearsTotal + 1;
      
      // Get salary
      let salary = contract.salary;
      if (salary === null && typeof contract.year2025 === 'number') {
        salary = contract.year2025;
      }
      
      // Skip if no salary
      if (salary === null || salary === 0) {
        // These are expired contracts or free agents
        warnings.push(`No salary for: ${contract.playerName} - skipping`);
        continue;
      }
      
      // Determine contract type
      let contractType = 'standard';
      if (contract.isRookie) contractType = 'rookie';
      else if (contract.isFranchiseTagged) contractType = 'tag';
      
      // Insert contract
      await pool.query(
        `INSERT INTO contracts (
          league_id, team_id, player_id, salary, years_total, years_remaining,
          start_season, end_season, contract_type, has_option, option_year,
          is_franchise_tagged, roster_status, acquisition_type, acquisition_date,
          acquisition_details, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'import', CURRENT_DATE, $14, 'active')
        ON CONFLICT DO NOTHING`,
        [
          LEAGUE_ID, team.id, player.id, salary, yearsTotal, activeYears,
          startSeason, endSeason, contractType, hasOption, optionYear,
          contract.isFranchiseTagged, contract.rosterStatus.toLowerCase() === 'ir' ? 'ir' : 'active',
          JSON.stringify({ source: 'csv_import', yearValues, importedAt: new Date() })
        ]
      );
      
      imported++;
      console.log(`✓ Imported: ${contract.playerName} (${contract.position}) - $${salary} - ${team.owner_name}`);
    } catch (err) {
      console.error(`Error importing ${contract.playerName}:`, err);
      errors++;
    }
  }
  
  console.log('\n========== IMPORT SUMMARY ==========');
  console.log(`Total contracts found: ${contracts.length}`);
  console.log(`Successfully imported: ${imported}`);
  console.log(`Errors/Skipped: ${errors}`);
  
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    // Show unique warnings
    const uniqueWarnings = [...new Set(warnings)];
    uniqueWarnings.slice(0, 50).forEach(w => console.log(`  - ${w}`));
    if (uniqueWarnings.length > 50) {
      console.log(`  ... and ${uniqueWarnings.length - 50} more`);
    }
  }
  
  await pool.end();
}

main().catch(console.error);
