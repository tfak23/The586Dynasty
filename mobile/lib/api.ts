// API Client - Supabase-backed (replaces Express/axios)
// All functions maintain the same signatures and return shapes for backward compatibility

import { supabase } from './supabase';
import {
  ROOKIE_DRAFT_VALUES,
  MIN_SALARIES,
  calculateDeadCapPreview,
  evaluateContract as evaluateContractCalc,
  estimateContract as estimateContractCalc,
  quickEstimate,
} from './contractCalculations';

// Re-export calculation types
export type { ContractRating } from './contractCalculations';

// Helper to wrap Supabase responses in the same shape screens expect: res.data.data
function wrap<T>(data: T) {
  return { data: { data } };
}

// Also export a dummy `api` object for screens that import it directly (e.g., _layout.tsx)
export const api = {
  defaults: { baseURL: '' },
  interceptors: { request: { use: () => {} }, response: { use: () => {} } },
};

// =============================================
// API Types
// =============================================

export interface League {
  id: string;
  sleeper_league_id: string;
  name: string;
  salary_cap: number;
  min_contract_years: number;
  max_contract_years: number;
  trade_approval_mode: 'auto' | 'commissioner' | 'league_vote';
  current_season: number;
}

export interface Team {
  id: string;
  league_id: string;
  sleeper_roster_id: number;
  team_name: string;
  owner_name: string;
  avatar_url: string | null;
  division: string | null;
}

export interface TeamCapSummary {
  team_id: string;
  team_name: string;
  owner_name: string;
  salary_cap: number;
  total_salary: number;
  cap_room: number;
  active_contracts: number;
  total_contract_years: number;
  dead_money: number;
}

export interface Contract {
  id: string;
  league_id: string;
  team_id: string;
  player_id: string;
  salary: number;
  years_total: number;
  years_remaining: number;
  start_season: number;
  end_season: number;
  contract_type: string;
  has_option: boolean;
  option_year: number | null;
  is_franchise_tagged: boolean;
  status: string;
  roster_status: string;
  full_name?: string;
  position?: string;
  nfl_team?: string;
  team_name?: string;
  owner_name?: string;
}

export interface Player {
  id: string;
  sleeper_player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  age: number | null;
}

export interface Trade {
  id: string;
  league_id: string;
  status: string;
  approval_mode: string;
  expires_at: string;
  teams?: any[];
  assets?: any[];
}

export interface CapAdjustment {
  id: string;
  team_id: string;
  reason: string;
  amount_2026: number;
  amount_2027: number;
  amount_2028: number;
  amount_2029: number;
  amount_2030: number;
  trade_id?: string;
  created_at: string;
}

export interface CapAdjustmentTotals {
  total_2026: number;
  total_2027: number;
  total_2028: number;
  total_2029: number;
  total_2030: number;
}

export interface CreateCapAdjustmentRequest {
  reason: string;
  amount_2026?: number;
  amount_2027?: number;
  amount_2028?: number;
  amount_2029?: number;
  amount_2030?: number;
  trade_id?: string;
}

export interface DeadCapBreakdownItem {
  type: 'release' | 'trade';
  player_name?: string;
  position?: string;
  amount: number;
  reason?: string;
  trade_id?: string;
  date: string;
}

export interface DeadCapBreakdown {
  season: number;
  total_dead_cap: number;
  releases: { total: number; items: DeadCapBreakdownItem[] };
  trades: { total: number; items: DeadCapBreakdownItem[] };
}

export interface ContractEvaluation {
  rating: string;
  value_score: number;
  actual_salary: number;
  estimated_salary: number;
  salary_difference: number;
  league_rank: number | null;
  total_contracts: number;
  comparable_contracts: any[];
  reasoning: string;
  player_stats?: { ppg: number; games_played: number };
}

export interface SignedPlayerContract extends Contract {
  age: number | null;
  evaluation?: { rating: string; value_score: number; rank: number } | null;
}

export interface TradeHistoryItem {
  type: 'player' | 'pick' | 'cap';
  name?: string;
  salary?: number;
  yearsLeft?: number;
  capAmount?: number;
  capYear?: number;
  pickYear?: number;
  pickRound?: number;
  originalOwner?: string;
}

export interface TradeHistory {
  id: string;
  trade_number: string;
  trade_year: number;
  team1_name: string;
  team1_full_name?: string;
  team1_received: TradeHistoryItem[];
  team2_name: string;
  team2_full_name?: string;
  team2_received: TradeHistoryItem[];
}

export interface LeagueRules {
  buyIn?: { amount: number; payouts: { place: number; amount: number; label?: string }[] };
  salaryCap?: { hardCap: number; minYears: number; maxYears: number; minimumSalaries?: Record<number, number> };
  keyDates?: { event: string; week: string; description: string }[];
  deadCapTable?: number[][];
  tradeRules?: string[];
  rookieRules?: string[];
  tankingRules?: string[];
  raw?: string;
}

export interface LeagueHistoryRecord {
  id: string;
  league_id: string;
  owner_name: string;
  phone?: string;
  titles: number;
  sb_appearances: number;
  division_titles: number;
  playoff_appearances: number;
  total_winnings: number;
  total_buy_ins: number;
  net_winnings: number;
  total_wins: number;
  total_losses: number;
  total_ties: number;
  total_points: number;
  win_percentage: number;
  legacy_score: number;
  season_records: any[];
  current_team_id?: string;
  current_team_name?: string;
  is_active: boolean;
}

export interface LeagueBuyIn {
  id: string;
  league_id: string;
  team_id?: string;
  team_name?: string;
  season: number;
  owner_name: string;
  amount_due: number;
  amount_paid: number;
  status: 'paid' | 'partial' | 'unpaid';
  paid_date?: string;
  payment_method?: string;
  notes?: string;
}

export interface BuyInTotals {
  total_due: number;
  total_paid: number;
  paid_count: number;
  partial_count: number;
  unpaid_count: number;
}

// =============================================
// LEAGUES
// =============================================

export const getLeagues = async () => {
  const { data, error } = await supabase.from('leagues').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getLeague = async (id: string) => {
  const { data, error } = await supabase.from('leagues').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getLeagueBySleeperId = async (sleeperId: string) => {
  const { data, error } = await supabase.from('leagues').select('*').eq('sleeper_league_id', sleeperId).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getFranchiseTags = async (leagueId: string, season: number) => {
  const { data, error } = await supabase.from('franchise_tags').select('*').eq('league_id', leagueId).eq('season', season);
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const calculateFranchiseTags = async (leagueId: string, season: number) => {
  const { data, error } = await supabase.rpc('calculate_franchise_tags', { p_league_id: leagueId, p_season: season });
  if (error) throw new Error(error.message);
  return wrap(data);
};

// =============================================
// TEAMS
// =============================================

export const getTeams = async (leagueId: string) => {
  const { data, error } = await supabase.from('teams').select('*').eq('league_id', leagueId).order('team_name');
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTeam = async (id: string) => {
  const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTeamCap = async (teamId: string) => {
  const { data, error } = await supabase.from('team_cap_summary').select('*').eq('team_id', teamId).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTeamCapSummary = getTeamCap;

export const getLeagueCapSummary = async (leagueId: string) => {
  const { data: teams } = await supabase.from('teams').select('id').eq('league_id', leagueId);
  const teamIds = (teams || []).map((t: any) => t.id);
  const { data, error } = await supabase.from('team_cap_summary').select('*').in('team_id', teamIds).order('cap_room', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getLeagueCapDetailed = async (leagueId: string) => {
  const { data, error } = await supabase.rpc('get_league_cap_detailed', { p_league_id: leagueId });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTeamRoster = async (teamId: string) => {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, players!inner(full_name, position, team, age)')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('salary', { ascending: false });
  if (error) throw new Error(error.message);
  const flattened = (data || []).map((c: any) => ({
    ...c,
    full_name: c.players?.full_name,
    position: c.players?.position,
    nfl_team: c.players?.team,
    age: c.players?.age,
  }));
  return wrap(flattened);
};

export const getTeamCapProjection = async (teamId: string) => {
  const { data, error } = await supabase.rpc('get_team_cap_projection', { p_team_id: teamId });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTeamDraftPicks = async (teamId: string) => {
  const { data, error } = await supabase
    .from('draft_picks')
    .select('*, original_team:teams!draft_picks_original_team_id_fkey(team_name, owner_name), current_team:teams!draft_picks_current_team_id_fkey(team_name, owner_name)')
    .eq('current_team_id', teamId)
    .eq('is_used', false)
    .order('season')
    .order('round');
  if (error) throw new Error(error.message);
  const flattened = (data || []).map((dp: any) => ({
    ...dp,
    original_team_name: dp.original_team?.team_name,
    current_team_name: dp.current_team?.team_name,
  }));
  return wrap(flattened);
};

export const getLeagueDraftPicks = async (leagueId: string) => {
  const { data, error } = await supabase
    .from('draft_picks')
    .select('*, original_team:teams!draft_picks_original_team_id_fkey(team_name, owner_name), current_team:teams!draft_picks_current_team_id_fkey(team_name, owner_name)')
    .eq('league_id', leagueId)
    .eq('is_used', false)
    .order('season')
    .order('round');
  if (error) throw new Error(error.message);
  const flattened = (data || []).map((dp: any) => ({
    ...dp,
    original_team_name: dp.original_team?.team_name,
    current_team_name: dp.current_team?.team_name,
  }));
  return wrap(flattened);
};

export const getTeamDeadCapBreakdown = async (teamId: string) => {
  const { data, error } = await supabase.rpc('get_dead_cap_breakdown', { p_team_id: teamId });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const updateTeam = async (teamId: string, updates: Partial<Team>) => {
  const { data, error } = await supabase.from('teams').update(updates).eq('id', teamId).select().single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTeamCapAdjustments = async (teamId: string) => {
  const { data: adjustments, error } = await supabase.from('cap_adjustments').select('*').eq('team_id', teamId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const totals = (adjustments || []).reduce(
    (acc: any, a: any) => ({
      total_2026: acc.total_2026 + (a.amount_2026 || 0),
      total_2027: acc.total_2027 + (a.amount_2027 || 0),
      total_2028: acc.total_2028 + (a.amount_2028 || 0),
      total_2029: acc.total_2029 + (a.amount_2029 || 0),
      total_2030: acc.total_2030 + (a.amount_2030 || 0),
    }),
    { total_2026: 0, total_2027: 0, total_2028: 0, total_2029: 0, total_2030: 0 }
  );

  return wrap({ adjustments, totals });
};

export const createCapAdjustment = async (teamId: string, data: CreateCapAdjustmentRequest) => {
  const { data: team } = await supabase.from('teams').select('league_id').eq('id', teamId).single();
  const { data: result, error } = await supabase.from('cap_adjustments').insert({
    team_id: teamId,
    league_id: team?.league_id,
    adjustment_type: 'player_cut',
    description: data.reason,
    amount_2026: data.amount_2026 || 0,
    amount_2027: data.amount_2027 || 0,
    amount_2028: data.amount_2028 || 0,
    amount_2029: data.amount_2029 || 0,
    amount_2030: data.amount_2030 || 0,
    trade_id: data.trade_id,
  }).select().single();
  if (error) throw new Error(error.message);
  return wrap(result);
};

export const deleteCapAdjustment = async (teamId: string, adjustmentId: string) => {
  const { error } = await supabase.from('cap_adjustments').delete().eq('id', adjustmentId).eq('team_id', teamId);
  if (error) throw new Error(error.message);
  return wrap({ deleted: true, id: adjustmentId });
};

// =============================================
// CONTRACTS
// =============================================

export const getContracts = async (leagueId: string, params?: { status?: string; position?: string; team_id?: string }) => {
  let query = supabase.from('contracts').select('*, players!inner(full_name, position, team, age), teams!inner(team_name, owner_name)').eq('league_id', leagueId);
  if (params?.status) query = query.eq('status', params.status);
  if (params?.team_id) query = query.eq('team_id', params.team_id);
  if (params?.position) query = query.eq('players.position', params.position);
  const { data, error } = await query.order('salary', { ascending: false });
  if (error) throw new Error(error.message);
  const flattened = (data || []).map((c: any) => ({
    ...c, full_name: c.players?.full_name, position: c.players?.position,
    nfl_team: c.players?.team, age: c.players?.age,
    team_name: c.teams?.team_name, owner_name: c.teams?.owner_name,
  }));
  return wrap(flattened);
};

export const getContract = async (id: string) => {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, players!inner(full_name, position, team, age), teams!inner(team_name, owner_name)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const flat = {
    ...data,
    full_name: data.players?.full_name, position: data.players?.position,
    nfl_team: data.players?.team, age: data.players?.age,
    team_name: data.teams?.team_name, owner_name: data.teams?.owner_name,
  };
  return wrap(flat);
};

export const createContract = async (contractData: Partial<Contract>) => {
  const { data, error } = await supabase.from('contracts').insert(contractData).select().single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const releaseContract = async (id: string, release_reason?: string) => {
  const { data, error } = await supabase.rpc('release_contract', {
    p_contract_id: id,
    p_release_reason: release_reason || 'released',
  });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const releasePlayer = releaseContract;

export const getDeadCapPreview = async (id: string) => {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('salary, years_total, years_remaining, start_season, league_id')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const { data: league } = await supabase.from('leagues').select('current_season').eq('id', contract.league_id).single();
  const currentSeason = league?.current_season || 2025;
  const preview = calculateDeadCapPreview(contract.salary, contract.years_total, contract.start_season, currentSeason);
  return wrap({
    contract_id: id, salary: contract.salary, years_total: contract.years_total,
    years_remaining: contract.years_remaining,
    years_into_contract: currentSeason - contract.start_season,
    dead_cap_percentage: preview.percentage,
    dead_cap_hit: preview.deadCap,
    cap_savings: preview.capSavings,
  });
};

export const applyFranchiseTag = async (data: { league_id: string; team_id: string; player_id: string; season?: number }) => {
  const { data: result, error } = await supabase.rpc('apply_franchise_tag', {
    p_league_id: data.league_id, p_team_id: data.team_id,
    p_player_id: data.player_id, p_season: data.season || 2025,
  });
  if (error) throw new Error(error.message);
  return wrap(result);
};

export const getRookieValues = async () => wrap(ROOKIE_DRAFT_VALUES);
export const getMinimumSalaries = async () => wrap(MIN_SALARIES);

export const getContractEvaluation = async (contractId: string, leagueId: string) => {
  const result = await evaluateContractCalc(contractId, leagueId);
  return wrap(result);
};

export const getLeagueContractRankings = async (_leagueId: string) => {
  return wrap([]);
};

export const getSignedPlayers = async (leagueId: string, params?: { position?: string; rating?: string }) => {
  let query = supabase
    .from('contracts')
    .select('*, players!inner(full_name, position, team, age)')
    .eq('league_id', leagueId)
    .eq('status', 'active')
    .gt('salary', 0);
  if (params?.position) query = query.eq('players.position', params.position);
  const { data, error } = await query.order('salary', { ascending: false });
  if (error) throw new Error(error.message);

  const flattened = (data || []).map((c: any) => ({
    ...c, full_name: c.players?.full_name, position: c.players?.position,
    nfl_team: c.players?.team, age: c.players?.age,
  }));
  return wrap(flattened);
};

// =============================================
// PLAYERS
// =============================================

export const searchPlayers = async (q: string, position?: string) => {
  let query = supabase.from('players').select('*').ilike('full_name', `%${q}%`);
  if (position) query = query.eq('position', position);
  const { data, error } = await query.limit(50);
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getPlayer = async (id: string) => {
  const { data, error } = await supabase.from('players').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getPlayerContracts = async (playerId: string, leagueId?: string) => {
  let query = supabase.from('contracts').select('*, teams!inner(team_name, owner_name)').eq('player_id', playerId);
  if (leagueId) query = query.eq('league_id', leagueId);
  const { data, error } = await query.order('start_season', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTopSalaries = async (leagueId: string, position?: string, limit?: number) => {
  let query = supabase
    .from('contracts')
    .select('*, players!inner(full_name, position, team, age)')
    .eq('league_id', leagueId)
    .eq('status', 'active');
  if (position) query = query.eq('players.position', position);
  const { data, error } = await query.order('salary', { ascending: false }).limit(limit || 20);
  if (error) throw new Error(error.message);
  const flattened = (data || []).map((c: any) => ({
    ...c, full_name: c.players?.full_name, position: c.players?.position,
    nfl_team: c.players?.team, age: c.players?.age,
  }));
  return wrap(flattened);
};

export const getFreeAgents = async (leagueId: string, params?: { position?: string; season?: number; search?: string }) => {
  const { data: contractedPlayerIds } = await supabase
    .from('contracts')
    .select('player_id')
    .eq('league_id', leagueId)
    .eq('status', 'active');

  const excludeIds = (contractedPlayerIds || []).map((c: any) => c.player_id);

  let query = supabase.from('players').select('*, player_season_stats(avg_points_per_game, games_played, total_fantasy_points)').in('position', ['QB', 'RB', 'WR', 'TE']);
  if (params?.position) query = query.eq('position', params.position);
  if (params?.search) query = query.ilike('full_name', `%${params.search}%`);
  if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);

  const { data, error } = await query.limit(100);
  if (error) throw new Error(error.message);

  const withEstimates = (data || []).map((p: any) => {
    const stats = Array.isArray(p.player_season_stats) ? p.player_season_stats[0] : p.player_season_stats;
    const ppg = stats?.avg_points_per_game || 0;
    return { ...p, ppg, estimated_salary: quickEstimate(p.position, ppg, p.age, null) };
  });

  return wrap(withEstimates);
};

export const getPlayerEstimate = async (playerId: string, leagueId: string) => {
  const { data: player } = await supabase.from('players').select('*').eq('id', playerId).single();
  if (!player) throw new Error('Player not found');
  const estimate = await estimateContractCalc(leagueId, playerId, player.position, player.age, null, 2025);
  return wrap(estimate);
};

export const getPlayerStats = async (playerId: string, season?: number) => {
  let query = supabase.from('player_season_stats').select('*').eq('player_id', playerId);
  if (season) query = query.eq('season', season);
  const { data, error } = await query.order('season', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

// =============================================
// TRADES
// =============================================

export const getTrades = async (leagueId: string, status?: string) => {
  let query = supabase
    .from('trades')
    .select('*, trade_teams(*, teams(team_name, owner_name)), trade_assets(*)')
    .eq('league_id', leagueId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTrade = async (id: string) => {
  const { data, error } = await supabase
    .from('trades')
    .select('*, trade_teams(*, teams(team_name, owner_name)), trade_assets(*, contracts(*, players(full_name, position)), draft_picks(season, round, original_team:teams!draft_picks_original_team_id_fkey(team_name, owner_name)))')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const createTrade = async (tradeData: any) => {
  const { data: trade, error: tradeErr } = await supabase.from('trades').insert({
    league_id: tradeData.league_id,
    status: 'pending',
    approval_mode: tradeData.approval_mode || 'commissioner',
    proposer_team_id: tradeData.proposer_team_id,
    notes: tradeData.notes,
    expires_at: tradeData.expires_at,
  }).select().single();
  if (tradeErr) throw new Error(tradeErr.message);

  if (tradeData.teams) {
    for (const teamId of tradeData.teams) {
      await supabase.from('trade_teams').insert({ trade_id: trade.id, team_id: teamId, status: teamId === tradeData.proposer_team_id ? 'accepted' : 'pending' });
    }
  }

  if (tradeData.assets) {
    for (const asset of tradeData.assets) {
      await supabase.from('trade_assets').insert({ trade_id: trade.id, ...asset });
    }
  }

  return wrap(trade);
};

const callTradeAction = async (action: string, params: any) => {
  const { data, error } = await supabase.functions.invoke('trade-action', { body: { action, ...params } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const acceptTrade = (id: string, team_id: string) => callTradeAction('accept', { trade_id: id, team_id });
export const rejectTrade = (id: string, team_id: string) => callTradeAction('reject', { trade_id: id, team_id });
export const voteTrade = (id: string, team_id: string, approve: boolean) =>
  callTradeAction('vote', { trade_id: id, team_id, vote: approve ? 'approve' : 'veto' });
export const commissionerApproveTrade = (id: string, commissioner_team_id: string) =>
  callTradeAction('commissioner-approve', { trade_id: id, commissioner_team_id });
export const processTradeApproval = (id: string, approve: boolean, commissioner_team_id?: string) =>
  approve ? callTradeAction('commissioner-approve', { trade_id: id, commissioner_team_id })
          : callTradeAction('reject', { trade_id: id, team_id: commissioner_team_id });
export const cancelTrade = (id: string, team_id: string) => callTradeAction('cancel', { trade_id: id, team_id });
export const withdrawTrade = (id: string, team_id: string) => callTradeAction('withdraw', { trade_id: id, team_id });

// =============================================
// SEASON MANAGEMENT
// =============================================

export const advanceSeason = async (leagueId: string, commissioner_team_id: string, _franchise_tag_deadline?: string) => {
  const { data, error } = await supabase.rpc('advance_season', { p_league_id: leagueId, p_commissioner_team_id: commissioner_team_id });
  if (error) throw new Error(error.message);
  return wrap(data);
};

// =============================================
// FRANCHISE TAGS
// =============================================

export const getExpiringContracts = async (teamId: string) => {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, players!inner(full_name, position, team, age)')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .eq('pending_decision', true)
    .order('salary', { ascending: false });
  if (error) throw new Error(error.message);
  const flattened = (data || []).map((c: any) => ({
    ...c, full_name: c.players?.full_name, position: c.players?.position,
    nfl_team: c.players?.team, age: c.players?.age,
  }));
  return wrap(flattened);
};

export const getFranchiseTagCost = async (leagueId: string, position: string, season: number) => {
  const { data, error } = await supabase.from('franchise_tags').select('*').eq('league_id', leagueId).eq('season', season).eq('position', position).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const releaseExpiringPlayer = (contractId: string) => releaseContract(contractId, 'expired');

export const getTeamFranchiseTagUsage = async (teamId: string, season: number) => {
  const { data } = await supabase
    .from('franchise_tag_usage')
    .select('*, players!inner(full_name, position)')
    .eq('team_id', teamId)
    .eq('season', season)
    .single();
  return wrap({ has_used: !!data, tagged_player: data || null });
};

// =============================================
// TRADE HISTORY
// =============================================

export const getTradeHistory = async (leagueId: string, params?: { year?: number; teamName?: string }) => {
  let query = supabase.from('trade_history').select('*').eq('league_id', leagueId);
  if (params?.year) query = query.eq('trade_year', params.year);
  if (params?.teamName) query = query.or(`team1_name.ilike.%${params.teamName}%,team2_name.ilike.%${params.teamName}%`);
  const { data, error } = await query.order('trade_date', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getTradeHistoryYears = async (leagueId: string) => {
  const { data, error } = await supabase.from('trade_history').select('trade_year').eq('league_id', leagueId);
  if (error) throw new Error(error.message);
  const years = [...new Set((data || []).map((d: any) => d.trade_year))].sort((a: number, b: number) => b - a);
  return wrap(years);
};

export const getTradeHistoryTeams = async (leagueId: string) => {
  const { data, error } = await supabase.from('trade_history').select('team1_name, team2_name').eq('league_id', leagueId);
  if (error) throw new Error(error.message);
  const teams = [...new Set((data || []).flatMap((d: any) => [d.team1_name, d.team2_name]))].sort();
  return wrap(teams);
};

// =============================================
// SYNC (via Edge Functions)
// =============================================

export const initializeLeague = async (sleeper_league_id: string) => {
  const { data, error } = await supabase.functions.invoke('initialize-league', { body: { sleeper_league_id } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const syncLeague = async (leagueId: string) => {
  const { data, error } = await supabase.functions.invoke('sync-league', { body: { league_id: leagueId } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const syncRosters = async (leagueId: string) => {
  const { data, error } = await supabase.functions.invoke('sync-rosters', { body: { league_id: leagueId } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getLastSyncTime = async (leagueId: string) => {
  const { data } = await supabase.from('sync_log').select('completed_at').eq('league_id', leagueId).order('completed_at', { ascending: false }).limit(1).single();
  const lastSync = data?.completed_at || null;
  return wrap({
    last_sync: lastSync,
    minutes_ago: lastSync ? Math.round((Date.now() - new Date(lastSync).getTime()) / 60000) : null,
  });
};

export const syncStats = async (season: number, leagueId?: string) => {
  const { data, error } = await supabase.functions.invoke('sync-stats', { body: { season, league_id: leagueId } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const syncPlayers = async () => {
  const { data, error } = await supabase.functions.invoke('sync-players', { body: {} });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const syncToSheet = async (leagueId: string) => {
  const { data, error } = await supabase.functions.invoke('sheet-sync', { body: { league_id: leagueId, action: 'full-reconciliation' } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

// =============================================
// IMPORT (via Edge Function)
// =============================================

export const importCSV = async (leagueId: string, csvData: string, dryRun?: boolean) => {
  const { data, error } = await supabase.functions.invoke('import-csv', { body: { league_id: leagueId, csvData, dryRun } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const previewCSV = async (leagueId: string, csvData: string) => {
  const { data, error } = await supabase.functions.invoke('import-csv', { body: { league_id: leagueId, csvData, dryRun: true } });
  if (error) throw new Error(error.message);
  return wrap(data);
};

// =============================================
// LEAGUE RULES
// =============================================

export const getLeagueRules = async (leagueId: string) => {
  const { data, error } = await supabase.from('leagues').select('rules_content').eq('id', leagueId).single();
  if (error) throw new Error(error.message);
  return wrap(data?.rules_content || null);
};

export const updateLeagueRules = async (leagueId: string, rules: LeagueRules) => {
  const { data, error } = await supabase.from('leagues').update({ rules_content: rules }).eq('id', leagueId).select().single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

// =============================================
// LEAGUE HISTORY
// =============================================

export const getLeagueHistory = async (leagueId: string, activeOnly?: boolean) => {
  let query = supabase.from('league_history').select('*').eq('league_id', leagueId);
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query.order('legacy_score', { ascending: false });
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const getLeagueHistoryRecord = async (leagueId: string, historyId: string) => {
  const { data, error } = await supabase.from('league_history').select('*').eq('id', historyId).eq('league_id', leagueId).single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const updateLeagueHistory = async (leagueId: string, historyId: string, updates: Partial<LeagueHistoryRecord>) => {
  const { data, error } = await supabase.from('league_history').update(updates).eq('id', historyId).eq('league_id', leagueId).select().single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const createLeagueHistory = async (leagueId: string, historyData: Partial<LeagueHistoryRecord>) => {
  const { data, error } = await supabase.from('league_history').insert({ ...historyData, league_id: leagueId }).select().single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const syncLeagueHistorySeason = async (leagueId: string, season?: number) => {
  return wrap({ season: season || 2025, updated: [] });
};

// =============================================
// LEAGUE BUY-INS
// =============================================

export const getLeagueBuyIns = async (leagueId: string, season?: number) => {
  let query = supabase.from('league_buy_ins').select('*, teams(team_name)').eq('league_id', leagueId);
  if (season) query = query.eq('season', season);
  const { data, error } = await query.order('owner_name');
  if (error) throw new Error(error.message);

  const buyIns = (data || []).map((b: any) => ({ ...b, team_name: b.teams?.team_name }));
  const totals = {
    total_due: buyIns.reduce((s: number, b: any) => s + (b.amount_due || 0), 0),
    total_paid: buyIns.reduce((s: number, b: any) => s + (b.amount_paid || 0), 0),
    paid_count: buyIns.filter((b: any) => b.status === 'paid').length,
    partial_count: buyIns.filter((b: any) => b.status === 'partial').length,
    unpaid_count: buyIns.filter((b: any) => b.status === 'unpaid').length,
  };

  const currentSeason = season || buyIns[0]?.season || 2025;
  return wrap({ season: currentSeason, buy_ins: buyIns, totals });
};

export const getBuyInSeasons = async (leagueId: string) => {
  const { data, error } = await supabase.from('league_buy_ins').select('season').eq('league_id', leagueId);
  if (error) throw new Error(error.message);
  const seasons = [...new Set((data || []).map((d: any) => d.season))].sort((a: number, b: number) => b - a);
  return wrap(seasons);
};

export const updateBuyIn = async (leagueId: string, buyInId: string, updates: Partial<LeagueBuyIn>) => {
  const { data, error } = await supabase.from('league_buy_ins').update(updates).eq('id', buyInId).eq('league_id', leagueId).select().single();
  if (error) throw new Error(error.message);
  return wrap(data);
};

export const initializeBuyIns = async (leagueId: string, season: number, amountDue?: number) => {
  const { data: teams } = await supabase.from('teams').select('*').eq('league_id', leagueId);
  const buyIns: any[] = [];

  for (const team of teams || []) {
    const { data, error } = await supabase.from('league_buy_ins').upsert({
      league_id: leagueId,
      team_id: team.id,
      season,
      owner_name: team.owner_name,
      amount_due: amountDue || 100,
      amount_paid: 0,
      status: 'unpaid',
    }, { onConflict: 'league_id,team_id,season' }).select().single();
    if (!error && data) buyIns.push(data);
  }

  return wrap({ season, created: buyIns.length, buy_ins: buyIns });
};

export default api;
