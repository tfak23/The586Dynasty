import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { SleeperService } from '../services/sleeper.js';

export const syncRoutes = Router();

// Dead cap percentages by original contract length and year into contract
const DEAD_CAP_PERCENTAGES: Record<number, number[]> = {
  5: [0.75, 0.50, 0.25, 0.10, 0.10],
  4: [0.75, 0.50, 0.25, 0.10],
  3: [0.50, 0.25, 0.10],
  2: [0.50, 0.25],
  1: [0.50],
};

// Helper function to calculate dead cap for a contract
function calculateDeadCap(contract: any, currentSeason: number): number {
  if (contract.salary <= 1) {
    // $1 contracts retain full cap hit
    return parseFloat(contract.salary);
  }

  const yearsIntoContract = currentSeason - contract.start_season;
  const percentages = DEAD_CAP_PERCENTAGES[contract.years_total] || [];
  const percentage = percentages[yearsIntoContract] || 0;
  return Math.round(parseFloat(contract.salary) * percentage * 100) / 100;
}

// Sync all data from Sleeper for a league
syncRoutes.post('/league/:leagueId/full', async (req, res, next) => {
  try {
    const league = await queryOne(
      'SELECT * FROM leagues WHERE id = $1',
      [req.params.leagueId]
    );
    
    if (!league) {
      throw new AppError('League not found', 404);
    }
    
    const sleeper = new SleeperService(league.sleeper_league_id);
    
    // Log sync start
    const syncLog = await queryOne(
      `INSERT INTO sync_log (league_id, sync_type, status)
       VALUES ($1, 'full', 'started') RETURNING *`,
      [req.params.leagueId]
    );
    
    try {
      // Sync league info
      const leagueData = await sleeper.getLeague();
      await execute(
        `UPDATE leagues SET 
          name = $1, total_rosters = $2, roster_positions = $3, scoring_settings = $4
         WHERE id = $5`,
        [leagueData.name, leagueData.total_rosters, 
         JSON.stringify(leagueData.roster_positions), 
         JSON.stringify(leagueData.scoring_settings),
         req.params.leagueId]
      );
      
      // Sync users and teams
      const users = await sleeper.getUsers();
      const rosters = await sleeper.getRosters();
      
      for (const roster of rosters) {
        const user = users.find(u => u.user_id === roster.owner_id);
        
        await execute(
          `INSERT INTO teams (league_id, sleeper_roster_id, sleeper_user_id, team_name, owner_name, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (league_id, sleeper_roster_id) 
           DO UPDATE SET sleeper_user_id = $3, team_name = $4, owner_name = $5, avatar_url = $6`,
          [req.params.leagueId, roster.roster_id, roster.owner_id,
           user?.metadata?.team_name || user?.display_name || 'Unknown',
           user?.display_name || 'Unknown',
           user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null]
        );
      }
      
      // Sync players (fetch from Sleeper if not already in DB)
      const allPlayers = await sleeper.getAllPlayers();
      let playersProcessed = 0;
      
      // Only sync players that are on rosters
      const rosterPlayerIds = new Set<string>();
      for (const roster of rosters) {
        if (roster.players) {
          roster.players.forEach((id: string) => rosterPlayerIds.add(id));
        }
      }
      
      for (const playerId of rosterPlayerIds) {
        const playerData = allPlayers[playerId];
        if (playerData && ['QB', 'RB', 'WR', 'TE'].includes(playerData.position)) {
          await execute(
            `INSERT INTO players (sleeper_player_id, full_name, first_name, last_name, position, team, age, years_exp, college, number, status, search_full_name, search_last_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (sleeper_player_id) 
             DO UPDATE SET full_name = $2, position = $5, team = $6, age = $7, years_exp = $8, status = $11, updated_at = CURRENT_TIMESTAMP`,
            [playerId, playerData.full_name, playerData.first_name, playerData.last_name,
             playerData.position, playerData.team, playerData.age, playerData.years_exp,
             playerData.college, playerData.number, playerData.status,
             playerData.full_name?.toLowerCase(), playerData.last_name?.toLowerCase()]
          );
          playersProcessed++;
        }
      }
      
      // Log sync completion
      await execute(
        `UPDATE sync_log SET status = 'completed', records_processed = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [playersProcessed, syncLog?.id]
      );
      
      res.json({
        status: 'success',
        data: {
          league_updated: true,
          teams_synced: rosters.length,
          players_synced: playersProcessed,
        },
      });
    } catch (error) {
      // Log sync failure
      await execute(
        `UPDATE sync_log SET status = 'failed', errors = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify({ message: (error as Error).message }), syncLog?.id]
      );
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Sync rosters only (lighter sync) - automatically releases dropped players with dead cap
syncRoutes.post('/league/:leagueId/rosters', async (req, res, next) => {
  try {
    const league = await queryOne(
      'SELECT * FROM leagues WHERE id = $1',
      [req.params.leagueId]
    );

    if (!league) {
      throw new AppError('League not found', 404);
    }

    const currentSeason = league.current_season || 2025;
    const sleeper = new SleeperService(league.sleeper_league_id);
    const rosters = await sleeper.getRosters();

    // Get current roster players from DB for comparison
    const teams = await query('SELECT * FROM teams WHERE league_id = $1', [req.params.leagueId]);

    const changes = {
      additions: [] as any[],
      removals: [] as any[],
    };

    const releasedContracts: any[] = [];

    for (const roster of rosters) {
      const team = teams.find(t => t.sleeper_roster_id === roster.roster_id);
      if (!team) continue;

      // Get current contracts for this team
      const currentContracts = await query(
        `SELECT c.*, p.sleeper_player_id, p.full_name
         FROM contracts c
         JOIN players p ON c.player_id = p.id
         WHERE c.team_id = $1 AND c.status = 'active'`,
        [team.id]
      );

      const currentPlayerIds = new Set(currentContracts.map(c => c.sleeper_player_id));
      const sleeperPlayerIds = new Set(roster.players || []);

      // Find additions (on Sleeper but not in our DB)
      for (const playerId of sleeperPlayerIds) {
        if (!currentPlayerIds.has(playerId)) {
          changes.additions.push({
            team_id: team.id,
            team_name: team.team_name,
            sleeper_player_id: playerId,
          });
        }
      }

      // Find removals (in our DB but not on Sleeper) - AUTO RELEASE WITH DEAD CAP
      for (const playerId of currentPlayerIds) {
        if (!sleeperPlayerIds.has(playerId)) {
          const contract = currentContracts.find(c => c.sleeper_player_id === playerId);
          if (contract) {
            // Calculate dead cap
            const deadCap = calculateDeadCap(contract, currentSeason);

            // Update contract to released status
            await execute(
              `UPDATE contracts
               SET status = 'released',
                   released_at = CURRENT_TIMESTAMP,
                   release_reason = 'dropped',
                   dead_cap_hit = $1
               WHERE id = $2`,
              [deadCap, contract.id]
            );

            // Log dead cap transaction
            if (deadCap > 0) {
              await execute(
                `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id)
                 VALUES ($1, $2, $3, 'dead_money', $4, $5, $6)`,
                [league.id, team.id, currentSeason, deadCap, `Dead cap from drop: ${contract.full_name}`, contract.id]
              );
            }

            const releaseInfo = {
              team_id: team.id,
              team_name: team.team_name,
              sleeper_player_id: playerId,
              contract_id: contract.id,
              player_name: contract.full_name,
              salary: parseFloat(contract.salary),
              dead_cap: deadCap,
              cap_savings: parseFloat(contract.salary) - deadCap,
            };

            changes.removals.push(releaseInfo);
            releasedContracts.push(releaseInfo);
          }
        }
      }
    }

    // Log sync activity if there were any releases
    if (releasedContracts.length > 0) {
      await execute(
        `INSERT INTO sync_log (league_id, sync_type, status, records_processed, completed_at)
         VALUES ($1, 'roster_releases', 'completed', $2, CURRENT_TIMESTAMP)`,
        [req.params.leagueId, releasedContracts.length]
      );
    }

    res.json({
      status: 'success',
      data: {
        synced_at: new Date().toISOString(),
        additions_detected: changes.additions.length,
        removals_detected: changes.removals.length,
        players_released: releasedContracts.length,
        total_dead_cap_applied: releasedContracts.reduce((sum, r) => sum + r.dead_cap, 0),
        changes,
        released_contracts: releasedContracts,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Initialize league from Sleeper (first-time setup)
syncRoutes.post('/initialize', async (req, res, next) => {
  try {
    const { sleeper_league_id } = req.body;
    
    if (!sleeper_league_id) {
      throw new AppError('sleeper_league_id is required', 400);
    }
    
    // Check if league already exists
    const existing = await queryOne(
      'SELECT * FROM leagues WHERE sleeper_league_id = $1',
      [sleeper_league_id]
    );
    
    if (existing) {
      throw new AppError('League already initialized', 409);
    }
    
    const sleeper = new SleeperService(sleeper_league_id);
    
    // Fetch league data
    const leagueData = await sleeper.getLeague();
    const users = await sleeper.getUsers();
    const rosters = await sleeper.getRosters();
    
    // Create league
    const league = await queryOne(
      `INSERT INTO leagues (sleeper_league_id, name, total_rosters, roster_positions, scoring_settings, current_season)
       VALUES ($1, $2, $3, $4, $5, 2025) RETURNING *`,
      [sleeper_league_id, leagueData.name, leagueData.total_rosters,
       JSON.stringify(leagueData.roster_positions), JSON.stringify(leagueData.scoring_settings)]
    );
    
    // Create teams
    const createdTeams = [];
    for (const roster of rosters) {
      const user = users.find(u => u.user_id === roster.owner_id);
      
      const team = await queryOne(
        `INSERT INTO teams (league_id, sleeper_roster_id, sleeper_user_id, team_name, owner_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [league?.id, roster.roster_id, roster.owner_id,
         user?.metadata?.team_name || user?.display_name || 'Team ' + roster.roster_id,
         user?.display_name || 'Unknown',
         user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null]
      );
      createdTeams.push(team);
    }
    
    // Set first user as primary commissioner (can be changed later)
    if (createdTeams.length > 0) {
      await execute(
        `INSERT INTO league_commissioners (league_id, team_id, is_primary)
         VALUES ($1, $2, true)`,
        [league?.id, createdTeams[0].id]
      );
    }
    
    res.status(201).json({
      status: 'success',
      data: {
        league,
        teams_created: createdTeams.length,
        message: 'League initialized! Now import your CSV data to create contracts.',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get sync history
syncRoutes.get('/league/:leagueId/history', async (req, res, next) => {
  try {
    const history = await query(
      `SELECT * FROM sync_log WHERE league_id = $1 ORDER BY started_at DESC LIMIT 20`,
      [req.params.leagueId]
    );
    
    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
});
