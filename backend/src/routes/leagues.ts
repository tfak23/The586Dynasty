import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import SleeperService from '../services/sleeper.js';
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

// =============================================
// RULES ENDPOINTS
// =============================================

// Get league rules
leagueRoutes.get('/:id/rules', async (req, res, next) => {
  try {
    const league = await queryOne<League>(
      'SELECT rules_content FROM leagues WHERE id = $1',
      [req.params.id]
    );

    if (!league) {
      throw new AppError('League not found', 404);
    }

    // Parse rules_content as JSON if it exists, otherwise return default structure
    let rules = null;
    if (league.rules_content) {
      try {
        rules = JSON.parse(league.rules_content);
      } catch {
        rules = { raw: league.rules_content };
      }
    }

    res.json({
      status: 'success',
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

// Update league rules (commissioner only - to be enforced with middleware later)
leagueRoutes.put('/:id/rules', async (req, res, next) => {
  try {
    const { rules } = req.body;

    if (!rules) {
      throw new AppError('rules content is required', 400);
    }

    const rulesContent = typeof rules === 'string' ? rules : JSON.stringify(rules);

    const league = await queryOne<League>(
      `UPDATE leagues SET rules_content = $1 WHERE id = $2 RETURNING *`,
      [rulesContent, req.params.id]
    );

    if (!league) {
      throw new AppError('League not found', 404);
    }

    res.json({
      status: 'success',
      data: league,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// LEAGUE HISTORY ENDPOINTS
// =============================================

// Get all league history (owner statistics)
leagueRoutes.get('/:id/history', async (req, res, next) => {
  try {
    const { active_only } = req.query;

    let sql = `
      SELECT lh.*, t.team_name as current_team_name
      FROM league_history lh
      LEFT JOIN teams t ON lh.current_team_id = t.id
      WHERE lh.league_id = $1
    `;

    if (active_only === 'true') {
      sql += ' AND lh.is_active = true';
    }

    sql += ' ORDER BY lh.legacy_score DESC, lh.titles DESC, lh.total_wins DESC';

    const history = await query(sql, [req.params.id]);

    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// Get single owner history
leagueRoutes.get('/:id/history/:historyId', async (req, res, next) => {
  try {
    const history = await queryOne(
      `SELECT lh.*, t.team_name as current_team_name
       FROM league_history lh
       LEFT JOIN teams t ON lh.current_team_id = t.id
       WHERE lh.id = $1 AND lh.league_id = $2`,
      [req.params.historyId, req.params.id]
    );

    if (!history) {
      throw new AppError('History record not found', 404);
    }

    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// Update owner history (commissioner only)
leagueRoutes.put('/:id/history/:historyId', async (req, res, next) => {
  try {
    const allowedFields = [
      'owner_name', 'phone', 'titles', 'sb_appearances', 'division_titles',
      'playoff_appearances', 'total_winnings', 'total_buy_ins', 'net_winnings',
      'total_wins', 'total_losses', 'total_ties', 'total_points',
      'season_records', 'current_team_id', 'is_active'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'season_records' && typeof req.body[field] !== 'string') {
          updates.push(`${field} = $${paramIndex}`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    // Calculate win percentage if wins/losses changed
    if (req.body.total_wins !== undefined || req.body.total_losses !== undefined) {
      updates.push(`win_percentage = CASE WHEN (total_wins + total_losses + total_ties) > 0 THEN total_wins::decimal / (total_wins + total_losses + total_ties) ELSE 0 END`);
    }

    values.push(req.params.historyId);
    values.push(req.params.id);

    const history = await queryOne(
      `UPDATE league_history SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND league_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (!history) {
      throw new AppError('History record not found', 404);
    }

    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// Create new owner history (commissioner only)
leagueRoutes.post('/:id/history', async (req, res, next) => {
  try {
    const {
      owner_name,
      phone,
      titles = 0,
      sb_appearances = 0,
      division_titles = 0,
      playoff_appearances = 0,
      total_winnings = 0,
      total_buy_ins = 0,
      total_wins = 0,
      total_losses = 0,
      total_ties = 0,
      total_points = 0,
      season_records = [],
      current_team_id,
      is_active = true,
    } = req.body;

    if (!owner_name) {
      throw new AppError('owner_name is required', 400);
    }

    const net_winnings = total_winnings - total_buy_ins;
    const win_percentage = (total_wins + total_losses + total_ties) > 0
      ? total_wins / (total_wins + total_losses + total_ties)
      : 0;
    const legacy_score = (titles * 100) + (sb_appearances * 50) + (division_titles * 25) + (playoff_appearances * 10) + (win_percentage * 50);

    const history = await queryOne(
      `INSERT INTO league_history (
        league_id, owner_name, phone, titles, sb_appearances, division_titles,
        playoff_appearances, total_winnings, total_buy_ins, net_winnings,
        total_wins, total_losses, total_ties, total_points, win_percentage,
        legacy_score, season_records, current_team_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        req.params.id, owner_name, phone, titles, sb_appearances, division_titles,
        playoff_appearances, total_winnings, total_buy_ins, net_winnings,
        total_wins, total_losses, total_ties, total_points, win_percentage,
        legacy_score, JSON.stringify(season_records), current_team_id, is_active
      ]
    );

    res.status(201).json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// Sync season data from Sleeper API
// This fetches current season standings and updates/creates season records
leagueRoutes.post('/:id/history/sync-season', async (req, res, next) => {
  try {
    const { season } = req.body;
    const leagueId = req.params.id;

    // Get the league to get sleeper_league_id
    const league = await queryOne<League>(
      'SELECT * FROM leagues WHERE id = $1',
      [leagueId]
    );

    if (!league) {
      throw new AppError('League not found', 404);
    }

    const targetSeason = season || league.current_season;
    const sleeper = new SleeperService(league.sleeper_league_id);

    // Get rosters and users from Sleeper
    const [rosters, users] = await Promise.all([
      sleeper.getRosters(),
      sleeper.getUsers(),
    ]);

    // Create user lookup
    const userMap = new Map(users.map(u => [u.user_id, u]));

    const updates: any[] = [];

    // Process each roster
    for (const roster of rosters) {
      const user = userMap.get(roster.owner_id);
      if (!user) continue;

      const ownerName = user.display_name || user.username;
      const wins = roster.settings?.wins || 0;
      const losses = roster.settings?.losses || 0;
      const ties = roster.settings?.ties || 0;
      const points = (roster.settings?.fpts || 0) + ((roster.settings?.fpts_decimal || 0) / 100);

      // Get existing history record
      let historyRecord = await queryOne<any>(
        `SELECT * FROM league_history WHERE league_id = $1 AND owner_name = $2`,
        [leagueId, ownerName]
      );

      if (!historyRecord) {
        // Create new record
        historyRecord = await queryOne<any>(
          `INSERT INTO league_history (league_id, owner_name, is_active, season_records)
           VALUES ($1, $2, true, '[]')
           RETURNING *`,
          [leagueId, ownerName]
        );
      }

      // Parse existing season records
      let seasonRecords = [];
      try {
        seasonRecords = typeof historyRecord.season_records === 'string' 
          ? JSON.parse(historyRecord.season_records) 
          : (historyRecord.season_records || []);
      } catch (e) {
        seasonRecords = [];
      }

      // Find or create season record
      const existingSeasonIdx = seasonRecords.findIndex((s: any) => s.season === targetSeason);
      const seasonRecord = {
        season: targetSeason,
        wins,
        losses,
        ties,
        points,
        placing: null, // Will be calculated below
        playoffs: false, // Will need to be set manually or inferred
      };

      if (existingSeasonIdx >= 0) {
        seasonRecords[existingSeasonIdx] = { ...seasonRecords[existingSeasonIdx], ...seasonRecord };
      } else {
        seasonRecords.push(seasonRecord);
      }

      // Calculate totals from all season records
      const totalWins = seasonRecords.reduce((sum: number, s: any) => sum + (s.wins || 0), 0);
      const totalLosses = seasonRecords.reduce((sum: number, s: any) => sum + (s.losses || 0), 0);
      const totalTies = seasonRecords.reduce((sum: number, s: any) => sum + (s.ties || 0), 0);
      const totalPoints = seasonRecords.reduce((sum: number, s: any) => sum + (s.points || 0), 0);
      const totalGames = totalWins + totalLosses + totalTies;
      const winPct = totalGames > 0 ? totalWins / totalGames : 0;

      // Update record
      await query(
        `UPDATE league_history SET
           total_wins = $1,
           total_losses = $2,
           total_ties = $3,
           total_points = $4,
           win_percentage = $5,
           season_records = $6,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [totalWins, totalLosses, totalTies, totalPoints, winPct, JSON.stringify(seasonRecords), historyRecord.id]
      );

      updates.push({
        owner_name: ownerName,
        season: targetSeason,
        record: `${wins}-${losses}-${ties}`,
        points,
      });
    }

    // Calculate placing for this season based on points
    const sortedUpdates = [...updates].sort((a, b) => b.points - a.points);
    for (let i = 0; i < sortedUpdates.length; i++) {
      const owner = sortedUpdates[i];
      // Update the placing in season_records
      await query(
        `UPDATE league_history 
         SET season_records = (
           SELECT jsonb_agg(
             CASE 
               WHEN (elem->>'season')::int = $1 
               THEN elem || jsonb_build_object('placing', $2)
               ELSE elem
             END
           )
           FROM jsonb_array_elements(season_records) elem
         )
         WHERE league_id = $3 AND owner_name = $4`,
        [targetSeason, i + 1, leagueId, owner.owner_name]
      );
    }

    res.json({
      status: 'success',
      message: `Synced ${updates.length} owners for season ${targetSeason}`,
      data: {
        season: targetSeason,
        updated: updates,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================
// BUY-INS ENDPOINTS
// =============================================

// Get all buy-ins for a season
leagueRoutes.get('/:id/buy-ins', async (req, res, next) => {
  try {
    const { season } = req.query;
    const leagueId = req.params.id;

    // Get current season from league if not specified
    let targetSeason = season;
    if (!targetSeason) {
      const league = await queryOne<League>('SELECT current_season FROM leagues WHERE id = $1', [leagueId]);
      targetSeason = league?.current_season || 2026;
    }

    const buyIns = await query(
      `SELECT bi.*, t.team_name
       FROM league_buy_ins bi
       LEFT JOIN teams t ON bi.team_id = t.id
       WHERE bi.league_id = $1 AND bi.season = $2
       ORDER BY bi.status DESC, bi.owner_name`,
      [leagueId, targetSeason]
    );

    // Calculate totals
    const totals = buyIns.reduce((acc, bi) => ({
      total_due: acc.total_due + parseFloat(bi.amount_due || 0),
      total_paid: acc.total_paid + parseFloat(bi.amount_paid || 0),
      paid_count: acc.paid_count + (bi.status === 'paid' ? 1 : 0),
      partial_count: acc.partial_count + (bi.status === 'partial' ? 1 : 0),
      unpaid_count: acc.unpaid_count + (bi.status === 'unpaid' ? 1 : 0),
    }), { total_due: 0, total_paid: 0, paid_count: 0, partial_count: 0, unpaid_count: 0 });

    res.json({
      status: 'success',
      data: {
        season: targetSeason,
        buy_ins: buyIns,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get available seasons for buy-ins
leagueRoutes.get('/:id/buy-ins/seasons', async (req, res, next) => {
  try {
    const seasons = await query(
      `SELECT DISTINCT season FROM league_buy_ins WHERE league_id = $1 ORDER BY season DESC`,
      [req.params.id]
    );

    res.json({
      status: 'success',
      data: seasons.map((s: any) => s.season),
    });
  } catch (error) {
    next(error);
  }
});

// Update buy-in status (commissioner only)
leagueRoutes.put('/:id/buy-ins/:buyInId', async (req, res, next) => {
  try {
    const { amount_paid, status, payment_method, notes, paid_date } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (amount_paid !== undefined) {
      updates.push(`amount_paid = $${paramIndex}`);
      values.push(amount_paid);
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (payment_method !== undefined) {
      updates.push(`payment_method = $${paramIndex}`);
      values.push(payment_method);
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }

    if (paid_date !== undefined) {
      updates.push(`paid_date = $${paramIndex}`);
      values.push(paid_date);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    values.push(req.params.buyInId);
    values.push(req.params.id);

    const buyIn = await queryOne(
      `UPDATE league_buy_ins SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND league_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (!buyIn) {
      throw new AppError('Buy-in record not found', 404);
    }

    res.json({
      status: 'success',
      data: buyIn,
    });
  } catch (error) {
    next(error);
  }
});

// Create buy-in records for a season (commissioner only)
leagueRoutes.post('/:id/buy-ins/initialize', async (req, res, next) => {
  try {
    const { season, amount_due = 200 } = req.body;
    const leagueId = req.params.id;

    if (!season) {
      throw new AppError('season is required', 400);
    }

    // Get all teams in the league
    const teams = await query(
      'SELECT id, team_name, owner_name FROM teams WHERE league_id = $1',
      [leagueId]
    );

    if (teams.length === 0) {
      throw new AppError('No teams found in league', 404);
    }

    const results = [];
    for (const team of teams) {
      const buyIn = await queryOne(
        `INSERT INTO league_buy_ins (league_id, team_id, season, owner_name, amount_due)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (league_id, team_id, season) DO NOTHING
         RETURNING *`,
        [leagueId, team.id, season, team.owner_name, amount_due]
      );
      if (buyIn) results.push(buyIn);
    }

    res.status(201).json({
      status: 'success',
      data: {
        season,
        created: results.length,
        buy_ins: results,
      },
    });
  } catch (error) {
    next(error);
  }
});
