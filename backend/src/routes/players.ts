import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { SleeperService } from '../services/sleeper.js';
import { estimateContract } from '../services/contractEstimator.js';
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
          team, age, years_exp, college, number, status,
          search_full_name, search_last_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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

// Debug endpoint - check player count in database
playerRoutes.get('/debug/count', async (_req, res, next) => {
  try {
    const totalPlayers = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM players');
    const byPosition = await query<{ position: string; count: string }>(
      `SELECT position, COUNT(*) as count FROM players WHERE position IN ('QB', 'RB', 'WR', 'TE') GROUP BY position`
    );
    const activeContracts = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM contracts WHERE status = \'active\'');

    res.json({
      status: 'success',
      data: {
        total_players: parseInt(totalPlayers?.count || '0'),
        by_position: byPosition,
        active_contracts: parseInt(activeContracts?.count || '0'),
      }
    });
  } catch (error) {
    next(error);
  }
});

// Debug endpoint - get sample free agents (no league ID needed)
playerRoutes.get('/debug/sample-free-agents', async (_req, res, next) => {
  try {
    // Just get 10 players from the database to verify the query works
    const players = await query(`
      SELECT id, full_name, position, team, age
      FROM players
      WHERE position IN ('QB', 'RB', 'WR', 'TE')
      ORDER BY full_name
      LIMIT 10
    `);

    res.json({
      status: 'success',
      data: {
        sample_count: players.length,
        players: players,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get free agents (all players NOT under active contract in a league)
// Shows any player that can be signed, with stats and contract estimation
playerRoutes.get('/league/:leagueId/free-agents', async (req, res, next) => {
  try {
    const { position, search } = req.query;
    const statsSeason = 2025; // Stats from previous season
    const leagueId = req.params.leagueId;

    console.log(`[Free Agents] Request received:`, {
      leagueId,
      position: position || 'all',
      search: search || 'none',
      params: req.params,
      query: req.query,
    });

    // Validate league ID
    if (!leagueId || leagueId === 'undefined' || leagueId === 'null') {
      console.error('[Free Agents] Invalid league ID:', leagueId);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid league ID provided',
        received: leagueId,
      });
    }

    // Check if player_season_stats table exists
    const statsTableExists = await queryOne<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'player_season_stats'
      ) as exists`
    );
    const hasStatsTable = statsTableExists?.exists === true;
    console.log(`[Free Agents] Stats table exists: ${hasStatsTable}`);

    // Get all players who do NOT have an active contract in this league
    // Also pull in their previous contract info if they had one (from expired_contracts)
    // Stats are optional - only included if the table exists
    let sql: string;
    let params: any[];
    let paramIndex: number;

    if (hasStatsTable) {
      sql = `
        SELECT p.*,
               ec.previous_salary,
               ec.eligible_for_franchise_tag,
               t.team_name as previous_team_name,
               t.owner_name as previous_owner_name,
               pss.games_played,
               pss.total_fantasy_points,
               pss.avg_points_per_game,
               pss.passing_yards,
               pss.passing_tds,
               pss.rushing_yards,
               pss.rushing_tds,
               pss.receptions,
               pss.receiving_yards,
               pss.receiving_tds
        FROM players p
        LEFT JOIN expired_contracts ec ON ec.player_id = p.id AND ec.league_id = $1
        LEFT JOIN teams t ON ec.team_id = t.id
        LEFT JOIN player_season_stats pss ON pss.player_id = p.id AND pss.season = $2
        WHERE p.position IN ('QB', 'RB', 'WR', 'TE')
          AND NOT EXISTS (
            SELECT 1 FROM contracts c
            WHERE c.player_id = p.id
              AND c.league_id = $1
              AND c.status = 'active'
          )
      `;
      params = [leagueId, statsSeason];
      paramIndex = 3;
    } else {
      // Simplified query without stats table
      sql = `
        SELECT p.*,
               ec.previous_salary,
               ec.eligible_for_franchise_tag,
               t.team_name as previous_team_name,
               t.owner_name as previous_owner_name,
               NULL as games_played,
               NULL as total_fantasy_points,
               NULL as avg_points_per_game,
               NULL as passing_yards,
               NULL as passing_tds,
               NULL as rushing_yards,
               NULL as rushing_tds,
               NULL as receptions,
               NULL as receiving_yards,
               NULL as receiving_tds
        FROM players p
        LEFT JOIN expired_contracts ec ON ec.player_id = p.id AND ec.league_id = $1
        LEFT JOIN teams t ON ec.team_id = t.id
        WHERE p.position IN ('QB', 'RB', 'WR', 'TE')
          AND NOT EXISTS (
            SELECT 1 FROM contracts c
            WHERE c.player_id = p.id
              AND c.league_id = $1
              AND c.status = 'active'
          )
      `;
      params = [leagueId];
      paramIndex = 2;
    }

    if (position) {
      sql += ` AND p.position = $${paramIndex}`;
      params.push(position);
      paramIndex++;
    }

    if (search && String(search).length >= 2) {
      const searchTerm = String(search).toLowerCase();
      sql += ` AND (p.search_full_name LIKE $${paramIndex} OR p.search_last_name LIKE $${paramIndex})`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Order by PPG (best players first), then by previous salary, then alphabetically
    if (hasStatsTable) {
      sql += ' ORDER BY pss.avg_points_per_game DESC NULLS LAST, ec.previous_salary DESC NULLS LAST, p.full_name LIMIT 200';
    } else {
      sql += ' ORDER BY ec.previous_salary DESC NULLS LAST, p.full_name LIMIT 200';
    }

    const rawFreeAgents = await query(sql, params);
    console.log(`[Free Agents] Query returned ${rawFreeAgents.length} players`);

    // Add estimated contract values using full estimation with comparables
    const freeAgents = await Promise.all(
      rawFreeAgents.map(async (fa: any) => {
        // Use full estimate with comparables for accurate values
        const estimate = await estimateContract(
          leagueId,
          fa.id,
          fa.position,
          fa.age,
          fa.previous_salary ? parseFloat(fa.previous_salary) : null,
          2025 // Stats season
        );

        return {
          ...fa,
          stats: fa.games_played ? {
            games_played: fa.games_played,
            total_points: parseFloat(fa.total_fantasy_points) || 0,
            ppg: parseFloat(fa.avg_points_per_game) || 0,
            passing_yards: fa.passing_yards,
            passing_tds: fa.passing_tds,
            rushing_yards: fa.rushing_yards,
            rushing_tds: fa.rushing_tds,
            receptions: fa.receptions,
            receiving_yards: fa.receiving_yards,
            receiving_tds: fa.receiving_tds,
          } : null,
          estimated_salary: estimate.estimated_salary,
          previous_salary: fa.previous_salary ? parseFloat(fa.previous_salary) : null,
          previous_owner: fa.previous_owner_name || null,
        };
      })
    );

    // Sort by estimated salary (highest value first)
    freeAgents.sort((a, b) => (b.estimated_salary || 0) - (a.estimated_salary || 0));

    res.json({
      status: 'success',
      data: freeAgents,
    });
  } catch (error) {
    next(error);
  }
});

// Get detailed contract estimate for a specific player
playerRoutes.get('/:playerId/estimate/:leagueId', async (req, res, next) => {
  try {
    const { playerId, leagueId } = req.params;

    // Get player info
    const player = await queryOne<any>(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );

    if (!player) {
      throw new AppError('Player not found', 404);
    }

    // Check if they have an expired contract (free agent)
    const expiredContract = await queryOne<any>(
      `SELECT * FROM expired_contracts WHERE player_id = $1 AND league_id = $2`,
      [playerId, leagueId]
    );

    const previousSalary = expiredContract?.previous_salary
      ? parseFloat(expiredContract.previous_salary)
      : null;

    // Get full estimate with comparables
    const estimate = await estimateContract(
      leagueId,
      playerId,
      player.position,
      player.age,
      previousSalary,
      2025 // Stats season
    );

    res.json({
      status: 'success',
      data: {
        player,
        previous_salary: previousSalary,
        estimate,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get player stats
playerRoutes.get('/:playerId/stats', async (req, res, next) => {
  try {
    const { season } = req.query;

    let sql = `
      SELECT pss.*, p.full_name, p.position, p.team
      FROM player_season_stats pss
      JOIN players p ON pss.player_id = p.id
      WHERE pss.player_id = $1
    `;
    const params: any[] = [req.params.playerId];

    if (season) {
      sql += ' AND pss.season = $2';
      params.push(season);
    }

    sql += ' ORDER BY pss.season DESC';

    const stats = await query(sql, params);

    res.json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});
