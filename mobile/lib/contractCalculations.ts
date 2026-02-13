// Contract Calculation Utilities (Client-Side)
// Ported from backend/src/services/contractEvaluator.ts and contractEstimator.ts

import { supabase } from './supabase';

export type ContractRating = 'ROOKIE' | 'BUST' | 'CORNERSTONE' | 'GOOD' | 'STEAL' | 'LEGENDARY';

// Rookie draft salary values
export const ROOKIE_DRAFT_VALUES: Record<string, number> = {
  '1.01': 45, '1.02': 38, '1.03': 32, '1.04': 27, '1.05': 23,
  '1.06': 20, '1.07': 17, '1.08': 15, '1.09': 13, '1.10': 11, '1.11': 10, '1.12': 10,
  '2.01': 9, '2.02': 9, '2.03': 8, '2.04': 8, '2.05': 7,
  '2.06': 7, '2.07': 6, '2.08': 6, '2.09': 5, '2.10': 5, '2.11': 5, '2.12': 5,
  '3.01': 1, '3.02': 1, '3.03': 1, '3.04': 1, '3.05': 1,
  '3.06': 1, '3.07': 1, '3.08': 1, '3.09': 1, '3.10': 1, '3.11': 1, '3.12': 1,
};

// Minimum salaries by contract length
export const MIN_SALARIES: Record<number, number> = { 1: 1, 2: 4, 3: 8, 4: 12, 5: 15 };

// Dead cap percentages
export const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
  5: [0.75, 0.50, 0.25, 0.10, 0.10],
  4: [0.75, 0.50, 0.25, 0.10],
  3: [0.50, 0.25, 0.10],
  2: [0.50, 0.25],
  1: [0.50],
};

// Position-based salary ranges
const POSITION_RANGES: Record<string, { min: number; max: number; avg: number }> = {
  QB: { min: 1, max: 100, avg: 55 },
  RB: { min: 1, max: 60, avg: 25 },
  WR: { min: 1, max: 70, avg: 30 },
  TE: { min: 1, max: 50, avg: 22 },
};

const RATING_THRESHOLDS = {
  BUST: -25,
  STEAL: 25,
  LEGENDARY_MAX_RANK: 10,
  LEGENDARY_MIN_PPG: 10,
  CORNERSTONE_MAX_POSITION_RANK: 5,
};

/**
 * Calculate dead cap for a contract without releasing
 */
export function calculateDeadCapPreview(
  salary: number, yearsTotal: number, startSeason: number, currentSeason: number
) {
  if (salary <= 1) return { deadCap: salary, percentage: 100, capSavings: 0 };

  const yearsIntoContract = currentSeason - startSeason;
  const percentages = DEAD_CAP_PERCENTAGES[yearsTotal] || [];
  const pct = percentages[yearsIntoContract] || 0;
  const deadCap = Math.round(salary * pct * 100) / 100;

  return {
    deadCap,
    percentage: pct * 100,
    capSavings: salary - deadCap,
  };
}

/**
 * Quick estimate for free agent salary (no DB calls)
 */
export function quickEstimate(position: string, ppg: number, age: number | null, previousSalary: number | null): number {
  const positionRange = POSITION_RANGES[position] || POSITION_RANGES.WR;
  const ppgMultiplier: Record<string, number> = { QB: 3.5, RB: 2.5, WR: 2.5, TE: 2.5 };

  let estimate = ppg * (ppgMultiplier[position] || 2.5);
  const playerAge = age || 25;
  if (playerAge > 28) estimate -= (playerAge - 28) * 2;
  else if (playerAge >= 24 && playerAge <= 26) estimate += 3;

  if (previousSalary && previousSalary > 1) estimate = (estimate + previousSalary) / 2;

  return Math.round(Math.max(positionRange.min, Math.min(positionRange.max, estimate)));
}

/**
 * Full contract estimation with DB comparables
 */
export async function estimateContract(
  leagueId: string, playerId: string, position: string,
  age: number | null, previousSalary: number | null, season: number = 2025
) {
  // Get player stats
  const { data: stats } = await supabase
    .from('player_season_stats')
    .select('games_played, total_fantasy_points, avg_points_per_game')
    .eq('player_id', playerId)
    .eq('season', season)
    .single();

  const ppg = stats?.avg_points_per_game || 0;
  const gamesPlayed = stats?.games_played || 0;
  const positionRange = POSITION_RANGES[position] || POSITION_RANGES.WR;

  // Find comparable players
  const ppgRange = position === 'QB' ? 3 : 2;
  const { data: comparables } = await supabase
    .from('contracts')
    .select('player_id, salary, years_remaining, players!inner(full_name, position, team, age), player_season_stats!inner(avg_points_per_game, total_fantasy_points, games_played)')
    .eq('league_id', leagueId)
    .eq('players.position', position)
    .eq('status', 'active')
    .eq('player_season_stats.season', season)
    .gte('player_season_stats.avg_points_per_game', ppg - ppgRange)
    .lte('player_season_stats.avg_points_per_game', ppg + ppgRange)
    .neq('player_id', playerId)
    .order('player_season_stats(avg_points_per_game)', { ascending: false })
    .limit(5);

  const adjustments: { reason: string; amount: number }[] = [];
  let baseSalary: number;

  const comps = (comparables || []).map((c: any) => ({
    player_id: c.player_id,
    full_name: c.players?.full_name,
    position: c.players?.position,
    team: c.players?.team,
    age: c.players?.age,
    salary: c.salary,
    ppg: c.player_season_stats?.avg_points_per_game || 0,
    total_points: c.player_season_stats?.total_fantasy_points || 0,
    games_played: c.player_season_stats?.games_played || 0,
    years_remaining: c.years_remaining,
  }));

  if (comps.length >= 2) {
    // Weighted average by PPG proximity
    let totalWeight = 0, weightedSum = 0;
    for (const p of comps) {
      const weight = 1 / (1 + Math.abs(p.ppg - ppg));
      weightedSum += p.salary * weight;
      totalWeight += weight;
    }
    baseSalary = totalWeight > 0 ? weightedSum / totalWeight : positionRange.avg;
  } else {
    // Fallback to position average
    const { data: topContracts } = await supabase
      .from('contracts')
      .select('salary, players!inner(position)')
      .eq('league_id', leagueId)
      .eq('players.position', position)
      .eq('status', 'active')
      .order('salary', { ascending: false })
      .limit(10);

    baseSalary = topContracts && topContracts.length > 0
      ? topContracts.reduce((sum: number, c: any) => sum + c.salary, 0) / topContracts.length
      : positionRange.avg;

    const avgPpg = position === 'QB' ? 18 : position === 'RB' ? 12 : position === 'WR' ? 12 : 10;
    const ppgAdj = (ppg - avgPpg) * (position === 'QB' ? 3 : 2);
    baseSalary += ppgAdj;
    if (ppgAdj !== 0) adjustments.push({ reason: ppgAdj > 0 ? 'Above average PPG' : 'Below average PPG', amount: ppgAdj });
  }

  // Age adjustments
  const playerAge = age || 25;
  if (playerAge > 28) {
    const pen = (playerAge - 28) * -2;
    baseSalary += pen;
    adjustments.push({ reason: `Age ${playerAge} (over 28)`, amount: pen });
  } else if (playerAge >= 24 && playerAge <= 26) {
    baseSalary += 3;
    adjustments.push({ reason: `Prime age (${playerAge})`, amount: 3 });
  }

  // Games played penalty
  if (gamesPlayed > 0 && gamesPlayed < 14) {
    const adj = Math.round((14 - gamesPlayed) * -1.5);
    baseSalary += adj;
    adjustments.push({ reason: `Limited games (${gamesPlayed}/17)`, amount: adj });
  }

  // Previous salary influence
  if (previousSalary && previousSalary > 1) {
    const prevInf = (previousSalary - baseSalary) * 0.3;
    if (Math.abs(prevInf) > 2) {
      baseSalary += prevInf;
      adjustments.push({ reason: 'Previous contract influence', amount: prevInf });
    }
  }

  const estimatedSalary = Math.round(Math.max(positionRange.min, Math.min(positionRange.max, baseSalary)));
  const rangeSpread = Math.max(5, Math.round(estimatedSalary * 0.1));

  return {
    estimated_salary: estimatedSalary,
    salary_range: {
      min: Math.max(1, estimatedSalary - rangeSpread),
      max: Math.min(positionRange.max, estimatedSalary + rangeSpread),
    },
    confidence: comps.length >= 3 && gamesPlayed >= 10 ? 'high' : comps.length >= 1 || gamesPlayed >= 6 ? 'medium' : 'low' as 'high' | 'medium' | 'low',
    comparable_players: comps.slice(0, 3),
    reasoning: comps.length >= 3
      ? `Based on ${comps.length} ${position}s with similar PPG`
      : comps.length > 0
        ? `Limited comparables found (${comps.length} ${position}s)`
        : `No direct comparables - using position averages`,
  };
}

/**
 * Evaluate a single contract against market value
 */
export async function evaluateContract(contractId: string, leagueId: string) {
  // Get contract with player info
  const { data: contract } = await supabase
    .from('contracts')
    .select('*, players!inner(position, age, full_name, id)')
    .eq('id', contractId)
    .single();

  if (!contract) throw new Error('Contract not found');
  const actualSalary = parseFloat(contract.salary);
  if (actualSalary === 0) throw new Error('Cannot evaluate $0 contracts');

  // Check rookie status
  const { data: recentStats } = await supabase
    .from('player_season_stats')
    .select('id')
    .eq('player_id', contract.player_id)
    .gte('season', 2023);

  const { data: currentStats } = await supabase
    .from('player_season_stats')
    .select('avg_points_per_game, games_played')
    .eq('player_id', contract.player_id)
    .eq('season', 2025)
    .single();

  const ppg = currentStats ? parseFloat(currentStats.avg_points_per_game) : 0;
  const isTrueRookie = (!recentStats || recentStats.length === 0) && ppg >= 2;

  if (isTrueRookie) {
    return {
      rating: 'ROOKIE' as ContractRating, value_score: 0,
      actual_salary: actualSalary, estimated_salary: 0, salary_difference: 0,
      league_rank: null, total_contracts: 0, comparable_contracts: [],
      reasoning: 'Rookie contract - no stats history to evaluate yet.',
    };
  }

  // Get estimate
  const estimate = await estimateContract(leagueId, contract.player_id, contract.players.position, contract.players.age, null, 2025);
  const estimatedSalary = estimate.estimated_salary;
  const valueScore = estimatedSalary > 0 ? ((estimatedSalary - actualSalary) / estimatedSalary) * 100 : 0;

  // Position rankings for CORNERSTONE
  const { data: posRankings } = await supabase
    .from('contracts')
    .select('player_id, players!inner(full_name, position), player_season_stats!inner(avg_points_per_game)')
    .eq('league_id', leagueId)
    .eq('players.position', contract.players.position)
    .eq('status', 'active')
    .gt('salary', 0)
    .eq('player_season_stats.season', 2025)
    .order('player_season_stats(avg_points_per_game)', { ascending: false });

  const positionRank = posRankings
    ? posRankings.findIndex((r: any) => r.player_id === contract.player_id) + 1 || null
    : null;

  // For simplified client-side evaluation, we skip the full league ranking
  // (too expensive to estimate every contract) and use value score + position rank
  let rating: ContractRating;
  const hasMinPPG = ppg > RATING_THRESHOLDS.LEGENDARY_MIN_PPG;

  if (valueScore >= RATING_THRESHOLDS.STEAL && hasMinPPG && positionRank && positionRank <= 3) {
    rating = 'LEGENDARY';
  } else if (positionRank && positionRank <= RATING_THRESHOLDS.CORNERSTONE_MAX_POSITION_RANK) {
    rating = 'CORNERSTONE';
  } else if (valueScore < RATING_THRESHOLDS.BUST) {
    rating = 'BUST';
  } else if (valueScore >= RATING_THRESHOLDS.STEAL) {
    rating = 'STEAL';
  } else {
    rating = 'GOOD';
  }

  const diff = Math.abs(estimatedSalary - actualSalary);
  const pctDiff = Math.abs(valueScore);
  const reasoning = rating === 'LEGENDARY' ? `Elite value! Saving $${diff.toFixed(0)}/year (${pctDiff.toFixed(0)}% below market).`
    : rating === 'CORNERSTONE' ? `Elite producer! Top ${positionRank} ${contract.players.position} in the league.`
    : rating === 'STEAL' ? `Great deal! Paying $${diff.toFixed(0)} less than market value.`
    : rating === 'BUST' ? `Overpaying by $${diff.toFixed(0)}/year (${pctDiff.toFixed(0)}% above market).`
    : valueScore >= 0 ? `Fair contract. Slightly below market value.` : `Fair contract. Slightly above market value.`;

  return {
    rating, value_score: Math.round(valueScore),
    actual_salary: actualSalary, estimated_salary: estimatedSalary,
    salary_difference: estimatedSalary - actualSalary,
    league_rank: null, position_rank: positionRank,
    total_contracts: posRankings?.length || 0,
    comparable_contracts: estimate.comparable_players,
    reasoning,
    player_stats: currentStats ? { ppg, games_played: currentStats.games_played } : undefined,
  };
}
