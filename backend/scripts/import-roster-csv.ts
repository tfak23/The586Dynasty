import { query, queryOne, execute } from '../src/db/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RosterEntry {
  playerName: string;
  position: string;
  ownerName: string;
  salary2025: number | null;
  salary2026: number | null;
  salary2027: number | null;
  salary2028: number | null;
  salary2029: number | null;
  contractTag: string;
  rosterStatus: string;
}

// Owner name mapping (CSV full name -> Sleeper username)
const ownerNameMapping: Record<string, string> = {
  'Brian Carnaghi': 'brcarnag',
  'James Gazarato': 'Gazarato',
  'Dominic Puzzuoli': 'DomDuhBomb',
  'Nick D\'Onofrio': 'NickDnof',
  'Dan Carnaghi': 'CanThePan',
  'Zach Gravatas': 'zachg1313',
  'Karl Lucido': 'Klucido08',
  'Akshay Bhanot': 'abhanot11',
  'Tony Fakhouri': 'TonyFF',
  'Jimmy Wilson': 'bigwily57',
  'Mike Trudel': 'miket1326',
  'Trevor Hurd': 'TrevorH42',
};

function parseCSV(csvPath: string): RosterEntry[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const entries: RosterEntry[] = [];
  
  // Start from line 15 (index 14) where the data begins
  for (let i = 14; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Split by comma, but handle the complex CSV structure
    const cells = line.split(',');
    
    // The "Manually Update" section columns (0-indexed):
    // Column 17: Player name
    // Column 18: Contract tag (RK, TAG, etc.)
    // Column 19: Position
    // Column 20-24: Salaries for 2025-2029
    // Column 25: Owner name
    // Column 26: Roster Status
    
    const playerName = cells[17]?.trim();
    const contractTag = cells[18]?.trim() || '';
    const position = cells[19]?.trim();
    const salary2025 = parseSalary(cells[20]);
    const salary2026 = parseSalary(cells[21]);
    const salary2027 = parseSalary(cells[22]);
    const salary2028 = parseSalary(cells[23]);
    const salary2029 = parseSalary(cells[24]);
    const ownerName = cells[25]?.trim();
    const rosterStatus = cells[26]?.trim() || 'Active';
    
    if (playerName && position && ownerName && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)) {
      entries.push({
        playerName,
        position,
        ownerName,
        salary2025,
        salary2026,
        salary2027,
        salary2028,
        salary2029,
        contractTag,
        rosterStatus
      });
    }
    
    // Also check the "Automated" section columns (secondary roster data)
    // Column 32: Player name
    // Column 33: empty
    // Column 34: Position  
    // Column 35-39: Salaries
    // Column 40: Owner
    // Column 41: Roster Status
    
    const playerName2 = cells[32]?.trim();
    const position2 = cells[34]?.trim();
    const salary2025_2 = parseSalary(cells[35]);
    const salary2026_2 = parseSalary(cells[36]);
    const salary2027_2 = parseSalary(cells[37]);
    const salary2028_2 = parseSalary(cells[38]);
    const salary2029_2 = parseSalary(cells[39]);
    const ownerName2 = cells[40]?.trim();
    const rosterStatus2 = cells[41]?.trim() || 'Active';
    
    if (playerName2 && position2 && ownerName2 && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position2)) {
      // Check if this entry already exists
      const exists = entries.some(e => e.playerName === playerName2 && e.ownerName === ownerName2);
      if (!exists) {
        entries.push({
          playerName: playerName2,
          position: position2,
          ownerName: ownerName2,
          salary2025: salary2025_2,
          salary2026: salary2026_2,
          salary2027: salary2027_2,
          salary2028: salary2028_2,
          salary2029: salary2029_2,
          contractTag: '',
          rosterStatus: rosterStatus2
        });
      }
    }
  }
  
  return entries;
}

function parseSalary(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '' || trimmed === 'OPT' || trimmed === '-') return null;
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

function calculateYearsRemaining(entry: RosterEntry): number {
  let years = 0;
  if (entry.salary2025 !== null) years++;
  if (entry.salary2026 !== null) years++;
  if (entry.salary2027 !== null) years++;
  if (entry.salary2028 !== null) years++;
  if (entry.salary2029 !== null) years++;
  return Math.max(years, 1); // At least 1 year
}

function getCurrentSalary(entry: RosterEntry): number {
  return entry.salary2025 || entry.salary2026 || entry.salary2027 || 0;
}

async function importRoster() {
  const csvPath = path.join(__dirname, '../../The 586 Dynasty - Master Roster.csv');
  
  console.log('Reading CSV from:', csvPath);
  const entries = parseCSV(csvPath);
  console.log(`Parsed ${entries.length} roster entries`);
  
  // Group entries by owner for debugging
  const byOwner: Record<string, RosterEntry[]> = {};
  entries.forEach(e => {
    if (!byOwner[e.ownerName]) byOwner[e.ownerName] = [];
    byOwner[e.ownerName].push(e);
  });
  
  console.log('\nPlayers by owner:');
  Object.entries(byOwner).forEach(([owner, players]) => {
    console.log(`  ${owner}: ${players.length} players`);
  });
  
  // Get the league
  const leagues = await query('SELECT * FROM leagues LIMIT 1');
  
  if (!leagues || leagues.length === 0) {
    console.error('No league found');
    process.exit(1);
  }
  
  const league = leagues[0];
  console.log(`\nUsing league: ${league.name} (${league.id})`);
  
  // Get all teams
  const teams = await query('SELECT * FROM teams WHERE league_id = $1', [league.id]);
  
  if (!teams) {
    console.error('Error fetching teams');
    process.exit(1);
  }
  
  console.log(`Found ${teams.length} teams`);
  
  // Create owner name -> team ID mapping
  const ownerToTeam: Record<string, any> = {};
  teams.forEach((team: any) => {
    // Try to match by owner_name
    ownerToTeam[team.owner_name] = team;
    // Also try lowercase
    ownerToTeam[team.owner_name.toLowerCase()] = team;
  });
  
  console.log('\nTeam mappings:');
  teams.forEach((t: any) => console.log(`  ${t.owner_name} -> ${t.id}`));
  
  // Get all players from database
  const players = await query('SELECT * FROM players');
  
  console.log(`\nFound ${players?.length || 0} players in database`);
  
  // Create player name -> player mapping (handle various name formats)
  const playerByName: Record<string, any> = {};
  players?.forEach((p: any) => {
    playerByName[p.full_name?.toLowerCase()] = p;
    // Also try without Jr., III, etc.
    const simpleName = p.full_name?.toLowerCase().replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim();
    if (simpleName) playerByName[simpleName] = p;
  });
  
  // Process each roster entry
  let created = 0;
  let updated = 0;
  let notFound = 0;
  let noTeam = 0;
  
  for (const entry of entries) {
    // Find the team using owner name mapping
    const sleeperUsername = ownerNameMapping[entry.ownerName];
    let team = sleeperUsername ? ownerToTeam[sleeperUsername] : null;
    
    if (!team) {
      // Try direct lookup by the CSV owner name
      team = ownerToTeam[entry.ownerName] || ownerToTeam[entry.ownerName.toLowerCase()];
    }
    
    if (!team) {
      console.log(`  No team found for owner: ${entry.ownerName} (mapped to: ${sleeperUsername})`);
      noTeam++;
      continue;
    }
    
    // Find the player
    let player = playerByName[entry.playerName.toLowerCase()];
    
    if (!player) {
      // Try without suffixes
      const simpleName = entry.playerName.toLowerCase().replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim();
      player = playerByName[simpleName];
    }
    
    if (!player) {
      // Try partial match
      const lastName = entry.playerName.split(' ').pop()?.toLowerCase();
      const firstName = entry.playerName.split(' ')[0]?.toLowerCase();
      player = players?.find((p: any) => 
        p.full_name?.toLowerCase().includes(lastName || '') &&
        p.full_name?.toLowerCase().includes(firstName || '')
      );
    }
    
    if (!player) {
      console.log(`  Player not found: ${entry.playerName} (${entry.position})`);
      notFound++;
      continue;
    }
    
    const yearsRemaining = calculateYearsRemaining(entry);
    const salary = getCurrentSalary(entry);
    const isFranchiseTagged = entry.contractTag === 'TAG';
    
    // Check if contract already exists
    const existingContract = await queryOne(
      'SELECT * FROM contracts WHERE league_id = $1 AND player_id = $2',
      [league.id, player.id]
    );
    
    if (existingContract) {
      // Update existing contract
      await execute(
        `UPDATE contracts SET 
          team_id = $1, salary = $2, years_remaining = $3, 
          is_franchise_tagged = $4, status = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [team.id, salary, yearsRemaining, isFranchiseTagged, entry.rosterStatus === 'Active' ? 'active' : 'released', existingContract.id]
      );
      updated++;
    } else {
      // Create new contract with correct schema
      const currentYear = 2025;
      await execute(
        `INSERT INTO contracts (league_id, team_id, player_id, salary, years_total, years_remaining, start_season, end_season, contract_type, is_franchise_tagged, status, acquisition_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          league.id, team.id, player.id, salary, yearsRemaining, yearsRemaining, 
          currentYear, currentYear + yearsRemaining - 1,
          entry.contractTag === 'RK' ? 'rookie' : (isFranchiseTagged ? 'tag' : 'standard'),
          isFranchiseTagged, 
          entry.rosterStatus === 'Active' ? 'active' : 'released',
          'import'
        ]
      );
      created++;
    }
  }
  
  console.log('\n--- Import Summary ---');
  console.log(`Contracts created: ${created}`);
  console.log(`Contracts updated: ${updated}`);
  console.log(`Players not found: ${notFound}`);
  console.log(`No team match: ${noTeam}`);
  
  console.log('\nDone! Players have been assigned to teams.');
  process.exit(0);
}

importRoster().catch(console.error);
