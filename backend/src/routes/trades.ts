import { Router } from 'express';
import { query, queryOne, execute } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Trade, ApiResponse } from '../types/index.js';

export const tradeRoutes = Router();

// Get all trades for a league
// Supports visibility rules: pending trades only visible to involved teams
// Supports 'past' filter for rejected/cancelled/vetoed trades from current season
tradeRoutes.get('/league/:leagueId', async (req, res, next) => {
  try {
    const { status, team_id } = req.query;

    // Get league's current season
    const league = await queryOne('SELECT current_season FROM leagues WHERE id = $1', [req.params.leagueId]);
    const currentSeason = league?.current_season || new Date().getFullYear();

    let sql = `SELECT * FROM trades WHERE league_id = $1`;
    const params: any[] = [req.params.leagueId];
    let paramIndex = 2;

    if (status === 'past') {
      // Past trades: rejected, cancelled, or vetoed from current season
      sql += ` AND status IN ('rejected', 'cancelled', 'vetoed')
               AND EXTRACT(YEAR FROM created_at) = $${paramIndex}`;
      params.push(currentSeason);
      paramIndex++;
    } else if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';

    const trades = await query(sql, params);

    // Get trade teams and assets for each trade
    const tradesWithDetails = await Promise.all(
      trades.map(async (trade) => {
        const teams = await query(
          `SELECT tt.*, t.team_name, t.owner_name
           FROM trade_teams tt
           JOIN teams t ON tt.team_id = t.id
           WHERE tt.trade_id = $1`,
          [trade.id]
        );

        const assets = await query(
          `SELECT ta.*,
                  c.salary, c.years_remaining,
                  p.full_name as player_name, p.position,
                  ft.team_name as from_team_name,
                  tt.team_name as to_team_name
           FROM trade_assets ta
           LEFT JOIN contracts c ON ta.contract_id = c.id
           LEFT JOIN players p ON c.player_id = p.id
           LEFT JOIN teams ft ON ta.from_team_id = ft.id
           LEFT JOIN teams tt ON ta.to_team_id = tt.id
           WHERE ta.trade_id = $1`,
          [trade.id]
        );

        return { ...trade, teams, assets };
      })
    );

    // Apply visibility rules:
    // - Pending trades: only visible to involved teams (if team_id provided)
    // - Accepted/completed trades: visible to all
    let filteredTrades = tradesWithDetails;
    if (team_id) {
      filteredTrades = tradesWithDetails.filter((trade: any) => {
        // Pending trades only visible to involved teams
        if (trade.status === 'pending') {
          return trade.teams?.some((t: any) => t.team_id === team_id);
        }
        // All other trades visible to everyone
        return true;
      });
    }

    res.json({
      status: 'success',
      data: filteredTrades,
    });
  } catch (error) {
    next(error);
  }
});

// Get trade by ID
tradeRoutes.get('/:id', async (req, res, next) => {
  try {
    const trade = await queryOne<Trade>(
      'SELECT * FROM trades WHERE id = $1',
      [req.params.id]
    );
    
    if (!trade) {
      throw new AppError('Trade not found', 404);
    }
    
    const teams = await query(
      `SELECT tt.*, t.team_name, t.owner_name
       FROM trade_teams tt
       JOIN teams t ON tt.team_id = t.id
       WHERE tt.trade_id = $1`,
      [req.params.id]
    );
    
    const assets = await query(
      `SELECT ta.*, 
              c.salary, c.years_remaining,
              p.full_name as player_name, p.position,
              ft.team_name as from_team_name,
              tt.team_name as to_team_name,
              dp.season, dp.round, dp.pick_number,
              ot.team_name as original_team_name
       FROM trade_assets ta
       LEFT JOIN contracts c ON ta.contract_id = c.id
       LEFT JOIN players p ON c.player_id = p.id
       LEFT JOIN teams ft ON ta.from_team_id = ft.id
       LEFT JOIN teams tt ON ta.to_team_id = tt.id
       LEFT JOIN draft_picks dp ON ta.draft_pick_id = dp.id
       LEFT JOIN teams ot ON dp.original_team_id = ot.id
       WHERE ta.trade_id = $1`,
      [req.params.id]
    );
    
    const votes = await query(
      `SELECT tv.*, t.team_name, t.owner_name
       FROM trade_votes tv
       JOIN teams t ON tv.team_id = t.id
       WHERE tv.trade_id = $1`,
      [req.params.id]
    );
    
    // Transform assets into assets_receiving for each team
    const teamsWithAssets = teams.map((team: any) => {
      const assetsReceiving = assets
        .filter((asset: any) => asset.to_team_id === team.team_id)
        .map((asset: any) => {
          if (asset.asset_type === 'contract') {
            return {
              type: 'player',
              player_name: asset.player_name,
              position: asset.position,
              salary: asset.salary,
              years_remaining: asset.years_remaining,
              from_team_name: asset.from_team_name,
            };
          } else if (asset.asset_type === 'draft_pick') {
            return {
              type: 'pick',
              season: asset.season,
              round: asset.round,
              pick_number: asset.pick_number,
              original_team_name: asset.original_team_name,
              from_team_name: asset.from_team_name,
            };
          } else if (asset.asset_type === 'cap_space') {
            return {
              type: 'cap',
              cap_amount: asset.cap_amount,
              cap_year: asset.cap_year,
              from_team_name: asset.from_team_name,
            };
          }
          return asset;
        });
      
      return { ...team, assets_receiving: assetsReceiving };
    });
    
    res.json({
      status: 'success',
      data: { ...trade, teams: teamsWithAssets, assets, votes },
    } as ApiResponse<Trade & { teams: any[]; assets: any[]; votes: any[] }>);
  } catch (error) {
    next(error);
  }
});

// Create new trade proposal
tradeRoutes.post('/', async (req, res, next) => {
  try {
    const {
      league_id,
      team_ids, // Array of team IDs involved
      assets, // Array of { from_team_id, to_team_id, asset_type, contract_id?, draft_pick_id?, cap_amount? }
      expires_in = '24h', // '1h', '24h', '2d', '1w'
      notes,
      proposer_team_id, // The team that created the trade proposal
    } = req.body;
    
    if (!league_id || !team_ids || team_ids.length < 2 || !assets || assets.length === 0) {
      throw new AppError('league_id, at least 2 team_ids, and assets are required', 400);
    }
    
    // Get league settings
    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [league_id]);
    if (!league) {
      throw new AppError('League not found', 404);
    }
    
    // Calculate expiration time
    const expiresAt = new Date();
    switch (expires_in) {
      case '1h': expiresAt.setHours(expiresAt.getHours() + 1); break;
      case '24h': expiresAt.setHours(expiresAt.getHours() + 24); break;
      case '2d': expiresAt.setDate(expiresAt.getDate() + 2); break;
      case '1w': expiresAt.setDate(expiresAt.getDate() + 7); break;
      default: expiresAt.setHours(expiresAt.getHours() + 24);
    }
    
    // Validate all contracts involved have cap room on receiving teams
    for (const asset of assets) {
      if (asset.asset_type === 'contract' && asset.contract_id) {
        const contract = await queryOne('SELECT * FROM contracts WHERE id = $1', [asset.contract_id]);
        const receivingTeamCap = await queryOne(
          'SELECT * FROM team_cap_summary WHERE team_id = $1',
          [asset.to_team_id]
        );
        
        if (contract && receivingTeamCap) {
          if (parseFloat(receivingTeamCap.cap_room) < parseFloat(contract.salary)) {
            const team = await queryOne('SELECT team_name FROM teams WHERE id = $1', [asset.to_team_id]);
            throw new AppError(
              `${team?.team_name || 'Receiving team'} doesn't have enough cap room for this trade`,
              400
            );
          }
        }
      }
    }
    
    // Create trade
    const trade = await queryOne<Trade>(
      `INSERT INTO trades (
        league_id, status, approval_mode,
        requires_commissioner_approval, requires_league_vote,
        vote_deadline, expires_at, notes, proposer_team_id
      ) VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        league_id,
        league.trade_approval_mode,
        league.trade_approval_mode === 'commissioner',
        league.trade_approval_mode === 'league_vote',
        league.trade_approval_mode === 'league_vote'
          ? new Date(Date.now() + league.league_vote_window_hours * 60 * 60 * 1000)
          : null,
        expiresAt,
        notes,
        proposer_team_id || team_ids[0], // Default to first team if not specified
      ]
    );
    
    // Add trade teams
    // The proposer automatically has 'accepted' status since they created the trade
    const proposerId = proposer_team_id || team_ids[0];
    for (const teamId of team_ids) {
      const teamStatus = teamId === proposerId ? 'accepted' : 'pending';
      await execute(
        `INSERT INTO trade_teams (trade_id, team_id, status) VALUES ($1, $2, $3)`,
        [trade?.id, teamId, teamStatus]
      );
    }
    
    // Add trade assets
    for (const asset of assets) {
      await execute(
        `INSERT INTO trade_assets (trade_id, from_team_id, to_team_id, asset_type, contract_id, draft_pick_id, cap_amount, cap_year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [trade?.id, asset.from_team_id, asset.to_team_id, asset.asset_type,
         asset.contract_id, asset.draft_pick_id, asset.cap_amount, asset.cap_year || 2026]
      );
    }
    
    res.status(201).json({
      status: 'success',
      data: trade,
    } as ApiResponse<Trade>);
  } catch (error) {
    next(error);
  }
});

// Accept trade (by a participating team)
tradeRoutes.post('/:id/accept', async (req, res, next) => {
  try {
    const { team_id } = req.body;
    
    if (!team_id) {
      throw new AppError('team_id is required', 400);
    }
    
    // Update team's acceptance
    const updated = await execute(
      `UPDATE trade_teams SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
       WHERE trade_id = $1 AND team_id = $2 AND status = 'pending'`,
      [req.params.id, team_id]
    );
    
    if (updated === 0) {
      throw new AppError('Team is not part of this trade or already responded', 400);
    }
    
    // Check if all teams have accepted
    const pendingTeams = await query(
      `SELECT * FROM trade_teams WHERE trade_id = $1 AND status = 'pending'`,
      [req.params.id]
    );
    
    if (pendingTeams.length === 0) {
      // All teams accepted - proceed based on approval mode
      const trade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [req.params.id]);
      
      if (trade?.approval_mode === 'auto') {
        // Auto-approve: execute trade immediately
        await executeTrade(req.params.id);
        await execute(
          `UPDATE trades SET status = 'completed' WHERE id = $1`,
          [req.params.id]
        );
      } else if (trade?.approval_mode === 'commissioner') {
        // Waiting for commissioner approval
        await execute(
          `UPDATE trades SET status = 'accepted' WHERE id = $1`,
          [req.params.id]
        );
      } else if (trade?.approval_mode === 'league_vote') {
        // Start league voting period
        await execute(
          `UPDATE trades SET status = 'accepted' WHERE id = $1`,
          [req.params.id]
        );
      }
    }
    
    const trade = await queryOne('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    
    res.json({
      status: 'success',
      data: trade,
      message: pendingTeams.length === 0 ? 'All teams accepted' : `Waiting for ${pendingTeams.length} more team(s)`,
    });
  } catch (error) {
    next(error);
  }
});

// Reject trade (by a participating team)
tradeRoutes.post('/:id/reject', async (req, res, next) => {
  try {
    const { team_id } = req.body;
    
    if (!team_id) {
      throw new AppError('team_id is required', 400);
    }
    
    await execute(
      `UPDATE trade_teams SET status = 'rejected' WHERE trade_id = $1 AND team_id = $2`,
      [req.params.id, team_id]
    );
    
    await execute(
      `UPDATE trades SET status = 'rejected' WHERE id = $1`,
      [req.params.id]
    );
    
    res.json({
      status: 'success',
      message: 'Trade rejected',
    });
  } catch (error) {
    next(error);
  }
});

// Commissioner approve trade
tradeRoutes.post('/:id/commissioner-approve', async (req, res, next) => {
  try {
    const { commissioner_team_id } = req.body;
    
    if (!commissioner_team_id) {
      throw new AppError('commissioner_team_id is required', 400);
    }
    
    const trade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    if (!trade) {
      throw new AppError('Trade not found', 404);
    }
    
    // Verify commissioner
    const isCommissioner = await queryOne(
      `SELECT * FROM league_commissioners WHERE league_id = $1 AND team_id = $2`,
      [trade.league_id, commissioner_team_id]
    );
    
    if (!isCommissioner) {
      throw new AppError('Only commissioners can approve trades', 403);
    }
    
    // Execute the trade
    await executeTrade(req.params.id);
    
    await execute(
      `UPDATE trades SET status = 'completed', commissioner_approved_by = $1, commissioner_approved_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [commissioner_team_id, req.params.id]
    );
    
    res.json({
      status: 'success',
      message: 'Trade approved and completed',
    });
  } catch (error) {
    next(error);
  }
});

// Vote on trade (for league_vote mode)
tradeRoutes.post('/:id/vote', async (req, res, next) => {
  try {
    const { team_id, vote } = req.body; // vote: 'approve' or 'veto'
    
    if (!team_id || !vote) {
      throw new AppError('team_id and vote are required', 400);
    }
    
    if (!['approve', 'veto'].includes(vote)) {
      throw new AppError('vote must be "approve" or "veto"', 400);
    }
    
    const trade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    if (!trade) {
      throw new AppError('Trade not found', 404);
    }
    
    if (trade.status !== 'accepted') {
      throw new AppError('Trade is not in voting phase', 400);
    }
    
    if (trade.vote_deadline && new Date() > new Date(trade.vote_deadline)) {
      throw new AppError('Voting period has ended', 400);
    }
    
    // Check if team is involved in the trade (they can't vote)
    const isInvolved = await queryOne(
      'SELECT * FROM trade_teams WHERE trade_id = $1 AND team_id = $2',
      [req.params.id, team_id]
    );
    
    if (isInvolved) {
      throw new AppError('Teams involved in the trade cannot vote', 400);
    }
    
    // Record vote
    await execute(
      `INSERT INTO trade_votes (trade_id, team_id, vote) VALUES ($1, $2, $3)
       ON CONFLICT (trade_id, team_id) DO UPDATE SET vote = $3, voted_at = CURRENT_TIMESTAMP`,
      [req.params.id, team_id, vote]
    );
    
    // Update vote counts
    if (vote === 'approve') {
      await execute('UPDATE trades SET votes_for = votes_for + 1 WHERE id = $1', [req.params.id]);
    } else {
      await execute('UPDATE trades SET votes_against = votes_against + 1 WHERE id = $1', [req.params.id]);
    }
    
    // Check if veto threshold reached
    const league = await queryOne('SELECT * FROM leagues WHERE id = $1', [trade.league_id]);
    const totalTeams = league?.total_rosters || 12;
    const involvedTeams = await query('SELECT COUNT(*) as count FROM trade_teams WHERE trade_id = $1', [req.params.id]);
    const eligibleVoters = totalTeams - parseInt(involvedTeams[0].count);
    const vetoThreshold = Math.ceil(eligibleVoters * (league?.veto_threshold || 0.5));
    
    const updatedTrade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    
    if (updatedTrade && updatedTrade.votes_against >= vetoThreshold) {
      await execute('UPDATE trades SET status = \'rejected\' WHERE id = $1', [req.params.id]);
    }
    
    res.json({
      status: 'success',
      data: {
        votes_for: updatedTrade?.votes_for || 0,
        votes_against: updatedTrade?.votes_against || 0,
        veto_threshold: vetoThreshold,
        eligible_voters: eligibleVoters,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Cancel trade (by proposing team)
tradeRoutes.post('/:id/cancel', async (req, res, next) => {
  try {
    const { team_id } = req.body;

    const trade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    if (!trade) {
      throw new AppError('Trade not found', 404);
    }

    if (trade.status !== 'pending') {
      throw new AppError('Can only cancel pending trades', 400);
    }

    await execute('UPDATE trades SET status = \'cancelled\' WHERE id = $1', [req.params.id]);

    res.json({
      status: 'success',
      message: 'Trade cancelled',
    });
  } catch (error) {
    next(error);
  }
});

// Withdraw trade (by proposing team only)
tradeRoutes.post('/:id/withdraw', async (req, res, next) => {
  try {
    const { team_id } = req.body;

    if (!team_id) {
      throw new AppError('team_id is required', 400);
    }

    const trade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    if (!trade) {
      throw new AppError('Trade not found', 404);
    }

    if (trade.status !== 'pending') {
      throw new AppError('Can only withdraw pending trades', 400);
    }

    // Only the proposer can withdraw
    if (trade.proposer_team_id !== team_id) {
      throw new AppError('Only the proposer can withdraw this trade', 403);
    }

    await execute('UPDATE trades SET status = \'cancelled\' WHERE id = $1', [req.params.id]);

    res.json({
      status: 'success',
      message: 'Trade withdrawn',
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to execute a trade
async function executeTrade(tradeId: string): Promise<void> {
  const assets = await query(
    'SELECT * FROM trade_assets WHERE trade_id = $1',
    [tradeId]
  );
  
  const trade = await queryOne<Trade>('SELECT * FROM trades WHERE id = $1', [tradeId]);
  
  // Get teams involved in the trade
  const tradeTeams = await query(
    `SELECT tt.*, t.team_name, t.owner_name
     FROM trade_teams tt
     JOIN teams t ON tt.team_id = t.id
     WHERE tt.trade_id = $1
     ORDER BY tt.created_at`,
    [tradeId]
  );
  
  for (const asset of assets) {
    if (asset.asset_type === 'contract' && asset.contract_id) {
      // Transfer contract
      await execute(
        `UPDATE contracts SET team_id = $1, status = 'active' WHERE id = $2`,
        [asset.to_team_id, asset.contract_id]
      );
      
      // Log cap transactions
      const contract = await queryOne('SELECT * FROM contracts WHERE id = $1', [asset.contract_id]);
      if (contract && trade) {
        // Cap freed from sending team
        await execute(
          `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id, related_trade_id)
           VALUES ($1, $2, $3, 'contract_traded_out', $4, 'Contract traded out', $5, $6)`,
          [trade.league_id, asset.from_team_id, 2025, -contract.salary, contract.id, tradeId]
        );
        
        // Cap used by receiving team
        await execute(
          `INSERT INTO cap_transactions (league_id, team_id, season, transaction_type, amount, description, related_contract_id, related_trade_id)
           VALUES ($1, $2, $3, 'contract_traded_in', $4, 'Contract traded in', $5, $6)`,
          [trade.league_id, asset.to_team_id, 2025, contract.salary, contract.id, tradeId]
        );
      }
    } else if (asset.asset_type === 'draft_pick' && asset.draft_pick_id) {
      // Transfer draft pick
      await execute(
        `UPDATE draft_picks SET current_team_id = $1 WHERE id = $2`,
        [asset.to_team_id, asset.draft_pick_id]
      );
    } else if (asset.asset_type === 'cap_space' && asset.cap_amount) {
      // Cap space trade: from_team takes on cap hit, to_team gets cap relief
      const capAmount = parseFloat(asset.cap_amount);
      const capYear = asset.cap_year || 2026; // Default to 2026 if not specified

      // Build year-specific amounts
      const yearAmounts = {
        amount_2026: capYear === 2026 ? capAmount : 0,
        amount_2027: capYear === 2027 ? capAmount : 0,
        amount_2028: capYear === 2028 ? capAmount : 0,
        amount_2029: capYear === 2029 ? capAmount : 0,
        amount_2030: capYear === 2030 ? capAmount : 0,
      };

      // Get team names for description
      const fromTeam = await queryOne('SELECT team_name, owner_name FROM teams WHERE id = $1', [asset.from_team_id]);
      const toTeam = await queryOne('SELECT team_name, owner_name FROM teams WHERE id = $1', [asset.to_team_id]);

      // Create cap hit for the from_team (they're absorbing cap)
      await execute(
        `INSERT INTO cap_adjustments (
          team_id, league_id, adjustment_type, description, trade_id,
          amount_2026, amount_2027, amount_2028, amount_2029, amount_2030
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          asset.from_team_id,
          trade?.league_id,
          'trade_cap_hit',
          `Cap absorbed in trade with ${toTeam?.owner_name || toTeam?.team_name}`,
          tradeId,
          yearAmounts.amount_2026,
          yearAmounts.amount_2027,
          yearAmounts.amount_2028,
          yearAmounts.amount_2029,
          yearAmounts.amount_2030,
        ]
      );

      // Create cap credit for the to_team (they're receiving cap relief)
      await execute(
        `INSERT INTO cap_adjustments (
          team_id, league_id, adjustment_type, description, trade_id,
          amount_2026, amount_2027, amount_2028, amount_2029, amount_2030
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          asset.to_team_id,
          trade?.league_id,
          'trade_cap_credit',
          `Cap relief in trade from ${fromTeam?.owner_name || fromTeam?.team_name}`,
          tradeId,
          -yearAmounts.amount_2026, // Negative for credit
          -yearAmounts.amount_2027,
          -yearAmounts.amount_2028,
          -yearAmounts.amount_2029,
          -yearAmounts.amount_2030,
        ]
      );
    }
  }
  
  // Add to trade history
  if (trade && tradeTeams.length >= 2) {
    await addTradeToHistory(trade, tradeTeams, assets);
  }
}

// Helper function to add completed trade to trade_history table
async function addTradeToHistory(trade: Trade, tradeTeams: any[], assets: any[]): Promise<void> {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get existing trade count for this year to generate trade number
    const existingTrades = await query(
      `SELECT COUNT(*) as count FROM trade_history WHERE league_id = $1 AND trade_year = $2`,
      [trade.league_id, currentYear]
    );
    const tradeCount = parseInt(existingTrades[0]?.count || '0') + 1;
    const tradeNumber = `${currentYear.toString().slice(-2)}.${tradeCount.toString().padStart(2, '0')}`;
    
    // Get team 1 and team 2
    const team1 = tradeTeams[0];
    const team2 = tradeTeams[1];
    
    // Build received items for each team
    const team1Received: any[] = [];
    const team2Received: any[] = [];
    
    for (const asset of assets) {
      const item: any = { type: asset.asset_type };
      
      if (asset.asset_type === 'contract' && asset.contract_id) {
        const contract = await queryOne(
          `SELECT c.*, p.full_name FROM contracts c 
           JOIN players p ON c.player_id = p.id 
           WHERE c.id = $1`,
          [asset.contract_id]
        );
        if (contract) {
          item.type = 'player';
          item.name = contract.full_name;
          item.salary = parseFloat(contract.salary);
          item.yearsLeft = contract.years_remaining;
        }
      } else if (asset.asset_type === 'draft_pick' && asset.draft_pick_id) {
        const pick = await queryOne(
          `SELECT dp.*, t.team_name as original_team_name, t.owner_name 
           FROM draft_picks dp 
           LEFT JOIN teams t ON dp.original_team_id = t.id 
           WHERE dp.id = $1`,
          [asset.draft_pick_id]
        );
        if (pick) {
          item.type = 'pick';
          const roundNames: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' };
          item.name = `${pick.season} ${roundNames[pick.round] || pick.round + 'th'} (${pick.owner_name || pick.original_team_name})`;
          item.pickYear = pick.season;
          item.pickRound = pick.round;
          item.originalOwner = pick.owner_name || pick.original_team_name;
        }
      } else if (asset.asset_type === 'cap_space' && asset.cap_amount) {
        item.type = 'cap';
        item.capAmount = parseFloat(asset.cap_amount);
        item.capYear = asset.cap_year || 2026;
      }
      
      // Assign to correct team's received list
      if (asset.to_team_id === team1.team_id) {
        team1Received.push(item);
      } else if (asset.to_team_id === team2.team_id) {
        team2Received.push(item);
      }
    }
    
    // Insert into trade_history
    await execute(
      `INSERT INTO trade_history (
        league_id, trade_number, trade_year,
        team1_id, team1_name, team1_received,
        team2_id, team2_name, team2_received,
        trade_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        trade.league_id,
        tradeNumber,
        currentYear,
        team1.team_id,
        team1.owner_name || team1.team_name,
        JSON.stringify(team1Received),
        team2.team_id,
        team2.owner_name || team2.team_name,
        JSON.stringify(team2Received),
        new Date(),
        trade.notes
      ]
    );
    
    console.log(`✅ Trade ${tradeNumber} added to history`);
  } catch (error) {
    console.error('Error adding trade to history:', error);
    // Don't throw - trade is already executed, history is just a bonus
  }
}
