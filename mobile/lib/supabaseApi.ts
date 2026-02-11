import { supabase } from './supabase';
import { 
  League, Team, Contract, Player, Trade, 
  TeamCapSummary, TradeHistory, LeagueRules,
  LeagueHistoryRecord, LeagueBuyIn
} from './api';

/**
 * Supabase API Client
 * This module provides API functions using Supabase instead of axios
 * It maintains compatibility with the existing API interface
 */

// =============================================
// LEAGUES
// =============================================

export const getLeagues = async () => {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return { data: { data } };
};

export const getLeague = async (id: string) => {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

export const getLeagueBySleeperId = async (sleeperId: string) => {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('sleeper_league_id', sleeperId)
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

// =============================================
// TEAMS
// =============================================

export const getTeams = async (leagueId: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('league_id', leagueId)
    .order('team_name');
  
  if (error) throw error;
  return { data: { data } };
};

export const getTeam = async (id: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

export const getTeamRoster = async (teamId: string) => {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('salary', { ascending: false });
  
  if (error) throw error;
  return { data: { data } };
};

// =============================================
// CONTRACTS
// =============================================

export const getContracts = async (
  leagueId: string, 
  params?: { status?: string; position?: string; team_id?: string }
) => {
  let query = supabase
    .from('contracts')
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .eq('league_id', leagueId);
  
  if (params?.status) query = query.eq('status', params.status);
  if (params?.team_id) query = query.eq('team_id', params.team_id);
  if (params?.position) {
    query = query.eq('player.position', params.position);
  }
  
  const { data, error } = await query.order('salary', { ascending: false });
  
  if (error) throw error;
  return { data: { data } };
};

export const getContract = async (id: string) => {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

export const createContract = async (contractData: Partial<Contract>) => {
  const { data, error } = await supabase
    .from('contracts')
    .insert(contractData)
    .select()
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

// =============================================
// PLAYERS
// =============================================

export const searchPlayers = async (q: string, position?: string) => {
  let query = supabase
    .from('players')
    .select('*')
    .ilike('full_name', `%${q}%`);
  
  if (position) {
    query = query.eq('position', position);
  }
  
  const { data, error } = await query.limit(50);
  
  if (error) throw error;
  return { data: { data } };
};

export const getPlayer = async (id: string) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

export const getPlayerContracts = async (playerId: string, leagueId?: string) => {
  let query = supabase
    .from('contracts')
    .select(`
      *,
      team:teams(*)
    `)
    .eq('player_id', playerId);
  
  if (leagueId) {
    query = query.eq('league_id', leagueId);
  }
  
  const { data, error } = await query.order('start_season', { ascending: false });
  
  if (error) throw error;
  return { data: { data } };
};

// =============================================
// TRADES
// =============================================

export const getTrades = async (leagueId: string, status?: string) => {
  let query = supabase
    .from('trades')
    .select('*')
    .eq('league_id', leagueId);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  return { data: { data } };
};

export const getTrade = async (id: string) => {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

export const createTrade = async (tradeData: any) => {
  const { data, error } = await supabase
    .from('trades')
    .insert(tradeData)
    .select()
    .single();
  
  if (error) throw error;
  return { data: { data } };
};

// =============================================
// SUPABASE EDGE FUNCTIONS
// =============================================

/**
 * Call Supabase Edge Function
 * These functions handle complex operations that require backend logic
 */
export const callEdgeFunction = async (functionName: string, body?: any) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body
  });
  
  if (error) throw error;
  return { data };
};

// Edge function wrappers for complex operations
export const syncLeagueData = async (leagueId: string) => {
  return callEdgeFunction('sync-league', { leagueId });
};

export const calculateCapSummary = async (teamId: string) => {
  return callEdgeFunction('calculate-cap', { teamId });
};

export const processTradeApproval = async (tradeId: string, approve: boolean, teamId: string) => {
  return callEdgeFunction('process-trade', { tradeId, approve, teamId });
};

export const advanceSeason = async (leagueId: string, commissionerTeamId: string) => {
  return callEdgeFunction('advance-season', { leagueId, commissionerTeamId });
};

// =============================================
// GOOGLE DOCS API (Secure via Edge Function)
// =============================================

/**
 * Read a Google Doc securely via Supabase Edge Function
 * This prevents exposing the API key on the client side
 * @param documentId - The Google Doc ID
 * @param operation - Type of operation: 'read', 'extractText', or 'parseTable'
 * @returns The document data
 */
export const readGoogleDocSecure = async (
  documentId: string,
  operation: 'read' | 'extractText' | 'parseTable' = 'read'
) => {
  const { data, error } = await supabase.functions.invoke('google-docs-read', {
    body: { documentId, operation }
  });
  
  if (error) throw error;
  return data;
};

/**
 * Check if Google Docs integration is available
 * @returns true if the Edge Function is deployed
 */
export const isGoogleDocsAvailable = async (): Promise<boolean> => {
  try {
    // Try to invoke the function with a test call
    const { error } = await supabase.functions.invoke('google-docs-read', {
      body: { documentId: 'test' }
    });
    // If we get a validation error (not a 404), the function exists
    return !error || error.message?.includes('documentId');
  } catch (e) {
    return false;
  }
};

// Re-export for backward compatibility
export * from './api';
