// Stats Sync Service
// Fetches player stats from Sleeper API and stores in database
// Supports league-specific scoring settings from Sleeper

import { query, queryOne, execute } from '../db/index.js';

const SLEEPER_STATS_API = 'https://api.sleeper.app/v1';

// Default PPR scoring weights (fallback if no league settings)
const DEFAULT_SCORING: ScoringSettings = {
  pass_yd: 0.04,            // 1 point per 25 yards
  pass_td: 4,               // 4 points per TD
  pass_int: -2,             // -2 per INT
  rush_yd: 0.1,             // 1 point per 10 yards
  rush_td: 6,               // 6 points per TD
  rec: 1,                   // 1 point per reception (PPR)
  rec_yd: 0.1,              // 1 point per 10 yards
  rec_td: 6,                // 6 points per TD
  fum_lost: -2,             // -2 per fumble lost
};

// Scoring settings interface (matches Sleeper's scoring_settings format)
interface ScoringSettings {
  pass_yd?: number;         // Points per passing yard
  pass_td?: number;         // Points per passing TD
  pass_int?: number;        // Points per interception (usually negative)
  rush_yd?: number;         // Points per rushing yard
  rush_td?: number;         // Points per rushing TD
  rec?: number;             // Points per reception (0 for standard, 0.5 for half-PPR, 1 for PPR)
  rec_yd?: number;          // Points per receiving yard
  rec_td?: number;          // Points per receiving TD
  fum_lost?: number;        // Points per fumble lost (usually negative)
  [key: string]: number | undefined;  // Allow additional scoring categories
}

interface SleeperStats {
  gp?: number;              // games played
  gs?: number;              // games started
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  pass_att?: number;
  pass_cmp?: number;
  rush_yd?: number;
  rush_td?: number;
  rush_att?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  rec_tgt?: number;
  fum_lost?: number;
  pts_ppr?: number;         // Sleeper's calculated PPR points
}

/**
 * Fetches season stats from Sleeper API
 * Note: This is an unofficial endpoint but still functional
 */
export async function fetchSeasonStats(season: number): Promise<Record<string, SleeperStats>> {
  const url = `${SLEEPER_STATS_API}/stats/nfl/regular/${season}`;

  console.log(`📊 Fetching ${season} stats from Sleeper...`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Sleeper Stats API error: ${response.status} ${response.statusText}`);
  }

  const stats = await response.json() as Record<string, SleeperStats>;
  console.log(`📊 Received stats for ${Object.keys(stats).length} players`);

  return stats;
}

/**
 * Fetch league scoring settings from database
 */
async function getLeagueScoringSettings(leagueId: string): Promise<ScoringSettings | null> {
  const league = await queryOne<{ scoring_settings: ScoringSettings | string }>(
    `SELECT scoring_settings FROM leagues WHERE id = $1`,
    [leagueId]
  );

  if (!league?.scoring_settings) {
    return null;
  }

  // Parse if stored as string
  if (typeof league.scoring_settings === 'string') {
    try {
      return JSON.parse(league.scoring_settings);
    } catch {
      return null;
    }
  }

  return league.scoring_settings;
}

/**
 * Calculate fantasy points using league-specific or default scoring
 */
function calculateFantasyPoints(stats: SleeperStats, scoring: ScoringSettings): number {
  let points = 0;

  // Calculate using provided scoring settings
  points += (stats.pass_yd || 0) * (scoring.pass_yd ?? DEFAULT_SCORING.pass_yd!);
  points += (stats.pass_td || 0) * (scoring.pass_td ?? DEFAULT_SCORING.pass_td!);
  points += (stats.pass_int || 0) * (scoring.pass_int ?? DEFAULT_SCORING.pass_int!);
  points += (stats.rush_yd || 0) * (scoring.rush_yd ?? DEFAULT_SCORING.rush_yd!);
  points += (stats.rush_td || 0) * (scoring.rush_td ?? DEFAULT_SCORING.rush_td!);
  points += (stats.rec || 0) * (scoring.rec ?? DEFAULT_SCORING.rec!);
  points += (stats.rec_yd || 0) * (scoring.rec_yd ?? DEFAULT_SCORING.rec_yd!);
  points += (stats.rec_td || 0) * (scoring.rec_td ?? DEFAULT_SCORING.rec_td!);
  points += (stats.fum_lost || 0) * (scoring.fum_lost ?? DEFAULT_SCORING.fum_lost!);

  return Math.round(points * 100) / 100;
}

/**
 * Sync player stats for a given season
 * @param season - The NFL season year (e.g., 2025)
 * @param leagueId - Optional league ID to use league-specific scoring settings
 */
export async function syncPlayerStats(season: number, leagueId?: string): Promise<{
  synced: number;
  skipped: number;
  errors: string[];
  scoringType: string;
}> {
  const results = {
    synced: 0,
    skipped: 0,
    errors: [] as string[],
    scoringType: 'PPR (default)',
  };

  try {
    // Get scoring settings (league-specific or default)
    let scoring: ScoringSettings = DEFAULT_SCORING;

    if (leagueId) {
      const leagueScoring = await getLeagueScoringSettings(leagueId);
      if (leagueScoring) {
        scoring = leagueScoring;
        const recPoints = scoring.rec ?? 1;
        results.scoringType = recPoints === 1 ? 'PPR (league)' :
                             recPoints === 0.5 ? 'Half-PPR (league)' :
                             recPoints === 0 ? 'Standard (league)' :
                             `Custom (${recPoints} PPR)`;
        console.log(`📊 Using league scoring settings: ${results.scoringType}`);
      } else {
        console.log(`📊 League ${leagueId} has no scoring settings, using default PPR`);
      }
    }

    // Fetch stats from Sleeper
    const allStats = await fetchSeasonStats(season);

    // Get all players in our database
    const players = await query<{ id: string; sleeper_player_id: string }>(
      `SELECT id, sleeper_player_id FROM players WHERE position IN ('QB', 'RB', 'WR', 'TE')`
    );

    const playerMap = new Map(players.map(p => [p.sleeper_player_id, p.id]));

    console.log(`📊 Syncing stats for ${players.length} players in database...`);

    for (const [sleeperId, stats] of Object.entries(allStats)) {
      const playerId = playerMap.get(sleeperId);

      if (!playerId) {
        results.skipped++;
        continue;
      }

      const gamesPlayed = stats.gp || 0;

      // Skip if no games played
      if (gamesPlayed === 0) {
        results.skipped++;
        continue;
      }

      const totalPoints = calculateFantasyPoints(stats, scoring);
      const ppg = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

      try {
        await execute(
          `INSERT INTO player_season_stats (
            player_id, season, games_played, games_started,
            total_fantasy_points, avg_points_per_game,
            passing_yards, passing_tds, interceptions, passing_attempts, completions,
            rushing_yards, rushing_tds, rushing_attempts,
            receptions, receiving_yards, receiving_tds, targets
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (player_id, season) DO UPDATE SET
            games_played = EXCLUDED.games_played,
            games_started = EXCLUDED.games_started,
            total_fantasy_points = EXCLUDED.total_fantasy_points,
            avg_points_per_game = EXCLUDED.avg_points_per_game,
            passing_yards = EXCLUDED.passing_yards,
            passing_tds = EXCLUDED.passing_tds,
            interceptions = EXCLUDED.interceptions,
            passing_attempts = EXCLUDED.passing_attempts,
            completions = EXCLUDED.completions,
            rushing_yards = EXCLUDED.rushing_yards,
            rushing_tds = EXCLUDED.rushing_tds,
            rushing_attempts = EXCLUDED.rushing_attempts,
            receptions = EXCLUDED.receptions,
            receiving_yards = EXCLUDED.receiving_yards,
            receiving_tds = EXCLUDED.receiving_tds,
            targets = EXCLUDED.targets,
            synced_at = CURRENT_TIMESTAMP`,
          [
            playerId,
            season,
            gamesPlayed,
            stats.gs || 0,
            totalPoints,
            Math.round(ppg * 100) / 100,
            stats.pass_yd || 0,
            stats.pass_td || 0,
            stats.pass_int || 0,
            stats.pass_att || 0,
            stats.pass_cmp || 0,
            stats.rush_yd || 0,
            stats.rush_td || 0,
            stats.rush_att || 0,
            stats.rec || 0,
            stats.rec_yd || 0,
            stats.rec_td || 0,
            stats.rec_tgt || 0,
          ]
        );
        results.synced++;
      } catch (error) {
        results.errors.push(`Failed to sync ${sleeperId}: ${(error as Error).message}`);
      }
    }

    console.log(`📊 Stats sync complete. Synced: ${results.synced}, Skipped: ${results.skipped}`);

    return results;
  } catch (error) {
    console.error('Stats sync failed:', error);
    results.errors.push(`Global error: ${(error as Error).message}`);
    return results;
  }
}

/**
 * Get stats for a specific player
 */
export async function getPlayerStats(playerId: string, season?: number) {
  if (season) {
    return queryOne(
      `SELECT * FROM player_season_stats WHERE player_id = $1 AND season = $2`,
      [playerId, season]
    );
  }

  // Return most recent season
  return queryOne(
    `SELECT * FROM player_season_stats WHERE player_id = $1 ORDER BY season DESC LIMIT 1`,
    [playerId]
  );
}

/**
 * Get top performers by position
 */
export async function getTopPerformers(
  position: string,
  season: number,
  limit: number = 20
) {
  return query(
    `SELECT pss.*, p.full_name, p.position, p.team, p.age
     FROM player_season_stats pss
     JOIN players p ON pss.player_id = p.id
     WHERE p.position = $1 AND pss.season = $2
     ORDER BY pss.total_fantasy_points DESC
     LIMIT $3`,
    [position, season, limit]
  );
}

export default {
  fetchSeasonStats,
  syncPlayerStats,
  getPlayerStats,
  getTopPerformers,
};
