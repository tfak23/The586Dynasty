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

// Get detailed cap info for all teams (roster-based calculation to match team page)
teamRoutes.get('/league/:leagueId/cap-detailed', async (req, res, next) => {
  try {
    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [req.params.leagueId]);
    if (!league) {
      throw new AppError('League not found', 404);
    }

    const teams = await query('SELECT * FROM teams WHERE league_id = $1', [req.params.leagueId]);
    const currentSeason = league.current_season;

    const results = [];
    for (const team of teams) {
      // Get roster contracts (same as /teams/:id/roster - no season filtering)
      // This matches how the team page calculates player salary
      const contracts = await query(
        `SELECT c.*, p.full_name, p.position
         FROM contracts c
         JOIN players p ON c.player_id = p.id
         WHERE c.team_id = $1 AND c.status = 'active'`,
        [team.id]
      );

      // Sum roster salary (same as team page)
      const rosterSalary = contracts.reduce((sum: number, c: any) => sum + parseFloat(c.salary || 0), 0);

      // Get dead money from cap_adjustments for current season
      const yearColumn = `amount_${currentSeason}`;
      const deadMoneyResult = await queryOne(
        `SELECT COALESCE(SUM(${yearColumn}), 0) as total
         FROM cap_adjustments WHERE team_id = $1`,
        [team.id]
      );
      const deadMoney = parseFloat(deadMoneyResult?.total || 0);

      // Also get dead money from cap_transactions (player releases)
      const releaseDeadMoney = await queryOne(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM cap_transactions
         WHERE team_id = $1 AND season = $2 AND transaction_type = 'dead_money'`,
        [team.id, currentSeason]
      );
      const totalDeadMoney = deadMoney + parseFloat(releaseDeadMoney?.total || 0);

      const capRoom = league.salary_cap - rosterSalary - totalDeadMoney;

      results.push({
        team_id: team.id,
        team_name: team.team_name,
        owner_name: team.owner_name,
        salary_cap: league.salary_cap,
        roster_salary: rosterSalary,
        dead_money: totalDeadMoney,
        cap_room: capRoom,
        contract_count: contracts.length,
        total_contract_years: contracts.reduce((sum: number, c: any) => sum + (c.years_remaining || 0), 0),
      });
    }

    // Sort by cap room descending (same as original endpoint)
    results.sort((a, b) => b.cap_room - a.cap_room);

    res.json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

// Get all draft picks for a league
teamRoutes.get('/league/:leagueId/draft-picks', async (req, res, next) => {
  try {
    const picks = await query(
      `SELECT
        dp.*,
        ot.team_name as original_team_name,
        ct.team_name as current_team_name
       FROM draft_picks dp
       JOIN teams t ON dp.original_team_id = t.id
       LEFT JOIN teams ot ON dp.original_team_id = ot.id
       LEFT JOIN teams ct ON dp.current_team_id = ct.id
       WHERE t.league_id = $1 AND dp.is_used = false
       ORDER BY dp.season, dp.round, dp.pick_number`,
      [req.params.leagueId]
    );

    res.json({
      status: 'success',
      data: picks,
    });
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

    // Dead cap percentages based on years remaining on contract
    // Index 0 = year 1 dead cap, Index 1 = year 2 dead cap, etc.
    const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
      5: [0.75, 0.50, 0.25, 0.10, 0.10],
      4: [0.75, 0.50, 0.25, 0.10],
      3: [0.50, 0.25, 0.10],
      2: [0.50, 0.25],
      1: [0.50],
    };

    for (let year = 0; year < 5; year++) {
      const season = currentSeason + year;

      // Get contract details for this season (need individual contracts for guaranteed calc)
      const contractsData = await query(
        `SELECT id, salary, start_season, end_season, years_remaining
         FROM contracts
         WHERE team_id = $1
           AND status = 'active'
           AND start_season <= $2
           AND end_season >= $2`,
        [req.params.id, season]
      );

      // Calculate total salary and guaranteed (dead cap) for each contract
      let totalSalary = 0;
      let guaranteedSalary = 0;

      for (const contract of contractsData) {
        const salary = parseFloat(contract.salary) || 0;
        totalSalary += salary;

        // Calculate years remaining from this season's perspective
        const yearsRemaining = contract.end_season - season + 1;

        // Get dead cap percentage for releasing at this point
        // Year index is how far into the contract projection we are
        const yearIndex = season - currentSeason;
        const originalYearsRemaining = contract.years_remaining || yearsRemaining;
        const percentages = DEAD_CAP_PERCENTAGES[originalYearsRemaining] || [0.50];

        // $1 contracts retain full cap hit
        if (salary <= 1) {
          guaranteedSalary += salary;
        } else {
          // Dead cap if cut at this point in the future
          const deadCapPercent = percentages[yearIndex] || 0;
          guaranteedSalary += Math.ceil(salary * deadCapPercent);
        }
      }

      // Get dead money from cap_transactions (player releases already executed)
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

      const totalDeadMoney = parseFloat(deadMoney?.total || '0');
      const totalCapAdjustments = parseFloat(capAdjustments?.total || '0');
      const combinedDeadMoney = totalDeadMoney + totalCapAdjustments;

      projections.push({
        season,
        committed_salary: totalSalary,
        guaranteed_salary: guaranteedSalary + combinedDeadMoney, // What you'd owe if everyone was cut
        dead_money_releases: totalDeadMoney,
        dead_money_trades: totalCapAdjustments,
        dead_money: combinedDeadMoney,
        total_cap_used: totalSalary + combinedDeadMoney,
        cap_room: league.salary_cap - totalSalary - combinedDeadMoney,
        contract_count: contractsData.length,
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

// Get expiring contracts (pending_decision = true)
teamRoutes.get('/:id/expiring-contracts', async (req, res, next) => {
  try {
    const contracts = await query(
      `SELECT c.*, p.full_name, p.position, p.team as nfl_team, p.age
       FROM contracts c
       JOIN players p ON c.player_id = p.id
       WHERE c.team_id = $1
         AND c.status = 'active'
         AND c.pending_decision = true
       ORDER BY c.salary DESC`,
      [req.params.id]
    );

    res.json({
      status: 'success',
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
});

// Get franchise tag usage for a team in a season
teamRoutes.get('/:id/franchise-tag-usage/:season', async (req, res, next) => {
  try {
    const usage = await queryOne(
      `SELECT ftu.*, p.full_name, p.position
       FROM franchise_tag_usage ftu
       JOIN players p ON ftu.player_id = p.id
       WHERE ftu.team_id = $1 AND ftu.season = $2`,
      [req.params.id, req.params.season]
    );

    res.json({
      status: 'success',
      data: {
        has_used: !!usage,
        tagged_player: usage || null,
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

// Get team dead cap breakdown (sources of dead money)
teamRoutes.get('/:id/dead-cap-breakdown', async (req, res, next) => {
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
    const yearColumn = `amount_${currentSeason}`;

    // Get dead money from player releases (cap_transactions)
    // Join through contracts to get player info since cap_transactions uses related_contract_id, not player_id
    const releaseDeadMoney = await query(
      `SELECT
        ct.amount,
        ct.description as reason,
        ct.created_at,
        p.full_name as player_name,
        p.position
       FROM cap_transactions ct
       LEFT JOIN contracts c ON ct.related_contract_id = c.id
       LEFT JOIN players p ON c.player_id = p.id
       WHERE ct.team_id = $1 AND ct.season = $2 AND ct.transaction_type = 'dead_money'
       ORDER BY ct.created_at DESC`,
      [req.params.id, currentSeason]
    );

    // Get dead money from trades (cap_adjustments)
    // Use 'description' column, not 'reason'
    const tradeDeadMoney = await query(
      `SELECT
        ca.${yearColumn} as amount,
        ca.description as reason,
        ca.created_at,
        ca.trade_id
       FROM cap_adjustments ca
       WHERE ca.team_id = $1 AND ca.${yearColumn} > 0
       ORDER BY ca.created_at DESC`,
      [req.params.id]
    );

    // Format the results
    const releases = releaseDeadMoney.map((r: any) => ({
      type: 'release',
      player_name: r.player_name || 'Unknown Player',
      position: r.position,
      amount: parseFloat(r.amount),
      reason: r.reason,
      date: r.created_at,
    }));

    const trades = tradeDeadMoney.map((t: any) => ({
      type: 'trade',
      amount: parseFloat(t.amount),
      reason: t.reason || 'Trade dead money',
      trade_id: t.trade_id,
      date: t.created_at,
    }));

    // Calculate totals
    const releaseTotal = releases.reduce((sum: number, r: any) => sum + r.amount, 0);
    const tradeTotal = trades.reduce((sum: number, t: any) => sum + t.amount, 0);

    res.json({
      status: 'success',
      data: {
        season: currentSeason,
        total_dead_cap: releaseTotal + tradeTotal,
        releases: {
          total: releaseTotal,
          items: releases,
        },
        trades: {
          total: tradeTotal,
          items: trades,
        },
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

// Create cap adjustment (commissioner only)
// This adds/removes dead cap for a team across multiple years
teamRoutes.post('/:id/cap-adjustment', async (req, res, next) => {
  try {
    const teamId = req.params.id;
    const {
      reason,
      amount_2026 = 0,
      amount_2027 = 0,
      amount_2028 = 0,
      amount_2029 = 0,
      amount_2030 = 0,
      trade_id
    } = req.body;

    if (!reason) {
      throw new AppError('reason is required', 400);
    }

    // Validate at least one year has an amount
    const totalAmount = Number(amount_2026) + Number(amount_2027) + Number(amount_2028) + Number(amount_2029) + Number(amount_2030);
    if (totalAmount === 0) {
      throw new AppError('At least one year must have a non-zero amount', 400);
    }

    // Verify team exists
    const team = await queryOne<Team>('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Determine adjustment type based on total amount (positive = cap_hit, negative = cap_credit)
    const adjustmentType = totalAmount > 0 ? 'cap_hit' : 'cap_credit';

    // Insert cap adjustment with correct column names
    const adjustment = await queryOne(
      `INSERT INTO cap_adjustments (team_id, league_id, adjustment_type, description, amount_2026, amount_2027, amount_2028, amount_2029, amount_2030, trade_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [teamId, team.league_id, adjustmentType, reason, amount_2026, amount_2027, amount_2028, amount_2029, amount_2030, trade_id]
    );

    res.status(201).json({
      status: 'success',
      data: adjustment,
    });
  } catch (error) {
    next(error);
  }
});

// Delete cap adjustment (commissioner only)
teamRoutes.delete('/:id/cap-adjustment/:adjustmentId', async (req, res, next) => {
  try {
    const { id: teamId, adjustmentId } = req.params;

    const result = await queryOne(
      'DELETE FROM cap_adjustments WHERE id = $1 AND team_id = $2 RETURNING *',
      [adjustmentId, teamId]
    );

    if (!result) {
      throw new AppError('Cap adjustment not found', 404);
    }

    res.json({
      status: 'success',
      data: { deleted: true, id: adjustmentId },
    });
  } catch (error) {
    next(error);
  }
});
