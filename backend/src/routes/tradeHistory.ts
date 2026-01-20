import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { ApiResponse } from '../types/index.js';

export const tradeHistoryRoutes = Router();

// Get trade history for a league with optional filters
tradeHistoryRoutes.get('/league/:leagueId', async (req, res, next) => {
  try {
    const { year, teamId, teamName } = req.query;
    
    let sql = `SELECT th.*, 
                      t1.team_name as team1_full_name,
                      t2.team_name as team2_full_name
               FROM trade_history th
               LEFT JOIN teams t1 ON th.team1_id = t1.id
               LEFT JOIN teams t2 ON th.team2_id = t2.id
               WHERE th.league_id = $1`;
    const params: any[] = [req.params.leagueId];
    let paramIndex = 2;
    
    if (year) {
      sql += ` AND th.trade_year = $${paramIndex}`;
      params.push(parseInt(year as string));
      paramIndex++;
    }
    
    if (teamId) {
      sql += ` AND (th.team1_id = $${paramIndex} OR th.team2_id = $${paramIndex})`;
      params.push(teamId);
      paramIndex++;
    }
    
    if (teamName) {
      sql += ` AND (th.team1_name ILIKE $${paramIndex} OR th.team2_name ILIKE $${paramIndex})`;
      params.push(`%${teamName}%`);
      paramIndex++;
    }
    
    sql += ' ORDER BY th.trade_year DESC, th.trade_number DESC';
    
    const trades = await query(sql, params);
    
    res.json({
      status: 'success',
      data: trades,
    });
  } catch (error) {
    next(error);
  }
});

// Get available years for filtering
tradeHistoryRoutes.get('/league/:leagueId/years', async (req, res, next) => {
  try {
    const years = await query(
      `SELECT DISTINCT trade_year FROM trade_history 
       WHERE league_id = $1 
       ORDER BY trade_year DESC`,
      [req.params.leagueId]
    );
    
    res.json({
      status: 'success',
      data: years.map(y => y.trade_year),
    });
  } catch (error) {
    next(error);
  }
});

// Get all unique team names involved in trades (for filtering)
tradeHistoryRoutes.get('/league/:leagueId/teams', async (req, res, next) => {
  try {
    const teams = await query(
      `SELECT DISTINCT team_name FROM (
         SELECT team1_name as team_name FROM trade_history WHERE league_id = $1
         UNION
         SELECT team2_name as team_name FROM trade_history WHERE league_id = $1
       ) t
       ORDER BY team_name`,
      [req.params.leagueId]
    );
    
    res.json({
      status: 'success',
      data: teams.map(t => t.team_name),
    });
  } catch (error) {
    next(error);
  }
});

// Get trade by number
tradeHistoryRoutes.get('/league/:leagueId/:tradeNumber', async (req, res, next) => {
  try {
    const trade = await queryOne(
      `SELECT th.*, 
              t1.team_name as team1_full_name,
              t2.team_name as team2_full_name
       FROM trade_history th
       LEFT JOIN teams t1 ON th.team1_id = t1.id
       LEFT JOIN teams t2 ON th.team2_id = t2.id
       WHERE th.league_id = $1 AND th.trade_number = $2`,
      [req.params.leagueId, req.params.tradeNumber]
    );
    
    if (!trade) {
      throw new AppError('Trade not found', 404);
    }
    
    res.json({
      status: 'success',
      data: trade,
    });
  } catch (error) {
    next(error);
  }
});

// Get all cap adjustments for a league
tradeHistoryRoutes.get('/league/:leagueId/cap-adjustments', async (req, res, next) => {
  try {
    const adjustments = await query(
      `SELECT ca.*, t.team_name, t.owner_name
       FROM cap_adjustments ca
       JOIN teams t ON ca.team_id = t.id
       WHERE ca.league_id = $1
       ORDER BY t.team_name, ca.created_at DESC`,
      [req.params.leagueId]
    );
    
    res.json({
      status: 'success',
      data: adjustments,
    });
  } catch (error) {
    next(error);
  }
});
