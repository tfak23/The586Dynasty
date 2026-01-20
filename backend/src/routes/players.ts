import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { SleeperService } from '../services/sleeper.js';
import type { Player, ApiResponse } from '../types/index.js';

export const playerRoutes = Router();

// Sync all players from Sleeper API
playerRoutes.post('/sync', async (req, res, next) => {
  try {
    console.log('Starting player sync from Sleeper API...');
    const sleeper = new SleeperService('any'); // League ID not needed for getAllPlayers
    const players = await sleeper.getAllPlayers();
    
    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    let synced = 0;
    let skipped = 0;
    
    // Process players in batches
    const entries = Object.entries(players);
    console.log(`Processing ${entries.length} players from Sleeper...`);
    
    for (const [sleeperId, player] of entries) {
      // Only sync relevant fantasy positions
      if (!validPositions.includes(player.position)) {
        skipped++;
        continue;
      }
      
      // Skip players without names
      if (!player.full_name || player.full_name.trim() === '') {
        skipped++;
        continue;
      }
      
      const searchFullName = player.full_name.toLowerCase().replace(/[^a-z\s]/g, '');
      const searchLastName = player.last_name?.toLowerCase().replace(/[^a-z\s]/g, '') || '';
      
      await execute(
        `INSERT INTO players (
          sleeper_player_id, full_name, first_name, last_name, position,
          team, age, years_exp, college, number, status, injury_status,
          search_full_name, search_last_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (sleeper_player_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          position = EXCLUDED.position,
          team = EXCLUDED.team,
          age = EXCLUDED.age,
          years_exp = EXCLUDED.years_exp,
          college = EXCLUDED.college,
          number = EXCLUDED.number,
          status = EXCLUDED.status,
          injury_status = EXCLUDED.injury_status,
          search_full_name = EXCLUDED.search_full_name,
          search_last_name = EXCLUDED.search_last_name,
          updated_at = CURRENT_TIMESTAMP`,
        [
          sleeperId,
          player.full_name,
          player.first_name || '',
          player.last_name || '',
          player.position,
          player.team,
          player.age,
          player.years_exp || 0,
          player.college,
          player.number,
          player.status || 'Active',
          player.injury_status,
          searchFullName,
          searchLastName
        ]
      );
      synced++;
    }
    
    console.log(`Player sync complete. Synced: ${synced}, Skipped: ${skipped}`);
    
    res.json({
      status: 'success',
      data: {
        synced,
        skipped,
        total: entries.length,
        message: `Synced ${synced} players from Sleeper API`
      }
    });
  } catch (error) {
    next(error);
  }
});

// Search players
playerRoutes.get('/search', async (req, res, next) => {
  try {
    const { q, position, limit = 20 } = req.query;
    
    if (!q || String(q).length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400);
    }
    
    const searchTerm = String(q).toLowerCase();
    
    let sql = `
      SELECT * FROM players 
      WHERE (search_full_name LIKE $1 OR search_last_name LIKE $1)
    `;
    const params: any[] = [`%${searchTerm}%`];
    let paramIndex = 2;
    
    if (position) {
      sql += ` AND position = $${paramIndex}`;
      params.push(position);
      paramIndex++;
    }
    
    sql += ` ORDER BY 
      CASE WHEN search_full_name LIKE $1 THEN 0 ELSE 1 END,
      full_name
      LIMIT $${paramIndex}`;
    params.push(limit);
    
    const players = await query<Player>(sql, params);
    
    res.json({
      status: 'success',
      data: players,
    } as ApiResponse<Player[]>);
  } catch (error) {
    next(error);
  }
});

// Get player by ID
playerRoutes.get('/:id', async (req, res, next) => {
  try {
    const player = await queryOne<Player>(
      'SELECT * FROM players WHERE id = $1',
      [req.params.id]
    );
    
    if (!player) {
      throw new AppError('Player not found', 404);
    }
    
    res.json({
      status: 'success',
      data: player,
    } as ApiResponse<Player>);
  } catch (error) {
    next(error);
  }
});

// Get player by Sleeper ID
playerRoutes.get('/sleeper/:sleeperId', async (req, res, next) => {
  try {
    const player = await queryOne<Player>(
      'SELECT * FROM players WHERE sleeper_player_id = $1',
      [req.params.sleeperId]
    );
    
    if (!player) {
      throw new AppError('Player not found', 404);
    }
    
    res.json({
      status: 'success',
      data: player,
    } as ApiResponse<Player>);
  } catch (error) {
    next(error);
  }
});

// Get player's contract history
playerRoutes.get('/:id/contracts', async (req, res, next) => {
  try {
    const { league_id } = req.query;
    
    let sql = `
      SELECT c.*, t.team_name, t.owner_name, l.name as league_name
      FROM contracts c
      LEFT JOIN teams t ON c.team_id = t.id
      LEFT JOIN leagues l ON c.league_id = l.id
      WHERE c.player_id = $1
    `;
    const params: any[] = [req.params.id];
    
    if (league_id) {
      sql += ' AND c.league_id = $2';
      params.push(league_id);
    }
    
    sql += ' ORDER BY c.created_at DESC';
    
    const contracts = await query(sql, params);
    
    res.json({
      status: 'success',
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
});

// Get all players by position
playerRoutes.get('/position/:position', async (req, res, next) => {
  try {
    const { position } = req.params;
    const { limit = 100 } = req.query;
    
    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    if (!validPositions.includes(position.toUpperCase())) {
      throw new AppError('Invalid position. Must be QB, RB, WR, or TE', 400);
    }
    
    const players = await query<Player>(
      `SELECT * FROM players WHERE position = $1 ORDER BY full_name LIMIT $2`,
      [position.toUpperCase(), limit]
    );
    
    res.json({
      status: 'success',
      data: players,
    } as ApiResponse<Player[]>);
  } catch (error) {
    next(error);
  }
});

// Get top paid players by position for a league
playerRoutes.get('/league/:leagueId/top-salaries', async (req, res, next) => {
  try {
    const { position, limit = 10 } = req.query;
    
    let sql = `
      SELECT p.*, c.salary, c.years_remaining, c.contract_type,
             t.team_name, t.owner_name
      FROM contracts c
      JOIN players p ON c.player_id = p.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE c.league_id = $1 AND c.status = 'active'
    `;
    const params: any[] = [req.params.leagueId];
    let paramIndex = 2;
    
    if (position) {
      sql += ` AND p.position = $${paramIndex}`;
      params.push(position);
      paramIndex++;
    }
    
    sql += ` ORDER BY c.salary DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const players = await query(sql, params);
    
    res.json({
      status: 'success',
      data: players,
    });
  } catch (error) {
    next(error);
  }
});

// Get free agents (players with expired contracts in a league)
playerRoutes.get('/league/:leagueId/free-agents', async (req, res, next) => {
  try {
    const { position, season = 2025 } = req.query;
    
    let sql = `
      SELECT p.*, ec.previous_salary, ec.eligible_for_franchise_tag,
             t.team_name, t.owner_name,
             ft.tag_salary
      FROM expired_contracts ec
      JOIN players p ON ec.player_id = p.id
      LEFT JOIN teams t ON ec.team_id = t.id
      LEFT JOIN franchise_tags ft ON ft.league_id = ec.league_id 
        AND ft.season = ec.season 
        AND ft.position = p.position
      WHERE ec.league_id = $1 AND ec.season = $2
    `;
    const params: any[] = [req.params.leagueId, season];
    let paramIndex = 3;
    
    if (position) {
      sql += ` AND p.position = $${paramIndex}`;
      params.push(position);
    }
    
    sql += ' ORDER BY ec.previous_salary DESC NULLS LAST';
    
    const freeAgents = await query(sql, params);
    
    res.json({
      status: 'success',
      data: freeAgents,
    });
  } catch (error) {
    next(error);
  }
});
