import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { evaluateContract, getLeagueContractRankings } from '../services/contractEvaluator.js';
import type { Contract, ApiResponse } from '../types/index.js';

export const contractRoutes = Router();

// Rookie draft salary values
const ROOKIE_DRAFT_VALUES: Record<string, number> = {
  '1.01': 45, '1.02': 38, '1.03': 32, '1.04': 27, '1.05': 23,
  '1.06': 20, '1.07': 17, '1.08': 15, '1.09': 13, '1.10': 11, '1.11': 10, '1.12': 10,
  '2.01': 9, '2.02': 9, '2.03': 8, '2.04': 8, '2.05': 7,
  '2.06': 7, '2.07': 6, '2.08': 6, '2.09': 5, '2.10': 5, '2.11': 5, '2.12': 5,
  '3.01': 1, '3.02': 1, '3.03': 1, '3.04': 1, '3.05': 1,
  '3.06': 1, '3.07': 1, '3.08': 1, '3.09': 1, '3.10': 1, '3.11': 1, '3.12': 1,
};

// Minimum salaries by contract length
const MIN_SALARIES: Record<number, number> = {
  1: 1,
  2: 4,
  3: 8,
  4: 12,
  5: 15,
};

// Dead cap percentages by original contract length and year into contract
const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
  5: [0.75, 0.50, 0.25, 0.10, 0.10],
  4: [0.75, 0.50, 0.25, 0.10],
  3: [0.50, 0.25, 0.10],
  2: [0.50, 0.25],
  1: [0.50],
};

// Evaluate a contract against market value
// Returns rating: BUST, GOOD, STEAL, or LEGENDARY
// IMPORTANT: This route must be defined before /:id to avoid route conflicts
contractRoutes.get('/:contractId/evaluation/:leagueId', async (req, res, next) => {
  try {
    const { contractId, leagueId } = req.params;

    if (!contractId || !leagueId) {
      throw new AppError('contractId and leagueId are required', 400);
    }

    const evaluation = await evaluateContract(contractId, leagueId);

    res.json({
      status: 'success',
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
});

// Get all signed contracts with evaluation ratings
// Used by the Players tab to show all signed players with their contract ratings
contractRoutes.get('/league/:leagueId/with-evaluations', async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const { position, rating } = req.query;

    // Get all active contracts with player info
    let sql = `
      SELECT c.*, p.full_name, p.position, p.team as nfl_team, p.age, p.sleeper_player_id,
             t.team_name, t.owner_name
      FROM contracts c
      JOIN players p ON c.player_id = p.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE c.league_id = $1 AND c.status = 'active'
    `;
    const params: any[] = [leagueId];
    let paramIndex = 2;

    if (position && position !== 'All') {
      sql += ` AND p.position = $${paramIndex}`;
      params.push(position);
      paramIndex++;
    }

    sql += ' ORDER BY c.salary DESC';

    const contracts = await query(sql, params);

    // Get league rankings for all contracts (for evaluation data)
    const rankings = await getLeagueContractRankings(leagueId);

    // Get player stats for PPG check and rookie detection
    const playerStats = await query(`
      SELECT player_id, avg_points_per_game
      FROM player_season_stats
      WHERE season = 2025
    `);
    const statsMap = new Map(playerStats.map((s: any) => [s.player_id, parseFloat(s.avg_points_per_game)]));

    // Get count of stats records per player to detect rookies (no historical stats)
    const playerStatsCounts = await query(`
      SELECT player_id, COUNT(*) as stat_count
      FROM player_season_stats
      GROUP BY player_id
    `);
    const statsCountMap = new Map(playerStatsCounts.map((s: any) => [s.player_id, parseInt(s.stat_count)]));

    // Attach evaluation data to each contract
    const contractsWithEval = contracts.map((c: any) => {
      const ranking = rankings.find(r => r.contractId === c.id);
      const hasAnyStats = statsCountMap.get(c.player_id) || 0;

      // Check if rookie (no stats history at all)
      if (hasAnyStats === 0) {
        return {
          ...c,
          evaluation: {
            rating: 'ROOKIE',
            value_score: 0,
            rank: null,
          },
        };
      }

      // Calculate rating from valueScore
      let contractRating: string = 'GOOD';
      if (ranking) {
        if (ranking.valueScore < -25) contractRating = 'BUST';
        else if (ranking.valueScore >= 25) contractRating = 'STEAL';

        // Check for LEGENDARY: top 10 rank + 50% value score
        // BUT disqualify players with PPG < 10
        if (ranking.valueScore >= 50 && ranking.rank <= 10) {
          const playerPpg = statsMap.get(c.player_id);
          const isDisqualifiedByLowPPG = playerPpg !== undefined && playerPpg < 10;
          if (!isDisqualifiedByLowPPG) {
            contractRating = 'LEGENDARY';
          }
        }
      }
      return {
        ...c,
        evaluation: ranking ? {
          rating: contractRating,
          value_score: Math.round(ranking.valueScore),
          rank: ranking.rank,
        } : null,
      };
    });

    // Filter by rating if specified
    let result = contractsWithEval;
    if (rating && rating !== 'ALL') {
      result = contractsWithEval.filter((c: any) => c.evaluation?.rating === rating);
    }

    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
});

// Get all contracts for a league
contractRoutes.get('/league/:leagueId', async (req, res, next) => {
  try {
    const { status, position, team_id } = req.query;
    
    let sql = `
      SELECT c.*, p.full_name, p.position, p.team as nfl_team, p.sleeper_player_id,
             t.team_name, t.owner_name
      FROM contracts c
      JOIN players p ON c.player_id = p.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE c.league_id = $1
    `;
    const params: any[] = [req.params.leagueId];
    let paramIndex = 2;
    
    if (status) {
      sql += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (position) {
      sql += ` AND p.position = $${paramIndex}`;
      params.push(position);
      paramIndex++;
    }
    
    if (team_id) {
      sql += ` AND c.team_id = $${paramIndex}`;
      params.push(team_id);
      paramIndex++;
    }
    
    sql += ' ORDER BY c.salary DESC';
    
    const contracts = await query(sql, params);
    
    res.json({
      status: 'success',
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
});

// Get contract by ID
contractRoutes.get('/:id', async (req, res, next) => {
  try {
    const contract = await queryOne(
      `SELECT c.*, p.full_name, p.position, p.team as nfl_team, p.sleeper_player_id,
              t.team_name, t.owner_name
       FROM contracts c
       JOIN players p ON c.player_id = p.id
       LEFT JOIN teams t ON c.team_id = t.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    
    if (!contract) {
      throw new AppError('Contract not found', 404);
    }
    
    res.json({
      status: 'success',
      data: contract,
    } as ApiResponse<Contract>);
  } catch (error) {
    next(error);
  }
});

// Create new contract
contractRoutes.post('/', async (req, res, next) => {
  try {
    const {
      league_id,
      team_id,
      player_id,
      salary,
      years_total,
      start_season = 2025,
      contract_type = 'standard',
      has_option = false,
      option_year,
      acquisition_type = 'free_agent',
      acquisition_details = {},
      roster_status = 'active',
    } = req.body;
    
    // Validate required fields
    if (!league_id || !player_id || salary === undefined || !years_total) {
      throw new AppError('league_id, player_id, salary, and years_total are required', 400);
    }
    
    // Validate years
    if (years_total < 1 || years_total > 5) {
      throw new AppError('years_total must be between 1 and 5', 400);
    }
    
    // Validate minimum salary
    const minSalary = MIN_SALARIES[years_total];
    if (salary < minSalary) {
      throw new AppError(`Minimum salary for ${years_total}-year contract is $${minSalary}`, 400);
    }
    
    // Validate team cap
    if (team_id) {
      const capSummary = await queryOne(
        'SELECT * FROM team_cap_summary WHERE team_id = $1',
        [team_id]
      );
      
      if (capSummary && parseFloat(capSummary.cap_room) < salary) {
        throw new AppError(`Insufficient cap room. Available: $${capSummary.cap_room}, Required: $${salary}`, 400);
      }
    }
    
    const end_season = start_season + years_total - 1;
    
    const contract = await queryOne<Contract>(
      `INSERT INTO contracts (
        league_id, team_id, player_id, salary, years_total, years_remaining,
        start_season, end_season, contract_type, has_option, option_year,
        acquisition_type, acquisition_details, acquisition_date, roster_status
      ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_DATE, $13)
      RETURNING *`,
      [league_id, team_id, player_id, salary, years_total, start_season, end_season,
       contract_type, has_option, option_year, acquisition_type, JSON.stringify(acquisition_details), roster_status]
    );
    
    // Log cap transaction
    if (team_id) {
      await execute(
        `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
         VALUES ($1, $2, $3, 'contract_signed', $4, $5, $6)`,
        [league_id, team_id, start_season, salary, `Signed contract: ${years_total}yr/$${salary}`, contract?.id]
      );
    }
    
    res.status(201).json({
      status: 'success',
      data: contract,
    } as ApiResponse<Contract>);
  } catch (error) {
    next(error);
  }
});

// Release a player (calculate dead cap)
contractRoutes.post('/:id/release', async (req, res, next) => {
  try {
    const { release_reason = 'released' } = req.body;
    
    const contract = await queryOne<Contract>(
      'SELECT * FROM contracts WHERE id = $1',
      [req.params.id]
    );
    
    if (!contract) {
      throw new AppError('Contract not found', 404);
    }
    
    if (contract.status !== 'active') {
      throw new AppError('Contract is not active', 400);
    }
    
    // Get league for current season
    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [contract.league_id]);
    const currentSeason = league?.current_season || 2025;
    
    // Calculate dead cap
    let deadCap = 0;
    if (contract.salary > 1) {
      const yearsIntoContract = currentSeason - contract.start_season;
      const percentages = DEAD_CAP_PERCENTAGES[contract.years_total] || [];
      const percentage = percentages[yearsIntoContract] || 0;
      deadCap = Math.round(contract.salary * percentage * 100) / 100;
    } else {
      // $1 contracts retain full cap hit
      deadCap = contract.salary;
    }
    
    // Update contract
    const updatedContract = await queryOne<Contract>(
      `UPDATE contracts 
       SET status = 'released', released_at = CURRENT_TIMESTAMP, 
           release_reason = $1, dead_cap_hit = $2
       WHERE id = $3 RETURNING *`,
      [release_reason, deadCap, req.params.id]
    );
    
    // Log dead cap transaction
    if (contract.team_id && deadCap > 0) {
      await execute(
        `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
         VALUES ($1, $2, $3, 'dead_money', $4, $5, $6)`,
        [contract.league_id, contract.team_id, currentSeason, deadCap, `Dead cap from release`, contract.id]
      );
    }
    
    res.json({
      status: 'success',
      data: {
        contract: updatedContract,
        dead_cap: deadCap,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Calculate dead cap preview (without actually releasing)
contractRoutes.get('/:id/dead-cap-preview', async (req, res, next) => {
  try {
    const contract = await queryOne<Contract>(
      'SELECT * FROM contracts WHERE id = $1',
      [req.params.id]
    );
    
    if (!contract) {
      throw new AppError('Contract not found', 404);
    }
    
    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [contract.league_id]);
    const currentSeason = league?.current_season || 2025;
    
    let deadCap = 0;
    if (contract.salary > 1) {
      const yearsIntoContract = currentSeason - contract.start_season;
      const percentages = DEAD_CAP_PERCENTAGES[contract.years_total] || [];
      const percentage = percentages[yearsIntoContract] || 0;
      deadCap = Math.round(contract.salary * percentage * 100) / 100;
    } else {
      deadCap = contract.salary;
    }
    
    res.json({
      status: 'success',
      data: {
        contract_id: contract.id,
        salary: contract.salary,
        years_total: contract.years_total,
        years_remaining: contract.years_remaining,
        years_into_contract: currentSeason - contract.start_season,
        dead_cap_percentage: contract.salary > 1 
          ? (DEAD_CAP_PERCENTAGES[contract.years_total]?.[currentSeason - contract.start_season] || 0) * 100 
          : 100,
        dead_cap_hit: deadCap,
        cap_savings: contract.salary - deadCap,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Apply franchise tag
contractRoutes.post('/franchise-tag', async (req, res, next) => {
  try {
    const { league_id, team_id, player_id, season = 2025 } = req.body;
    
    if (!league_id || !team_id || !player_id) {
      throw new AppError('league_id, team_id, and player_id are required', 400);
    }
    
    // Check if team already used a tag this season
    const existingTag = await queryOne(
      'SELECT * FROM franchise_tag_usage WHERE league_id = $1 AND team_id = $2 AND season = $3',
      [league_id, team_id, season]
    );
    
    if (existingTag) {
      throw new AppError('Team has already used their franchise tag this season', 400);
    }
    
    // Get player position
    const player = await queryOne('SELECT * FROM players WHERE id = $1', [player_id]);
    if (!player) {
      throw new AppError('Player not found', 404);
    }
    
    // Get franchise tag value for position
    const tagValue = await queryOne(
      'SELECT tag_salary FROM franchise_tags WHERE league_id = $1 AND season = $2 AND position = $3',
      [league_id, season, player.position]
    );
    
    if (!tagValue) {
      throw new AppError(`Franchise tag value not calculated for ${player.position}. Calculate tag values first.`, 400);
    }
    
    const tagSalary = parseFloat(tagValue.tag_salary);
    
    // Check team cap
    const capSummary = await queryOne('SELECT * FROM team_cap_summary WHERE team_id = $1', [team_id]);
    if (capSummary && parseFloat(capSummary.cap_room) < tagSalary) {
      throw new AppError(`Insufficient cap room for franchise tag. Available: $${capSummary.cap_room}, Required: $${tagSalary}`, 400);
    }
    
    // Create 1-year contract with tag
    const contract = await queryOne<Contract>(
      `INSERT INTO contracts (
        league_id, team_id, player_id, salary, years_total, years_remaining,
        start_season, end_season, contract_type, is_franchise_tagged,
        acquisition_type, acquisition_date
      ) VALUES ($1, $2, $3, $4, 1, 1, $5, $5, 'tag', true, 'tag', CURRENT_DATE)
      RETURNING *`,
      [league_id, team_id, player_id, tagSalary, season]
    );
    
    // Record tag usage
    await execute(
      `INSERT INTO franchise_tag_usage (league_id, team_id, season, contract_id, player_id, tag_salary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [league_id, team_id, season, contract?.id, player_id, tagSalary]
    );
    
    // Log cap transaction
    await execute(
      `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
       VALUES ($1, $2, $3, 'tag_applied', $4, $5, $6)`,
      [league_id, team_id, season, tagSalary, `Franchise tag applied: ${player.full_name}`, contract?.id]
    );
    
    res.status(201).json({
      status: 'success',
      data: {
        contract,
        tag_salary: tagSalary,
        position: player.position,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get rookie draft salary value
contractRoutes.get('/rookie-value/:pick', async (req, res, next) => {
  try {
    const { pick } = req.params;
    const salary = ROOKIE_DRAFT_VALUES[pick];
    
    if (salary === undefined) {
      throw new AppError('Invalid draft pick format. Use format like "1.01", "2.05", etc.', 400);
    }
    
    res.json({
      status: 'success',
      data: {
        pick,
        salary,
        years: 4, // Rookie contracts are 4 years
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all rookie draft values
contractRoutes.get('/rookie-values/all', async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: ROOKIE_DRAFT_VALUES,
    });
  } catch (error) {
    next(error);
  }
});

// Get minimum salaries
contractRoutes.get('/minimum-salaries/all', async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: MIN_SALARIES,
    });
  } catch (error) {
    next(error);
  }
});

