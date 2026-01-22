// Background Roster Sync Job
// Syncs rosters from Sleeper for all leagues, auto-releasing dropped players

import { query, queryOne, execute } from '../db/index.js';
import { SleeperService } from '../services/sleeper.js';

// Dead cap percentages by original contract length and year into contract
const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
  5: [0.75, 0.50, 0.25, 0.10, 0.10],
  4: [0.75, 0.50, 0.25, 0.10],
  3: [0.50, 0.25, 0.10],
  2: [0.50, 0.25],
  1: [0.50],
};

/**
 * Calculate dead cap for a contract
 */
function calculateDeadCap(contract: any, currentSeason: number): number {
  if (contract.salary <= 1) {
    // $1 contracts retain full cap hit
    return parseFloat(contract.salary);
  }

  const yearsIntoContract = currentSeason - contract.start_season;
  const percentages = DEAD_CAP_PERCENTAGES[contract.years_total] || [];
  const percentage = percentages[yearsIntoContract] || 0;
  return Math.round(parseFloat(contract.salary) * percentage * 100) / 100;
}

interface SyncResult {
  league_id: string;
  league_name: string;
  players_released: number;
  total_dead_cap: number;
  errors: string[];
}

/**
 * Sync rosters for a single league
 */
async function syncLeagueRosters(leagueId: string): Promise<SyncResult> {
  const result: SyncResult = {
    league_id: leagueId,
    league_name: '',
    players_released: 0,
    total_dead_cap: 0,
    errors: [],
  };

  try {
    const league = await queryOne(
      'SELECT * FROM leagues WHERE id = $1',
      [leagueId]
    );

    if (!league) {
      result.errors.push('League not found');
      return result;
    }

    result.league_name = league.name;
    const currentSeason = league.current_season || 2026;

    const sleeper = new SleeperService(league.sleeper_league_id);
    const rosters = await sleeper.getRosters();

    // Get all teams for this league
    const teams = await query(
      'SELECT * FROM teams WHERE league_id = $1',
      [leagueId]
    );

    for (const roster of rosters) {
      const team = teams.find((t: any) => t.sleeper_roster_id === roster.roster_id);
      if (!team) continue;

      // Get current contracts for this team
      const currentContracts = await query(
        `SELECT c.*, p.sleeper_player_id, p.full_name
         FROM contracts c
         JOIN players p ON c.player_id = p.id
         WHERE c.team_id = $1 AND c.status = 'active'`,
        [team.id]
      );

      const currentPlayerIds = new Set(currentContracts.map((c: any) => c.sleeper_player_id));
      const sleeperPlayerIds = new Set(roster.players || []);

      // Find players that were dropped (in our DB but not on Sleeper roster)
      for (const playerId of currentPlayerIds) {
        if (!sleeperPlayerIds.has(playerId)) {
          const contract = currentContracts.find((c: any) => c.sleeper_player_id === playerId);
          if (contract) {
            try {
              // Calculate dead cap
              const deadCap = calculateDeadCap(contract, currentSeason);

              // Update contract to released status
              await execute(
                `UPDATE contracts
                 SET status = 'released',
                     released_at = CURRENT_TIMESTAMP,
                     release_reason = 'dropped',
                     dead_cap_hit = $1
                 WHERE id = $2`,
                [deadCap, contract.id]
              );

              // Log dead cap transaction
              if (deadCap > 0) {
                await execute(
                  `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
                   VALUES ($1, $2, $3, 'dead_money', $4, $5, $6)`,
                  [leagueId, team.id, currentSeason, deadCap, `Auto-release: ${contract.full_name}`, contract.id]
                );
              }

              result.players_released++;
              result.total_dead_cap += deadCap;

              console.log(`  🔴 Released ${contract.full_name} from ${team.team_name} (dead cap: $${deadCap})`);
            } catch (error) {
              result.errors.push(`Failed to release ${contract.full_name}: ${(error as Error).message}`);
            }
          }
        }
      }
    }
  } catch (error) {
    result.errors.push(`Sync failed: ${(error as Error).message}`);
  }

  return result;
}

/**
 * Sync all league rosters
 * Called by cron job every 5 minutes
 */
export async function syncAllLeagueRosters(): Promise<{
  synced_at: string;
  leagues_processed: number;
  total_releases: number;
  total_dead_cap: number;
  results: SyncResult[];
}> {
  const startTime = new Date();
  console.log(`🔄 [${startTime.toISOString()}] Starting automatic roster sync...`);

  const summary = {
    synced_at: startTime.toISOString(),
    leagues_processed: 0,
    total_releases: 0,
    total_dead_cap: 0,
    results: [] as SyncResult[],
  };

  try {
    // Get all active leagues
    const leagues = await query<{ id: string; name: string }>(
      'SELECT id, name FROM leagues'
    );

    console.log(`📋 Found ${leagues.length} leagues to sync`);

    for (const league of leagues) {
      console.log(`\n🏈 Syncing: ${league.name}`);

      const result = await syncLeagueRosters(league.id);
      summary.results.push(result);
      summary.leagues_processed++;
      summary.total_releases += result.players_released;
      summary.total_dead_cap += result.total_dead_cap;

      if (result.players_released > 0) {
        console.log(`  ✅ Released ${result.players_released} players, $${result.total_dead_cap.toFixed(2)} dead cap`);
      } else {
        console.log(`  ✅ No changes detected`);
      }

      if (result.errors.length > 0) {
        console.log(`  ⚠️ Errors: ${result.errors.join(', ')}`);
      }
    }

    // Log sync activity if there were any releases
    if (summary.total_releases > 0) {
      for (const result of summary.results) {
        if (result.players_released > 0) {
          await execute(
            `INSERT INTO sync_log (league_id, sync_type, status, records_processed, completed_at)
             VALUES ($1, 'auto_roster_sync', 'completed', $2, CURRENT_TIMESTAMP)`,
            [result.league_id, result.players_released]
          );
        }
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    console.log(`\n🔄 Sync complete in ${duration.toFixed(1)}s`);
    console.log(`   Leagues: ${summary.leagues_processed}, Releases: ${summary.total_releases}, Dead Cap: $${summary.total_dead_cap.toFixed(2)}`);

  } catch (error) {
    console.error('❌ Roster sync failed:', error);
  }

  return summary;
}

/**
 * Get last sync time for a league
 */
export async function getLastSyncTime(leagueId: string): Promise<Date | null> {
  const result = await queryOne<{ completed_at: Date }>(
    `SELECT completed_at FROM sync_log
     WHERE league_id = $1 AND sync_type IN ('rosters', 'roster_releases', 'auto_roster_sync', 'full')
     ORDER BY completed_at DESC LIMIT 1`,
    [leagueId]
  );

  return result?.completed_at || null;
}

export default {
  syncAllLeagueRosters,
  syncLeagueRosters,
  getLastSyncTime,
};
