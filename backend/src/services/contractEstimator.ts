// Contract Estimation Service
// Suggests fair contract values based on player stats and comparable contracts

import { query, queryOne } from '../db/index.js';

interface ComparablePlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  age: number | null;
  salary: number;
  ppg: number;
  total_points: number;
  games_played: number;
  years_remaining: number;
}

export interface ContractEstimate {
  estimated_salary: number;
  salary_range: { min: number; max: number };
  confidence: 'high' | 'medium' | 'low';
  comparable_players: ComparablePlayer[];
  reasoning: string;
}

// Position-based salary ranges (floor and ceiling)
const POSITION_RANGES: Record<string, { min: number; max: number; avg: number }> = {
  QB: { min: 1, max: 100, avg: 55 },
  RB: { min: 1, max: 60, avg: 25 },
  WR: { min: 1, max: 70, avg: 30 },
  TE: { min: 1, max: 50, avg: 22 },
};

// Minimum salary thresholds
const MIN_SALARY = 1;

/**
 * Find players with similar PPG who have active contracts
 */
async function findComparablePlayers(
  leagueId: string,
  position: string,
  ppg: number,
  excludePlayerId?: string,
  limit: number = 5
): Promise<ComparablePlayer[]> {
  const ppgRange = position === 'QB' ? 3 : 2; // QB has wider range due to variance

  let sql = `
    SELECT
      c.player_id,
      p.full_name,
      p.position,
      p.team,
      p.age,
      c.salary,
      c.years_remaining,
      pss.avg_points_per_game as ppg,
      pss.total_fantasy_points as total_points,
      pss.games_played
    FROM contracts c
    JOIN players p ON c.player_id = p.id
    LEFT JOIN player_season_stats pss ON pss.player_id = p.id AND pss.season = 2025
    WHERE c.league_id = $1
      AND p.position = $2
      AND c.status = 'active'
      AND pss.avg_points_per_game BETWEEN $3 AND $4
  `;

  const params: any[] = [leagueId, position, ppg - ppgRange, ppg + ppgRange];
  let paramIndex = 5;

  if (excludePlayerId) {
    sql += ` AND c.player_id != $${paramIndex}`;
    params.push(excludePlayerId);
    paramIndex++;
  }

  sql += ` ORDER BY ABS(pss.avg_points_per_game - $${paramIndex}) ASC LIMIT $${paramIndex + 1}`;
  params.push(ppg, limit);

  const comparables = await query<ComparablePlayer>(sql, params);
  return comparables;
}

/**
 * Get average salary for a position in a league
 */
async function getPositionAverageSalary(
  leagueId: string,
  position: string,
  topN: number = 10
): Promise<number> {
  const result = await queryOne<{ avg_salary: number }>(
    `SELECT AVG(salary) as avg_salary
     FROM (
       SELECT c.salary
       FROM contracts c
       JOIN players p ON c.player_id = p.id
       WHERE c.league_id = $1 AND p.position = $2 AND c.status = 'active'
       ORDER BY c.salary DESC
       LIMIT $3
     ) top_contracts`,
    [leagueId, position, topN]
  );

  return result?.avg_salary || POSITION_RANGES[position]?.avg || 20;
}

/**
 * Calculate weighted average salary from comparable players
 */
function calculateWeightedAverage(
  comparables: ComparablePlayer[],
  targetPpg: number
): number {
  if (comparables.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const player of comparables) {
    // Weight inversely by PPG difference (closer = higher weight)
    const ppgDiff = Math.abs(player.ppg - targetPpg);
    const weight = 1 / (1 + ppgDiff);

    weightedSum += player.salary * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Generate human-readable reasoning for the estimate
 */
function generateReasoning(
  position: string,
  ppg: number,
  age: number | null,
  comparables: ComparablePlayer[],
  baseSalary: number,
  adjustments: { reason: string; amount: number }[]
): string {
  const parts: string[] = [];

  // Start with comparables info
  if (comparables.length >= 3) {
    const avgPpg = comparables.reduce((sum, p) => sum + p.ppg, 0) / comparables.length;
    parts.push(
      `Based on ${comparables.length} ${position}s with similar PPG (${avgPpg.toFixed(1)} avg)`
    );
  } else if (comparables.length > 0) {
    parts.push(`Limited comparables found (${comparables.length} ${position}s)`);
  } else {
    parts.push(`No direct comparables - using position averages`);
  }

  // Add adjustment explanations
  for (const adj of adjustments) {
    if (adj.amount !== 0) {
      const sign = adj.amount > 0 ? '+' : '';
      parts.push(`${adj.reason}: ${sign}$${adj.amount.toFixed(0)}`);
    }
  }

  return parts.join('. ');
}

/**
 * Estimate contract value for a player
 */
export async function estimateContract(
  leagueId: string,
  playerId: string,
  position: string,
  age: number | null,
  previousSalary: number | null,
  season: number = 2025
): Promise<ContractEstimate> {
  // Get player stats
  const stats = await queryOne<{
    games_played: number;
    total_fantasy_points: number;
    avg_points_per_game: number;
  }>(
    `SELECT games_played, total_fantasy_points, avg_points_per_game
     FROM player_season_stats
     WHERE player_id = $1 AND season = $2`,
    [playerId, season]
  );

  const ppg = stats?.avg_points_per_game || 0;
  const gamesPlayed = stats?.games_played || 0;
  const positionRange = POSITION_RANGES[position] || POSITION_RANGES.WR;

  // Find comparable contracted players
  const comparables = await findComparablePlayers(
    leagueId,
    position,
    ppg,
    playerId,
    5
  );

  // Calculate base salary from comparables
  let baseSalary: number;
  const adjustments: { reason: string; amount: number }[] = [];

  if (comparables.length >= 2) {
    baseSalary = calculateWeightedAverage(comparables, ppg);
  } else {
    // Fall back to position average
    baseSalary = await getPositionAverageSalary(leagueId, position);

    // Adjust based on PPG relative to average
    const avgPpg = position === 'QB' ? 18 : position === 'RB' ? 12 : position === 'WR' ? 12 : 10;
    const ppgDiff = ppg - avgPpg;
    const ppgAdjustment = ppgDiff * (position === 'QB' ? 3 : 2);
    baseSalary += ppgAdjustment;

    if (ppgAdjustment !== 0) {
      adjustments.push({
        reason: ppgDiff > 0 ? 'Above average PPG' : 'Below average PPG',
        amount: ppgAdjustment,
      });
    }
  }

  // Age adjustments
  const playerAge = age || 25;
  if (playerAge > 28) {
    const agePenalty = (playerAge - 28) * -2;
    baseSalary += agePenalty;
    adjustments.push({ reason: `Age ${playerAge} (over 28)`, amount: agePenalty });
  } else if (playerAge >= 24 && playerAge <= 26) {
    const ageBonus = 3;
    baseSalary += ageBonus;
    adjustments.push({ reason: `Prime age (${playerAge})`, amount: ageBonus });
  }

  // Games played penalty
  if (gamesPlayed > 0 && gamesPlayed < 14) {
    const gamesAdjustment = Math.round((14 - gamesPlayed) * -1.5);
    baseSalary += gamesAdjustment;
    adjustments.push({
      reason: `Limited games (${gamesPlayed}/17)`,
      amount: gamesAdjustment,
    });
  }

  // Previous salary influence (50% weight)
  if (previousSalary && previousSalary > MIN_SALARY) {
    const prevInfluence = (previousSalary - baseSalary) * 0.3;
    if (Math.abs(prevInfluence) > 2) {
      baseSalary += prevInfluence;
      adjustments.push({
        reason: 'Previous contract influence',
        amount: prevInfluence,
      });
    }
  }

  // Clamp to position range
  let estimatedSalary = Math.max(positionRange.min, Math.min(positionRange.max, baseSalary));
  estimatedSalary = Math.round(estimatedSalary);

  // Calculate range (±10%)
  const rangeSpread = Math.max(5, Math.round(estimatedSalary * 0.1));
  const salaryRange = {
    min: Math.max(MIN_SALARY, estimatedSalary - rangeSpread),
    max: Math.min(positionRange.max, estimatedSalary + rangeSpread),
  };

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (comparables.length >= 3 && gamesPlayed >= 10) {
    confidence = 'high';
  } else if (comparables.length >= 1 || gamesPlayed >= 6) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Generate reasoning
  const reasoning = generateReasoning(
    position,
    ppg,
    age,
    comparables,
    baseSalary,
    adjustments
  );

  return {
    estimated_salary: estimatedSalary,
    salary_range: salaryRange,
    confidence,
    comparable_players: comparables.slice(0, 3),
    reasoning,
  };
}

/**
 * Quick estimate without full comparables lookup
 * Used for bulk operations like free agent lists
 */
export async function quickEstimate(
  position: string,
  ppg: number,
  age: number | null,
  previousSalary: number | null
): Promise<number> {
  const positionRange = POSITION_RANGES[position] || POSITION_RANGES.WR;

  // PPG-based baseline
  const ppgMultiplier: Record<string, number> = {
    QB: 3.5,
    RB: 2.5,
    WR: 2.5,
    TE: 2.5,
  };

  let estimate = ppg * (ppgMultiplier[position] || 2.5);

  // Age adjustment
  const playerAge = age || 25;
  if (playerAge > 28) {
    estimate -= (playerAge - 28) * 2;
  } else if (playerAge >= 24 && playerAge <= 26) {
    estimate += 3;
  }

  // Previous salary influence
  if (previousSalary && previousSalary > MIN_SALARY) {
    estimate = (estimate + previousSalary) / 2;
  }

  // Clamp to position range
  estimate = Math.max(positionRange.min, Math.min(positionRange.max, estimate));

  return Math.round(estimate);
}

export default {
  estimateContract,
  quickEstimate,
  findComparablePlayers,
};
