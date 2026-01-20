import { Router } from 'express';
import { query, queryOne } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Team, TeamCapSummary, ApiResponse } from '../types/index.js';

export const teamRoutes = Router();

// Get all teams for a league
teamRoutes.get('/league/:leagueId', async (req, res, next) => {
  try {
    const teams = await query<Team>(
      `SELECT * FROM teams WHERE league_id = $1 ORDER BY team_name`,
      [req.params.leagueId]
    );
    
    res.json({
      status: 'success',
      data: teams,
    } as ApiResponse<Team[]>);
  } catch (error) {
    next(error);
  }
});

// Get team by ID
teamRoutes.get('/:id', async (req, res, next) => {
  try {
    const team = await queryOne<Team>(
      'SELECT * FROM teams WHERE id = $1',
      [req.params.id]
    );
    
    if (!team) {
      throw new AppError('Team not found', 404);
    }
    
    res.json({
      status: 'success',
      data: team,
    } as ApiResponse<Team>);
  } catch (error) {
    next(error);
  }
});

// Get team cap summary
teamRoutes.get('/:id/cap', async (req, res, next) => {
  try {
    const summary = await queryOne<TeamCapSummary>(
      'SELECT * FROM team_cap_summary WHERE team_id = $1',
      [req.params.id]
    );
    
    if (!summary) {
      throw new AppError('Team not found', 404);
    }
    
    res.json({
      status: 'success',
      data: summary,
    } as ApiResponse<TeamCapSummary>);
  } catch (error) {
    next(error);
  }
});

// Get all teams cap summary for a league
teamRoutes.get('/league/:leagueId/cap', async (req, res, next) => {
  try {
    const summaries = await query<TeamCapSummary>(
      `SELECT tcs.* FROM team_cap_summary tcs
       JOIN teams t ON tcs.team_id = t.id
       WHERE t.league_id = $1
       ORDER BY tcs.cap_room DESC`,
      [req.params.leagueId]
    );
    
    res.json({
      status: 'success',
      data: summaries,
    } as ApiResponse<TeamCapSummary[]>);
  } catch (error) {
    next(error);
  }
});

// Get team contract years status
teamRoutes.get('/:id/contract-years', async (req, res, next) => {
  try {
    const status = await queryOne(
      'SELECT * FROM team_contract_years WHERE team_id = $1',
      [req.params.id]
    );
    
    if (!status) {
      throw new AppError('Team not found', 404);
    }
    
    res.json({
      status: 'success',
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

// Get team roster with contracts
teamRoutes.get('/:id/roster', async (req, res, next) => {
  try {
    const roster = await query(
      `SELECT 
        c.*,
        p.full_name,
        p.position,
        p.team as nfl_team,
        p.age,
        p.sleeper_player_id
       FROM contracts c
       JOIN players p ON c.player_id = p.id
       WHERE c.team_id = $1 AND c.status = 'active'
       ORDER BY c.salary DESC`,
      [req.params.id]
    );
    
    res.json({
      status: 'success',
      data: roster,
    });
  } catch (error) {
    next(error);
  }
});

// Get team's expired contracts (free agents eligible for tag)
teamRoutes.get('/:id/expired-contracts', async (req, res, next) => {
  try {
    const { season } = req.query;
    
    const expired = await query(
      `SELECT 
        ec.*,
        p.full_name,
        p.position,
        p.team as nfl_team,
        ft.tag_salary
       FROM expired_contracts ec
       JOIN players p ON ec.player_id = p.id
       LEFT JOIN franchise_tags ft ON ft.league_id = ec.league_id 
         AND ft.season = ec.season 
         AND ft.position = p.position
       WHERE ec.team_id = $1 AND ec.season = $2`,
      [req.params.id, season || 2025]
    );
    
    res.json({
      status: 'success',
      data: expired,
    });
  } catch (error) {
    next(error);
  }
});

// Get team's draft picks
teamRoutes.get('/:id/draft-picks', async (req, res, next) => {
  try {
    const picks = await query(
      `SELECT 
        dp.*,
        ot.team_name as original_team_name
       FROM draft_picks dp
       LEFT JOIN teams ot ON dp.original_team_id = ot.id
       WHERE dp.current_team_id = $1 AND dp.is_used = false
       ORDER BY dp.season, dp.round`,
      [req.params.id]
    );
    
    res.json({
      status: 'success',
      data: picks,
    });
  } catch (error) {
    next(error);
  }
});

// Get team's cap projections (5 year view)
teamRoutes.get('/:id/cap-projection', async (req, res, next) => {
  try {
    const team = await queryOne<Team>('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [team.league_id]);
    if (!league) {
      throw new AppError('League not found', 404);
    }

    const currentSeason = league.current_season;
    const projections = [];

    for (let year = 0; year < 5; year++) {
      const season = currentSeason + year;

      // Get contract totals for this season
      const contracts = await query(
        `SELECT SUM(salary) as total_salary, COUNT(*) as contract_count
         FROM contracts
         WHERE team_id = $1
           AND status = 'active'
           AND start_season <= $2
           AND end_season >= $2`,
        [req.params.id, season]
      );

      // Get dead money from cap_transactions (player releases)
      const deadMoney = await queryOne(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM cap_transactions
         WHERE team_id = $1 AND season = $2 AND transaction_type = 'dead_money'`,
        [req.params.id, season]
      );

      // Get cap adjustments (trade dead money) for this specific year
      const capAdjustments = await queryOne(
        `SELECT COALESCE(SUM(
           CASE $2::int
             WHEN 2026 THEN amount_2026
             WHEN 2027 THEN amount_2027
             WHEN 2028 THEN amount_2028
             WHEN 2029 THEN amount_2029
             WHEN 2030 THEN amount_2030
             ELSE 0
           END
         ), 0) as total
         FROM cap_adjustments
         WHERE team_id = $1`,
        [req.params.id, season]
      );

      const totalSalary = parseFloat(contracts[0]?.total_salary || '0');
      const totalDeadMoney = parseFloat(deadMoney?.total || '0');
      const totalCapAdjustments = parseFloat(capAdjustments?.total || '0');
      const combinedDeadMoney = totalDeadMoney + totalCapAdjustments;

      projections.push({
        season,
        committed_salary: totalSalary,
        dead_money_releases: totalDeadMoney,
        dead_money_trades: totalCapAdjustments,
        dead_money: combinedDeadMoney,
        total_cap_used: totalSalary + combinedDeadMoney,
        cap_room: league.salary_cap - totalSalary - combinedDeadMoney,
        contract_count: parseInt(contracts[0]?.contract_count || '0'),
      });
    }

    res.json({
      status: 'success',
      data: {
        team_id: team.id,
        team_name: team.team_name,
        salary_cap: league.salary_cap,
        projections,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get team cap adjustments (dead money)
teamRoutes.get('/:id/cap-adjustments', async (req, res, next) => {
  try {
    const adjustments = await query(
      `SELECT * FROM cap_adjustments WHERE team_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    
    // Also calculate totals by year
    const totals = await queryOne(
      `SELECT 
        COALESCE(SUM(amount_2026), 0) as total_2026,
        COALESCE(SUM(amount_2027), 0) as total_2027,
        COALESCE(SUM(amount_2028), 0) as total_2028,
        COALESCE(SUM(amount_2029), 0) as total_2029,
        COALESCE(SUM(amount_2030), 0) as total_2030
       FROM cap_adjustments WHERE team_id = $1`,
      [req.params.id]
    );
    
    res.json({
      status: 'success',
      data: {
        adjustments,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update team
teamRoutes.patch('/:id', async (req, res, next) => {
  try {
    const allowedFields = ['team_name', 'owner_name', 'division'];
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }
    
    values.push(req.params.id);
    
    const team = await queryOne<Team>(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (!team) {
      throw new AppError('Team not found', 404);
    }
    
    res.json({
      status: 'success',
      data: team,
    } as ApiResponse<Team>);
  } catch (error) {
    next(error);
  }
});
