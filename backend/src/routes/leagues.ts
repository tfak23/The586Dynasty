import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { League, ApiResponse } from '../types/index.js';

export const leagueRoutes = Router();

// Get all leagues
leagueRoutes.get('/', async (req, res, next) => {
  try {
    const leagues = await query<League>('SELECT * FROM leagues ORDER BY name');
    
    res.json({
      status: 'success',
      data: leagues,
    } as ApiResponse<League[]>);
  } catch (error) {
    next(error);
  }
});

// Get league by ID
leagueRoutes.get('/:id', async (req, res, next) => {
  try {
    const league = await queryOne<League>(
      'SELECT * FROM leagues WHERE id = $1',
      [req.params.id]
    );
    
    if (!league) {
      throw new AppError('League not found', 404);
    }
    
    res.json({
      status: 'success',
      data: league,
    } as ApiResponse<League>);
  } catch (error) {
    next(error);
  }
});

// Get league by Sleeper ID
leagueRoutes.get('/sleeper/:sleeperId', async (req, res, next) => {
  try {
    const league = await queryOne<League>(
      'SELECT * FROM leagues WHERE sleeper_league_id = $1',
      [req.params.sleeperId]
    );
    
    if (!league) {
      throw new AppError('League not found', 404);
    }
    
    res.json({
      status: 'success',
      data: league,
    } as ApiResponse<League>);
  } catch (error) {
    next(error);
  }
});

// Create new league
leagueRoutes.post('/', async (req, res, next) => {
  try {
    const {
      sleeper_league_id,
      name,
      salary_cap = 500,
      min_contract_years = 45,
      max_contract_years = 75,
      trade_approval_mode = 'auto',
      league_vote_window_hours = 24,
      current_season = 2025,
    } = req.body;
    
    if (!sleeper_league_id || !name) {
      throw new AppError('sleeper_league_id and name are required', 400);
    }
    
    const league = await queryOne<League>(
      `INSERT INTO leagues (
        sleeper_league_id, name, salary_cap, min_contract_years, 
        max_contract_years, trade_approval_mode, league_vote_window_hours, current_season
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [sleeper_league_id, name, salary_cap, min_contract_years, 
       max_contract_years, trade_approval_mode, league_vote_window_hours, current_season]
    );
    
    res.status(201).json({
      status: 'success',
      data: league,
    } as ApiResponse<League>);
  } catch (error) {
    next(error);
  }
});

// Update league settings
leagueRoutes.patch('/:id', async (req, res, next) => {
  try {
    const allowedFields = [
      'name', 'salary_cap', 'min_contract_years', 'max_contract_years',
      'trade_approval_mode', 'league_vote_window_hours', 'veto_threshold', 'current_season'
    ];
    
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
    
    const league = await queryOne<League>(
      `UPDATE leagues SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (!league) {
      throw new AppError('League not found', 404);
    }
    
    res.json({
      status: 'success',
      data: league,
    } as ApiResponse<League>);
  } catch (error) {
    next(error);
  }
});

// Get league commissioners
leagueRoutes.get('/:id/commissioners', async (req, res, next) => {
  try {
    const commissioners = await query(
      `SELECT lc.*, t.team_name, t.owner_name 
       FROM league_commissioners lc
       JOIN teams t ON lc.team_id = t.id
       WHERE lc.league_id = $1
       ORDER BY lc.is_primary DESC`,
      [req.params.id]
    );
    
    res.json({
      status: 'success',
      data: commissioners,
    });
  } catch (error) {
    next(error);
  }
});

// Add commissioner
leagueRoutes.post('/:id/commissioners', async (req, res, next) => {
  try {
    const { team_id, is_primary = false } = req.body;
    
    if (!team_id) {
      throw new AppError('team_id is required', 400);
    }
    
    // Check max 3 commissioners
    const existing = await query(
      'SELECT COUNT(*) as count FROM league_commissioners WHERE league_id = $1',
      [req.params.id]
    );
    
    if (parseInt(existing[0].count) >= 3) {
      throw new AppError('League already has maximum of 3 commissioners', 400);
    }
    
    const commissioner = await queryOne(
      `INSERT INTO league_commissioners (league_id, team_id, is_primary)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, team_id, is_primary]
    );
    
    res.status(201).json({
      status: 'success',
      data: commissioner,
    });
  } catch (error) {
    next(error);
  }
});

// Get franchise tag values for a league/season
leagueRoutes.get('/:id/franchise-tags/:season', async (req, res, next) => {
  try {
    const tags = await query(
      `SELECT * FROM franchise_tags 
       WHERE league_id = $1 AND season = $2
       ORDER BY position`,
      [req.params.id, req.params.season]
    );
    
    res.json({
      status: 'success',
      data: tags,
    });
  } catch (error) {
    next(error);
  }
});

// Calculate and store franchise tag values
leagueRoutes.post('/:id/franchise-tags/:season/calculate', async (req, res, next) => {
  try {
    const { id, season } = req.params;
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const poolSizes: Record<string, number> = { QB: 10, RB: 20, WR: 20, TE: 10 };
    
    const results = [];
    
    for (const position of positions) {
      const poolSize = poolSizes[position];
      
      // Get top N salaries for position
      const topPlayers = await query(
        `SELECT c.salary, p.full_name, p.sleeper_player_id
         FROM contracts c
         JOIN players p ON c.player_id = p.id
         WHERE c.league_id = $1 
           AND p.position = $2
           AND c.status = 'active'
         ORDER BY c.salary DESC
         LIMIT $3`,
        [id, position, poolSize]
      );
      
      const totalSalary = topPlayers.reduce((sum, p) => sum + parseFloat(p.salary), 0);
      const tagSalary = Math.ceil(totalSalary / poolSize);
      
      // Upsert franchise tag
      const tag = await queryOne(
        `INSERT INTO franchise_tags (league_id, season, position, tag_salary, pool_size, top_players)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (league_id, season, position) 
         DO UPDATE SET tag_salary = $4, pool_size = $5, top_players = $6, calculated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [id, season, position, tagSalary, poolSize, JSON.stringify(topPlayers)]
      );
      
      results.push(tag);
    }
    
    res.json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    next(error);
  }
});
