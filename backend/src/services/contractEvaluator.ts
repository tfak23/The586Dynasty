// Contract Evaluation Service
// Rates existing contracts compared to market value
// Ratings: ROOKIE, BUST, GOOD, STEAL, LEGENDARY

import { query, queryOne } from '../db/index.js';
import { estimateContract, ContractEstimate } from './contractEstimator.js';

export type ContractRating = 'ROOKIE' | 'BUST' | 'GOOD' | 'STEAL' | 'LEGENDARY';

export interface ContractEvaluation {
  rating: ContractRating;
  value_score: number;           // Percentage over/under market (positive = good deal)
  actual_salary: number;
  estimated_salary: number;
  salary_difference: number;     // estimated - actual (positive = saving money)
  league_rank: number | null;    // Rank among all contracts (1 = best value)
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
 */
const RATING_THRESHOLDS = {
  BUST: -25,      // Paying 25%+ over market
  GOOD_MIN: -25,  // Between -25% and +25%
  GOOD_MAX: 25,
  STEAL: 25,      // Saving 25-50% vs market
  LEGENDARY_MIN_SCORE: 50,  // Must be saving 50%+ AND
  LEGENDARY_MAX_RANK: 10,   // In top 10 contracts
  LEGENDARY_MIN_PPG: 10,    // Players below this PPG cannot be LEGENDARY (disqualifier)
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
  leagueRank: number | null
): string {
  const diff = Math.abs(estimatedSalary - actualSalary);
  const percentDiff = Math.abs(valueScore);

  switch (rating) {
    case 'LEGENDARY':
      return `Elite value! #${leagueRank} best contract in the league. Saving $${diff.toFixed(0)}/year (${percentDiff.toFixed(0)}% below market) for this ${position}.`;
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
  scored.sort((a, b) => b.valueScore - a.valueScore);

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

  // 2. Get player stats - check if they have ANY historical stats
  const stats = await queryOne<{ avg_points_per_game: string; games_played: number }>(`
    SELECT avg_points_per_game, games_played
    FROM player_season_stats
    WHERE player_id = $1 AND season = 2025
  `, [contract.player_id]);

  // Check if player is a rookie (no stats from any previous season)
  const hasAnyStats = await queryOne<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM player_season_stats
    WHERE player_id = $1
  `, [contract.player_id]);

  const isRookie = !hasAnyStats || parseInt(hasAnyStats.count) === 0;

  // If rookie, return early with ROOKIE rating
  if (isRookie) {
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

  // 5. Determine base rating from thresholds
  let rating: ContractRating;
  if (valueScore < RATING_THRESHOLDS.BUST) {
    rating = 'BUST';
  } else if (valueScore < RATING_THRESHOLDS.STEAL) {
    rating = 'GOOD';
  } else {
    rating = 'STEAL';
  }

  // 6. Check for LEGENDARY (requires league-wide comparison)
  const rankings = await getLeagueContractRankings(leagueId);
  const playerRank = rankings.find(r => r.contractId === contractId);
  const leagueRank = playerRank?.rank || null;

  // Get player PPG for LEGENDARY check
  const playerPpg = stats ? parseFloat(stats.avg_points_per_game) : null;

  // LEGENDARY requires: top 10 rank AND 50%+ value score
  // BUT players with low PPG (<10) are disqualified (prevents low-production players like Will Shipley)
  const meetsLegendaryValueCriteria =
    leagueRank !== null &&
    leagueRank <= RATING_THRESHOLDS.LEGENDARY_MAX_RANK &&
    valueScore >= RATING_THRESHOLDS.LEGENDARY_MIN_SCORE;

  // Disqualify if PPG is below threshold
  const isDisqualifiedByLowPPG = playerPpg !== null && playerPpg < RATING_THRESHOLDS.LEGENDARY_MIN_PPG;

  if (meetsLegendaryValueCriteria && !isDisqualifiedByLowPPG) {
    rating = 'LEGENDARY';
  }

  // 7. Generate reasoning
  const reasoning = generateEvaluationReasoning(
    rating,
    valueScore,
    actualSalary,
    estimatedSalary,
    contract.position,
    leagueRank
  );

  return {
    rating,
    value_score: Math.round(valueScore),
    actual_salary: actualSalary,
    estimated_salary: estimatedSalary,
    salary_difference: estimatedSalary - actualSalary,
    league_rank: leagueRank,
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
};
