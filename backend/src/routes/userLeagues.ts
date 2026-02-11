import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { apiLimiter, leagueOperationLimiter } from '../middleware/rateLimiter.js';
import { SleeperService } from '../services/sleeper.js';

const router = Router();

// Get current season (can be overridden by env var)
const getCurrentSeason = () => {
  const envSeason = process.env.CURRENT_SEASON;
  if (envSeason) return envSeason;
  
  // Default to current year, switching to next year in February
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  return month >= 1 ? String(year) : String(year - 1); // After Feb 1, use current year
};

/**
 * GET /api/user-leagues/discover
 * Discover leagues for the authenticated user's Sleeper account
 */
router.get('/discover', apiLimiter, authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user's Sleeper account
    const sleeperResult = await pool.query(
      'SELECT sleeper_user_id FROM sleeper_accounts WHERE user_id = $1',
      [req.user.id]
    );

    if (sleeperResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No Sleeper account linked. Please link your Sleeper account first.' 
      });
    }

    const sleeperUserId = sleeperResult.rows[0].sleeper_user_id;
    const season = req.query.season as string || getCurrentSeason();

    // Get leagues from Sleeper
    const sleeperLeagues = await SleeperService.getUserLeagues(sleeperUserId, season);

    // Check which leagues are already registered as salary cap leagues
    const leagueIds = sleeperLeagues.map(l => l.league_id);
    
    const registeredLeagues = await pool.query(
      `SELECT sleeper_league_id, id, name, is_salary_cap_league
       FROM leagues 
       WHERE sleeper_league_id = ANY($1)`,
      [leagueIds]
    );

    const registeredMap = new Map<string, any>(
      registeredLeagues.rows.map(l => [l.sleeper_league_id, l])
    );

    // Check which leagues the user has already joined
    const userLeagues = await pool.query(
      `SELECT l.sleeper_league_id
       FROM user_league_associations ula
       JOIN leagues l ON ula.league_id = l.id
       WHERE ula.user_id = $1 AND ula.status = 'active'`,
      [req.user.id]
    );

    const joinedLeagueIds = new Set(
      userLeagues.rows.map(l => l.sleeper_league_id)
    );

    // Format response
    const leagues = sleeperLeagues.map(league => {
      const registered = registeredMap.get(league.league_id);
      const isJoined = joinedLeagueIds.has(league.league_id);
      
      return {
        sleeper_league_id: league.league_id,
        name: league.name,
        season: league.season,
        total_rosters: league.total_rosters,
        status: league.status,
        is_registered: !!registered,
        is_salary_cap_league: registered ? registered.is_salary_cap_league : false,
        app_league_id: registered ? registered.id : undefined,
        user_status: isJoined ? 'joined' : 'not_joined',
        action: isJoined 
          ? 'already_joined'
          : (registered && registered.is_salary_cap_league)
            ? 'join_league' 
            : 'convert_to_salary_cap',
      };
    });

    res.json({
      success: true,
      data: {
        season,
        sleeper_user_id: sleeperUserId,
        leagues,
      },
    });
  } catch (error) {
    console.error('Discover leagues error:', error);
    res.status(500).json({ error: 'Failed to discover leagues' });
  }
});

/**
 * POST /api/user-leagues/convert
 * Convert a Sleeper league to a Salary Cap league
 * The user becomes the commissioner
 */
router.post('/convert', leagueOperationLimiter, authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { sleeper_league_id } = req.body;

    if (!sleeper_league_id) {
      return res.status(400).json({ error: 'Sleeper league ID is required' });
    }

    // Get user's Sleeper account
    const sleeperResult = await client.query(
      'SELECT sleeper_user_id FROM sleeper_accounts WHERE user_id = $1',
      [req.user.id]
    );

    if (sleeperResult.rows.length === 0) {
      return res.status(404).json({ error: 'No Sleeper account linked' });
    }

    const sleeperUserId = sleeperResult.rows[0].sleeper_user_id;

    // Verify user is part of this league
    const userLeagues = await SleeperService.getUserLeagues(sleeperUserId, getCurrentSeason());
    const targetLeague = userLeagues.find(l => l.league_id === sleeper_league_id);

    if (!targetLeague) {
      return res.status(403).json({ 
        error: 'You are not a member of this Sleeper league' 
      });
    }

    // Check if league is already registered
    const existingLeague = await client.query(
      'SELECT id, is_salary_cap_league FROM leagues WHERE sleeper_league_id = $1',
      [sleeper_league_id]
    );

    if (existingLeague.rows.length > 0 && existingLeague.rows[0].is_salary_cap_league) {
      return res.status(409).json({ 
        error: 'This league is already registered as a Salary Cap league' 
      });
    }

    await client.query('BEGIN');

    // Create or update the league
    let leagueId;
    
    if (existingLeague.rows.length > 0) {
      // Update existing league
      await client.query(
        `UPDATE leagues 
         SET is_salary_cap_league = true, created_by_user_id = $1
         WHERE id = $2`,
        [req.user.id, existingLeague.rows[0].id]
      );
      leagueId = existingLeague.rows[0].id;
    } else {
      // Create new league
      const leagueResult = await client.query(
        `INSERT INTO leagues (
          sleeper_league_id, name, total_rosters, current_season, 
          is_salary_cap_league, created_by_user_id
        ) VALUES ($1, $2, $3, $4, true, $5)
        RETURNING id`,
        [
          sleeper_league_id,
          targetLeague.name,
          targetLeague.total_rosters,
          parseInt(targetLeague.season),
          req.user.id,
        ]
      );
      leagueId = leagueResult.rows[0].id;
    }

    // Get or create the user's team in this league
    // First, get rosters from Sleeper to find the user's team
    const sleeperService = new SleeperService(sleeper_league_id);
    const rosters = await sleeperService.getRosters();
    const users = await sleeperService.getUsers();
    
    const userRoster = rosters.find(r => r.owner_id === sleeperUserId);
    
    if (!userRoster) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Could not find your team in this league' });
    }

    const sleeperUser = users.find(u => u.user_id === sleeperUserId);

    // Create or get team
    let teamResult = await client.query(
      `SELECT id FROM teams 
       WHERE league_id = $1 AND sleeper_roster_id = $2`,
      [leagueId, userRoster.roster_id]
    );

    let teamId;
    
    if (teamResult.rows.length === 0) {
      // Create team
      teamResult = await client.query(
        `INSERT INTO teams (
          league_id, sleeper_roster_id, sleeper_user_id, 
          team_name, owner_name, avatar_url
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          leagueId,
          userRoster.roster_id,
          sleeperUserId,
          sleeperUser?.metadata?.team_name || `Team ${userRoster.roster_id}`,
          sleeperUser?.display_name || sleeperUser?.username,
          sleeperUser?.avatar ? `https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}` : null,
        ]
      );
      teamId = teamResult.rows[0].id;
    } else {
      teamId = teamResult.rows[0].id;
    }

    // Create user-league association (user becomes member and commissioner)
    await client.query(
      `INSERT INTO user_league_associations (user_id, league_id, team_id, is_commissioner, status)
       VALUES ($1, $2, $3, true, 'active')
       ON CONFLICT (user_id, league_id) 
       DO UPDATE SET is_commissioner = true, status = 'active'`,
      [req.user.id, leagueId, teamId]
    );

    // Also add to league_commissioners table
    await client.query(
      `INSERT INTO league_commissioners (league_id, team_id, is_primary)
       VALUES ($1, $2, true)
       ON CONFLICT (league_id, team_id) DO NOTHING`,
      [leagueId, teamId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'League successfully converted to Salary Cap League',
      data: {
        league_id: leagueId,
        sleeper_league_id,
        name: targetLeague.name,
        team_id: teamId,
        is_commissioner: true,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Convert league error:', error);
    res.status(500).json({ error: 'Failed to convert league' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/user-leagues/join
 * Join an existing Salary Cap league
 */
router.post('/join', leagueOperationLimiter, authenticateToken, async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { sleeper_league_id } = req.body;

    if (!sleeper_league_id) {
      return res.status(400).json({ error: 'Sleeper league ID is required' });
    }

    // Get user's Sleeper account
    const sleeperResult = await client.query(
      'SELECT sleeper_user_id FROM sleeper_accounts WHERE user_id = $1',
      [req.user.id]
    );

    if (sleeperResult.rows.length === 0) {
      return res.status(404).json({ error: 'No Sleeper account linked' });
    }

    const sleeperUserId = sleeperResult.rows[0].sleeper_user_id;

    // Verify league exists and is a salary cap league
    const leagueResult = await client.query(
      `SELECT id, name, is_salary_cap_league FROM leagues 
       WHERE sleeper_league_id = $1`,
      [sleeper_league_id]
    );

    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'League not found. Please ask the commissioner to convert it first.' 
      });
    }

    const league = leagueResult.rows[0];

    if (!league.is_salary_cap_league) {
      return res.status(400).json({ 
        error: 'This league is not a Salary Cap league yet' 
      });
    }

    // Check if user is already a member
    const existingMember = await client.query(
      `SELECT id FROM user_league_associations 
       WHERE user_id = $1 AND league_id = $2 AND status = 'active'`,
      [req.user.id, league.id]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'You are already a member of this league' });
    }

    // Verify user is part of this league on Sleeper
    const userLeagues = await SleeperService.getUserLeagues(sleeperUserId, '2025');
    const targetLeague = userLeagues.find(l => l.league_id === sleeper_league_id);

    if (!targetLeague) {
      return res.status(403).json({ 
        error: 'You are not a member of this Sleeper league' 
      });
    }

    await client.query('BEGIN');

    // Get or create the user's team in this league
    const sleeperService = new SleeperService(sleeper_league_id);
    const rosters = await sleeperService.getRosters();
    const users = await sleeperService.getUsers();
    
    const userRoster = rosters.find(r => r.owner_id === sleeperUserId);
    
    if (!userRoster) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Could not find your team in this league' });
    }

    const sleeperUser = users.find(u => u.user_id === sleeperUserId);

    // Create or get team
    let teamResult = await client.query(
      `SELECT id FROM teams 
       WHERE league_id = $1 AND sleeper_roster_id = $2`,
      [league.id, userRoster.roster_id]
    );

    let teamId;
    
    if (teamResult.rows.length === 0) {
      // Create team
      teamResult = await client.query(
        `INSERT INTO teams (
          league_id, sleeper_roster_id, sleeper_user_id, 
          team_name, owner_name, avatar_url
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [
          league.id,
          userRoster.roster_id,
          sleeperUserId,
          sleeperUser?.metadata?.team_name || `Team ${userRoster.roster_id}`,
          sleeperUser?.display_name || sleeperUser?.username,
          sleeperUser?.avatar ? `https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}` : null,
        ]
      );
      teamId = teamResult.rows[0].id;
    } else {
      teamId = teamResult.rows[0].id;
    }

    // Create user-league association
    await client.query(
      `INSERT INTO user_league_associations (user_id, league_id, team_id, is_commissioner, status)
       VALUES ($1, $2, $3, false, 'active')
       ON CONFLICT (user_id, league_id) 
       DO UPDATE SET status = 'active'`,
      [req.user.id, league.id, teamId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Successfully joined the league',
      data: {
        league_id: league.id,
        sleeper_league_id,
        name: league.name,
        team_id: teamId,
        is_commissioner: false,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Join league error:', error);
    res.status(500).json({ error: 'Failed to join league' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/user-leagues/my-leagues
 * Get all leagues the authenticated user has joined
 */
router.get('/my-leagues', apiLimiter, authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      `SELECT 
        l.id as league_id,
        l.sleeper_league_id,
        l.name as league_name,
        l.salary_cap,
        l.current_season,
        t.id as team_id,
        t.team_name,
        t.owner_name,
        ula.is_commissioner,
        ula.joined_at
       FROM user_league_associations ula
       JOIN leagues l ON ula.league_id = l.id
       JOIN teams t ON ula.team_id = t.id
       WHERE ula.user_id = $1 AND ula.status = 'active'
       ORDER BY l.name`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get my leagues error:', error);
    res.status(500).json({ error: 'Failed to get leagues' });
  }
});

export const userLeaguesRoutes = router;
