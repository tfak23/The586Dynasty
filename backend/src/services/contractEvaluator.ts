// Contract Evaluation Service
// Rates existing contracts compared to market value
// Ratings: ROOKIE, BUST, CORNERSTONE, GOOD, STEAL, LEGENDARY

import { query, queryOne } from '../db/index.js';
import { estimateContract, ContractEstimate } from './contractEstimator.js';

export type ContractRating = 'ROOKIE' | 'BUST' | 'CORNERSTONE' | 'GOOD' | 'STEAL' | 'LEGENDARY';

export interface ContractEvaluation {
  rating: ContractRating;
  value_score: number;           // Percentage over/under market (positive = good deal)
  actual_salary: number;
  estimated_salary: number;
  salary_difference: number;     // estimated - actual (positive = saving money)
  league_rank: number | null;    // Rank among all contracts (1 = best value)
  position_rank?: number | null; // Rank at position by PPG (for CORNERSTONE)
  total_contracts: number;       // Total contracts in league
  comparable_contracts: any[];
  reasoning: string;
  player_stats?: {
    ppg: number;
    games_played: number;
  };
}

interface ContractWithPlayer {
  id: string;
  player_id: string;
  salary: string;
  position: string;
  age: number | null;
  full_name: string;
}

/**
 * Rating thresholds based on value score
 * value_score = (estimated - actual) / estimated * 100
 * Positive score = paying less than market value (good)
 * Negative score = paying more than market value (bad)
 *
 * LEGENDARY: Top 10 by value score AND PPG > 10
 * CORNERSTONE: Not legendary, but top 5 at position in scoring
 * STEAL: Saving 25%+ vs market
 * GOOD: Between -25% and +25%
 * BUST: Paying 25%+ over market
 */
const RATING_THRESHOLDS = {
  BUST: -25,      // Paying 25%+ over market
  GOOD_MIN: -25,  // Between -25% and +25%
  GOOD_MAX: 25,
  STEAL: 25,      // Saving 25%+ vs market
  LEGENDARY_MAX_RANK: 10,   // Must be top 10 by value score
  LEGENDARY_MIN_PPG: 10,    // AND PPG > 10
  CORNERSTONE_MAX_POSITION_RANK: 5, // Top 5 at their position by PPG (if not LEGENDARY)
};

/**
 * Generate human-readable reasoning for the evaluation
 */
function generateEvaluationReasoning(
  rating: ContractRating,
  valueScore: number,
  actualSalary: number,
  estimatedSalary: number,
  position: string,
  leagueRank: number | null,
  positionRank?: number | null
): string {
  const diff = Math.abs(estimatedSalary - actualSalary);
  const percentDiff = Math.abs(valueScore);

  switch (rating) {
    case 'LEGENDARY':
      return `Elite value! #${leagueRank} best contract in the league. Saving $${diff.toFixed(0)}/year (${percentDiff.toFixed(0)}% below market) for this ${position}.`;
    case 'CORNERSTONE':
      return `Elite producer! Top ${positionRank} ${position} in the league. Premium price justified by top-tier performance.`;
    case 'STEAL':
      return `Great deal! Paying $${diff.toFixed(0)} less than market value (${percentDiff.toFixed(0)}% savings) for this ${position}.`;
    case 'GOOD':
      if (valueScore >= 0) {
        return `Fair contract. Slightly below market value for this ${position}.`;
      } else {
        return `Fair contract. Slightly above market value for this ${position}.`;
      }
    case 'BUST':
      return `Overpaying by $${diff.toFixed(0)}/year (${percentDiff.toFixed(0)}% above market) for this ${position}.`;
    case 'ROOKIE':
      return `Rookie contract - no stats history to evaluate yet. Check back after the season.`;
    default:
      return `Contract evaluation for ${position}.`;
  }
}

/**
 * Get position rankings by PPG for all players at a position
 * Used to determine CORNERSTONE status (top 5 at position)
 */
export async function getPositionRankings(
  leagueId: string,
  position: string,
  season: number = 2025
): Promise<{ playerId: string; playerName: string; ppg: number; rank: number }[]> {
  // Get all players at this position with contracts and stats
  const players = await query<{ player_id: string; full_name: string; avg_points_per_game: string }>(
    `SELECT DISTINCT c.player_id, p.full_name, ps.avg_points_per_game
     FROM contracts c
     JOIN players p ON c.player_id = p.id
     JOIN player_season_stats ps ON c.player_id = ps.player_id AND ps.season = $3
     WHERE c.league_id = $1
       AND p.position = $2
       AND c.status = 'active'
       AND c.salary > 0
       AND ps.avg_points_per_game IS NOT NULL
     ORDER BY ps.avg_points_per_game DESC`,
    [leagueId, position, season]
  );

  // Add rank
  return players.map((p, i) => ({
    playerId: p.player_id,
    playerName: p.full_name,
    ppg: parseFloat(p.avg_points_per_game),
    rank: i + 1,
  }));
}

/**
 * Calculate value scores for all active contracts in a league
 * Used to determine LEGENDARY status (top 10 contracts)
 */
export async function getLeagueContractRankings(
  leagueId: string
): Promise<{ contractId: string; valueScore: number; rank: number }[]> {
  // Get all active contracts with player info
  // Exclude $0 contracts (players awaiting franchise tag or release)
  const contracts = await query<ContractWithPlayer>(`
    SELECT c.id, c.player_id, c.salary, p.position, p.age, p.full_name
    FROM contracts c
    JOIN players p ON c.player_id = p.id
    WHERE c.league_id = $1 AND c.status = 'active' AND c.salary > 0
  `, [leagueId]);

  if (contracts.length === 0) {
    return [];
  }

  // Calculate value score for each contract
  const scored = await Promise.all(
    contracts.map(async (c) => {
      try {
        const estimate = await estimateContract(
          leagueId,
          c.player_id,
          c.position,
          c.age,
          null, // Don't use previous salary for fair comparison
          2025
        );

        const actualSalary = parseFloat(c.salary);
        const estimatedSalary = estimate.estimated_salary;

        // Avoid division by zero
        if (estimatedSalary === 0) {
          return { contractId: c.id, valueScore: 0 };
        }

        const valueScore = ((estimatedSalary - actualSalary) / estimatedSalary) * 100;
        return { contractId: c.id, valueScore };
      } catch (error) {
        console.error(`Error evaluating contract ${c.id}:`, error);
        return { contractId: c.id, valueScore: 0 };
      }
    })
  );

  // Sort by value score (highest = best value = rank 1)
  // Handle NaN values by treating them as 0 for sorting
  scored.sort((a, b) => {
    const aScore = isNaN(a.valueScore) ? 0 : a.valueScore;
    const bScore = isNaN(b.valueScore) ? 0 : b.valueScore;
    return bScore - aScore;
  });

  // Add rank
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * Evaluate a single contract against market value
 */
export async function evaluateContract(
  contractId: string,
  leagueId: string
): Promise<ContractEvaluation> {
  // 1. Get contract details with player info
  const contract = await queryOne<ContractWithPlayer & { league_id: string }>(`
    SELECT c.*, p.position, p.age, p.full_name
    FROM contracts c
    JOIN players p ON c.player_id = p.id
    WHERE c.id = $1
  `, [contractId]);

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Skip $0 contracts (players awaiting franchise tag or release)
  const actualSalary = parseFloat(contract.salary);
  if (actualSalary === 0) {
    throw new Error('Cannot evaluate $0 contracts - player is awaiting franchise tag or release');
  }

  // 2. Get player stats for current season
  const stats = await queryOne<{ avg_points_per_game: string; games_played: number }>(`
    SELECT avg_points_per_game, games_played
    FROM player_season_stats
    WHERE player_id = $1 AND season = 2025
  `, [contract.player_id]);

  // Check if player is a TRUE rookie - must have NO stats in the last 3 seasons (2023, 2024, 2025)
  // This prevents veterans who missed a season due to injury from being marked as rookies
  const recentStats = await queryOne<{ recent_count: string }>(`
    SELECT COUNT(*) as recent_count
    FROM player_season_stats
    WHERE player_id = $1 AND season >= 2023
  `, [contract.player_id]);

  const recentStatsCount = recentStats ? parseInt(recentStats.recent_count) : 0;
  const playerPpgForRookieCheck = stats ? parseFloat(stats.avg_points_per_game) : 0;

  // Only mark as ROOKIE if:
  // 1. No stats in recent 3 seasons AND
  // 2. Player has at least 2 PPG (to avoid marking IR/inactive as rookies)
  const isTrueRookie = recentStatsCount === 0 && playerPpgForRookieCheck >= 2;

  // If true rookie, return early with ROOKIE rating
  if (isTrueRookie) {
    return {
      rating: 'ROOKIE' as ContractRating,
      value_score: 0,
      actual_salary: actualSalary,
      estimated_salary: 0,
      salary_difference: 0,
      league_rank: null,
      total_contracts: 0,
      comparable_contracts: [],
      reasoning: generateEvaluationReasoning('ROOKIE', 0, actualSalary, 0, contract.position, null),
      player_stats: undefined,
    };
  }

  // 3. Get market estimate (without previous salary influence for fair comparison)
  const estimate = await estimateContract(
    leagueId,
    contract.player_id,
    contract.position,
    contract.age,
    null, // Don't use previous salary
    2025
  );

  // 4. Calculate value score
  const estimatedSalary = estimate.estimated_salary;

  // Avoid division by zero
  let valueScore = 0;
  if (estimatedSalary > 0) {
    valueScore = ((estimatedSalary - actualSalary) / estimatedSalary) * 100;
  }

  // 5. Get player PPG for rating checks
  const playerPpg = stats ? parseFloat(stats.avg_points_per_game) : null;

  // 6. Get position rankings for CORNERSTONE check
  const positionRankings = await getPositionRankings(leagueId, contract.position, 2025);
  const playerPositionRank = positionRankings.find(r => r.playerId === contract.player_id);
  const positionRank = playerPositionRank?.rank || null;

  // 7. Get league contract rankings for LEGENDARY check
  const rankings = await getLeagueContractRankings(leagueId);
  const playerRank = rankings.find(r => r.contractId === contractId);
  const leagueRank = playerRank?.rank || null;

  // 8. Determine rating using simplified logic:
  // LEGENDARY: Top 10 by value score AND PPG > 10
  // CORNERSTONE: Not legendary, but top 5 at position in scoring
  // Otherwise: STEAL (25%+), GOOD (-25% to +25%), BUST (<-25%)

  let rating: ContractRating;

  // Check LEGENDARY first: Top 10 by value AND PPG > 10
  const isTop10Value = leagueRank !== null && leagueRank <= RATING_THRESHOLDS.LEGENDARY_MAX_RANK;
  const hasMinimumPPG = playerPpg !== null && playerPpg > RATING_THRESHOLDS.LEGENDARY_MIN_PPG;

  if (isTop10Value && hasMinimumPPG) {
    rating = 'LEGENDARY';
  }
  // Check CORNERSTONE: Top 5 at position in scoring (not legendary)
  else if (positionRank !== null && positionRank <= RATING_THRESHOLDS.CORNERSTONE_MAX_POSITION_RANK) {
    rating = 'CORNERSTONE';
  }
  // Normal evaluation based on value score
  else if (valueScore < RATING_THRESHOLDS.BUST) {
    rating = 'BUST';
  } else if (valueScore >= RATING_THRESHOLDS.STEAL) {
    rating = 'STEAL';
  } else {
    rating = 'GOOD';
  }

  // 9. Generate reasoning
  const reasoning = generateEvaluationReasoning(
    rating,
    valueScore,
    actualSalary,
    estimatedSalary,
    contract.position,
    leagueRank,
    positionRank
  );

  return {
    rating,
    value_score: Math.round(valueScore),
    actual_salary: actualSalary,
    estimated_salary: estimatedSalary,
    salary_difference: estimatedSalary - actualSalary,
    league_rank: leagueRank,
    position_rank: positionRank,
    total_contracts: rankings.length,
    comparable_contracts: estimate.comparable_players,
    reasoning,
    player_stats: stats ? {
      ppg: parseFloat(stats.avg_points_per_game),
      games_played: stats.games_played,
    } : undefined,
  };
}

export default {
  evaluateContract,
  getLeagueContractRankings,
  getPositionRankings,
};
