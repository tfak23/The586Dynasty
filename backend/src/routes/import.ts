import { Router } from 'express';
import { parse } from 'csv-parse';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ImportResult, CSVImportRow } from '../types/index.js';

export const importRoutes = Router();

const CURRENT_SEASON = 2026;

// Owner name mapping (CSV name -> Sleeper display name)
const OWNER_NAME_MAP: Record<string, string> = {
  'Brian': 'brcarnag',
  'Mike': 'miket1326',
  'Dom': 'DomDuhBomb',
  'Willie': 'bigwily57',
  'Tony': 'TonyFF',
  'Garett': 'Gazarato',
  'Cang': 'CanThePan',
  'Trevor': 'TrevorH42',
  'Abhi': 'abhanot11',
  'Nick': 'NickDnof',
  'Zach': 'zachg1313',
  'Kyle': 'Klucido08',
};

interface ParsedContract {
  playerName: string;
  position: string;
  owner: string;
  salary: number | null;
  yearsRemaining: number;
  endSeason: number;
  hasOption: boolean;
  optionYear: number | null;
  isRookie: boolean;
  isFranchiseTagged: boolean;
  rosterStatus: 'active' | 'ir';
  contractStatus: 'active' | 'expired';
  yearValues: (number | string | null)[];
}

function parseCSVRow(row: CSVImportRow): ParsedContract | null {
  // Skip empty rows
  if (!row.Player || !row.Owner) {
    return null;
  }

  // Clean player name and detect markers
  let playerName = row.Player;
  const isRookie = playerName.includes(',RK,');
  const isFranchiseTagged = playerName.includes(',TAG,');
  
  playerName = playerName
    .replace(',RK,', ' ')
    .replace(',TAG,', ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Parse year columns (2026-2030 for current 5-year window)
  const yearColumns = ['2026', '2027', '2028', '2029', '2030'] as const;
  const yearValues = yearColumns.map(y => {
    const val = row[y]?.toString().trim();
    if (!val || val === '') return null;
    if (val === 'OPT') return 'OPT';
    const num = parseFloat(val.replace('$', ''));
    return isNaN(num) ? null : num;
  });

  // Find option year (if any)
  const optionIndex = yearValues.findIndex(v => v === 'OPT');
  const hasOption = optionIndex !== -1;
  const optionYear = hasOption ? 2026 + optionIndex : null;

  // Count active contract years (has salary value, not blank, not OPT)
  const activeYears = yearValues.filter(v => v !== null && v !== 'OPT').length;

  // Calculate end season (last year with a salary value)
  let endSeason = CURRENT_SEASON;
  for (let i = yearColumns.length - 1; i >= 0; i--) {
    if (yearValues[i] !== null && yearValues[i] !== 'OPT') {
      endSeason = 2026 + i;
      break;
    }
  }

  // Parse salary
  const salaryStr = row.CON?.toString().trim();
  const salary = salaryStr ? parseFloat(salaryStr.replace('$', '')) : null;

  return {
    playerName,
    position: row.POS?.trim() || '',
    owner: row.Owner?.trim() || '',
    salary: isNaN(salary as number) ? null : salary,
    yearsRemaining: activeYears,
    endSeason,
    hasOption,
    optionYear,
    isRookie,
    isFranchiseTagged,
    rosterStatus: row['Roster Status']?.toLowerCase() === 'ir' ? 'ir' : 'active',
    contractStatus: salary !== null && salary > 0 ? 'active' : 'expired',
    yearValues,
  };
}

async function findPlayerByName(name: string, position: string): Promise<any | null> {
  // Try exact match first
  let player = await queryOne(
    `SELECT * FROM players WHERE search_full_name = $1 AND position = $2`,
    [name.toLowerCase(), position]
  );

  if (player) return player;

  // Try fuzzy match
  const nameParts = name.toLowerCase().split(' ');
  if (nameParts.length >= 2) {
    const lastName = nameParts[nameParts.length - 1];
    player = await queryOne(
      `SELECT * FROM players WHERE search_last_name = $1 AND position = $2`,
      [lastName, position]
    );
  }

  return player;
}

async function findTeamByOwner(leagueId: string, ownerName: string): Promise<any | null> {
  // Try mapped name
  const mappedUsername = OWNER_NAME_MAP[ownerName];
  if (mappedUsername) {
    const team = await queryOne(
      `SELECT t.* FROM teams t
       WHERE t.league_id = $1 AND (
         LOWER(t.owner_name) = LOWER($2) OR
         EXISTS (SELECT 1 FROM teams t2 WHERE t2.id = t.id AND t2.sleeper_user_id IN (
           SELECT sleeper_user_id FROM teams WHERE LOWER(owner_name) = LOWER($2)
         ))
       )`,
      [leagueId, mappedUsername]
    );
    if (team) return team;
  }

  // Try direct owner name match
  const team = await queryOne(
    `SELECT * FROM teams WHERE league_id = $1 AND LOWER(owner_name) LIKE LOWER($2)`,
    [leagueId, `%${ownerName}%`]
  );

  return team;
}

// Import CSV data
importRoutes.post('/csv/:leagueId', async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const { csvData, dryRun = false } = req.body;

    if (!csvData) {
      throw new AppError('csvData is required', 400);
    }

    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [leagueId]);
    if (!league) {
      throw new AppError('League not found', 404);
    }

    const result: ImportResult = {
      playersImported: 0,
      contractsCreated: 0,
      expiredContracts: 0,
      errors: [],
      warnings: [],
    };

    // Parse CSV
    const records: CSVImportRow[] = await new Promise((resolve, reject) => {
      const rows: CSVImportRow[] = [];
      parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });

    console.log(`Processing ${records.length} rows...`);

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +2 for header and 0-index

      try {
        const parsed = parseCSVRow(row);
        if (!parsed) continue;

        // Find player
        const player = await findPlayerByName(parsed.playerName, parsed.position);
        if (!player) {
          result.warnings.push(`Row ${rowNum}: Could not match player "${parsed.playerName}" (${parsed.position})`);
          continue;
        }

        // Find team
        const team = await findTeamByOwner(leagueId, parsed.owner);
        if (!team) {
          result.warnings.push(`Row ${rowNum}: Could not match owner "${parsed.owner}"`);
          continue;
        }

        if (!dryRun) {
          if (parsed.contractStatus === 'active' && parsed.salary !== null) {
            // Calculate contract years
            const yearsTotal = parsed.yearsRemaining > 0 ? parsed.yearsRemaining : 1;
            const startSeason = parsed.endSeason - yearsTotal + 1;

            // Create active contract
            await execute(
              `INSERT INTO contracts (
                league_id, team_id, player_id, salary, years_total, years_remaining,
                start_season, end_season, contract_type, has_option, option_year,
                is_franchise_tagged, roster_status, acquisition_type, acquisition_date,
                acquisition_details, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'import', CURRENT_DATE, $14, 'active')
              ON CONFLICT DO NOTHING`,
              [
                leagueId, team.id, player.id, parsed.salary, yearsTotal, parsed.yearsRemaining,
                startSeason, parsed.endSeason,
                parsed.isRookie ? 'rookie' : (parsed.isFranchiseTagged ? 'tag' : 'standard'),
                parsed.hasOption, parsed.optionYear, parsed.isFranchiseTagged, parsed.rosterStatus,
                JSON.stringify({ source: 'csv_import', importedAt: new Date(), yearValues: parsed.yearValues })
              ]
            );
            result.contractsCreated++;
          } else {
            // Create expired contract record (eligible for franchise tag)
            await execute(
              `INSERT INTO expired_contracts (league_id, team_id, player_id, roster_status, season, eligible_for_franchise_tag)
               VALUES ($1, $2, $3, $4, $5, true)
               ON CONFLICT DO NOTHING`,
              [leagueId, team.id, player.id, parsed.rosterStatus, CURRENT_SEASON]
            );
            result.expiredContracts++;
          }
        }

        result.playersImported++;
      } catch (error) {
        result.errors.push(`Row ${rowNum}: ${(error as Error).message}`);
      }
    }

    res.json({
      status: 'success',
      data: {
        ...result,
        dryRun,
        message: dryRun 
          ? 'Dry run completed. No changes were made.' 
          : 'Import completed successfully.',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get import preview (analyze CSV without importing)
importRoutes.post('/preview/:leagueId', async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const { csvData } = req.body;

    if (!csvData) {
      throw new AppError('csvData is required', 400);
    }

    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [leagueId]);
    if (!league) {
      throw new AppError('League not found', 404);
    }

    // Parse CSV
    const records: CSVImportRow[] = await new Promise((resolve, reject) => {
      const rows: CSVImportRow[] = [];
      parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });

    const preview = {
      totalRows: records.length,
      activeContracts: 0,
      expiredContracts: 0,
      byPosition: { QB: 0, RB: 0, WR: 0, TE: 0 } as Record<string, number>,
      byOwner: {} as Record<string, number>,
      totalSalary: 0,
      unmatchedPlayers: [] as string[],
      unmatchedOwners: [] as string[],
    };

    for (const row of records) {
      const parsed = parseCSVRow(row);
      if (!parsed) continue;

      if (parsed.contractStatus === 'active') {
        preview.activeContracts++;
        preview.totalSalary += parsed.salary || 0;
      } else {
        preview.expiredContracts++;
      }

      if (parsed.position) {
        preview.byPosition[parsed.position] = (preview.byPosition[parsed.position] || 0) + 1;
      }

      if (parsed.owner) {
        preview.byOwner[parsed.owner] = (preview.byOwner[parsed.owner] || 0) + 1;
      }

      // Check player match
      const player = await findPlayerByName(parsed.playerName, parsed.position);
      if (!player && !preview.unmatchedPlayers.includes(parsed.playerName)) {
        preview.unmatchedPlayers.push(parsed.playerName);
      }

      // Check owner match
      const team = await findTeamByOwner(leagueId, parsed.owner);
      if (!team && !preview.unmatchedOwners.includes(parsed.owner)) {
        preview.unmatchedOwners.push(parsed.owner);
      }
    }

    res.json({
      status: 'success',
      data: preview,
    });
  } catch (error) {
    next(error);
  }
});

// Get owner name mapping
importRoutes.get('/owner-mapping', async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: OWNER_NAME_MAP,
    });
  } catch (error) {
    next(error);
  }
});

// Update owner name mapping
importRoutes.patch('/owner-mapping', async (req, res, next) => {
  try {
    const { mappings } = req.body;
    
    if (!mappings || typeof mappings !== 'object') {
      throw new AppError('mappings object is required', 400);
    }

    Object.assign(OWNER_NAME_MAP, mappings);

    res.json({
      status: 'success',
      data: OWNER_NAME_MAP,
    });
  } catch (error) {
    next(error);
  }
});
