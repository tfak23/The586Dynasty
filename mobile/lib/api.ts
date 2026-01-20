import axios from 'axios';

// API base URL - change this to your Cloud Run URL in production
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.message || 'An error occurred');
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.request);
      throw new Error('Network error. Please check your connection.');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  }
);

// API Types
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
  // Joined fields
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

// API Functions

// Leagues
export const getLeagues = () => api.get<{ data: League[] }>('/api/leagues');
export const getLeague = (id: string) => api.get<{ data: League }>(`/api/leagues/${id}`);
export const getLeagueBySleeperId = (sleeperId: string) => 
  api.get<{ data: League }>(`/api/leagues/sleeper/${sleeperId}`);
export const getFranchiseTags = (leagueId: string, season: number) =>
  api.get<{ data: any[] }>(`/api/leagues/${leagueId}/franchise-tags/${season}`);
export const calculateFranchiseTags = (leagueId: string, season: number) =>
  api.post<{ data: any[] }>(`/api/leagues/${leagueId}/franchise-tags/${season}/calculate`);

// Teams
export const getTeams = (leagueId: string) => 
  api.get<{ data: Team[] }>(`/api/teams/league/${leagueId}`);
export const getTeam = (id: string) => api.get<{ data: Team }>(`/api/teams/${id}`);
export const getTeamCap = (teamId: string) => 
  api.get<{ data: TeamCapSummary }>(`/api/teams/${teamId}/cap`);
// Alias for component convenience
export const getTeamCapSummary = getTeamCap;
export const getLeagueCapSummary = (leagueId: string) =>
  api.get<{ data: TeamCapSummary[] }>(`/api/teams/league/${leagueId}/cap`);
export const getTeamRoster = (teamId: string) =>
  api.get<{ data: Contract[] }>(`/api/teams/${teamId}/roster`);
export const getTeamCapProjection = (teamId: string) =>
  api.get<{ data: any }>(`/api/teams/${teamId}/cap-projection`);
export const getTeamDraftPicks = (teamId: string) =>
  api.get<{ data: any[] }>(`/api/teams/${teamId}/draft-picks`);

// Contracts
export const getContracts = (leagueId: string, params?: { status?: string; position?: string; team_id?: string }) =>
  api.get<{ data: Contract[] }>(`/api/contracts/league/${leagueId}`, { params });
export const getContract = (id: string) => 
  api.get<{ data: Contract }>(`/api/contracts/${id}`);
export const createContract = (data: Partial<Contract>) =>
  api.post<{ data: Contract }>('/api/contracts', data);
export const releaseContract = (id: string, release_reason?: string) =>
  api.post<{ data: { contract: Contract; dead_cap: number } }>(`/api/contracts/${id}/release`, { release_reason });
// Alias for component convenience
export const releasePlayer = releaseContract;
export const getDeadCapPreview = (id: string) =>
  api.get<{ data: any }>(`/api/contracts/${id}/dead-cap-preview`);
export const applyFranchiseTag = (data: { league_id: string; team_id: string; player_id: string; season?: number }) =>
  api.post<{ data: any }>('/api/contracts/franchise-tag', data);
export const getRookieValues = () =>
  api.get<{ data: Record<string, number> }>('/api/contracts/rookie-values/all');
export const getMinimumSalaries = () =>
  api.get<{ data: Record<number, number> }>('/api/contracts/minimum-salaries/all');

// Players
export const searchPlayers = (q: string, position?: string) =>
  api.get<{ data: Player[] }>('/api/players/search', { params: { q, position } });
export const getPlayer = (id: string) => api.get<{ data: Player }>(`/api/players/${id}`);
export const getPlayerContracts = (playerId: string, leagueId?: string) =>
  api.get<{ data: Contract[] }>(`/api/players/${playerId}/contracts`, { params: { league_id: leagueId } });
export const getTopSalaries = (leagueId: string, position?: string, limit?: number) =>
  api.get<{ data: any[] }>(`/api/players/league/${leagueId}/top-salaries`, { params: { position, limit } });
export const getFreeAgents = (leagueId: string, params?: { position?: string; season?: number }) =>
  api.get<{ data: any[] }>(`/api/players/league/${leagueId}/free-agents`, { params });

// Trades
export const getTrades = (leagueId: string, status?: string) =>
  api.get<{ data: Trade[] }>(`/api/trades/league/${leagueId}`, { params: { status } });
export const getTrade = (id: string) => api.get<{ data: Trade }>(`/api/trades/${id}`);
export const createTrade = (data: any) => api.post<{ data: Trade }>('/api/trades', data);
export const acceptTrade = (id: string, team_id: string) =>
  api.post<{ data: Trade }>(`/api/trades/${id}/accept`, { team_id });
export const rejectTrade = (id: string, team_id: string) =>
  api.post(`/api/trades/${id}/reject`, { team_id });
export const voteTrade = (id: string, team_id: string, approve: boolean) =>
  api.post(`/api/trades/${id}/vote`, { team_id, vote: approve ? 'approve' : 'veto' });
export const commissionerApproveTrade = (id: string, commissioner_team_id: string) =>
  api.post(`/api/trades/${id}/commissioner-approve`, { commissioner_team_id });
// Alias for processing trade approval (approve or reject)
export const processTradeApproval = (id: string, approve: boolean, commissioner_team_id?: string) =>
  approve 
    ? api.post(`/api/trades/${id}/commissioner-approve`, { commissioner_team_id })
    : api.post(`/api/trades/${id}/reject`, { commissioner_team_id });
export const cancelTrade = (id: string, team_id: string) =>
  api.post(`/api/trades/${id}/cancel`, { team_id });

// Trade History
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

export const getTradeHistory = (leagueId: string, params?: { year?: number; teamName?: string }) =>
  api.get<{ data: TradeHistory[] }>(`/api/trade-history/league/${leagueId}`, { params });
export const getTradeHistoryYears = (leagueId: string) =>
  api.get<{ data: number[] }>(`/api/trade-history/league/${leagueId}/years`);
export const getTradeHistoryTeams = (leagueId: string) =>
  api.get<{ data: string[] }>(`/api/trade-history/league/${leagueId}/teams`);

// Sync
export const initializeLeague = (sleeper_league_id: string) =>
  api.post<{ data: any }>('/api/sync/initialize', { sleeper_league_id });
export const syncLeague = (leagueId: string) =>
  api.post<{ data: any }>(`/api/sync/league/${leagueId}/full`);
export const syncRosters = (leagueId: string) =>
  api.post<{ data: any }>(`/api/sync/league/${leagueId}/rosters`);

// Import
export const importCSV = (leagueId: string, csvData: string, dryRun?: boolean) =>
  api.post<{ data: any }>(`/api/import/csv/${leagueId}`, { csvData, dryRun });
export const previewCSV = (leagueId: string, csvData: string) =>
  api.post<{ data: any }>(`/api/import/preview/${leagueId}`, { csvData });

export default api;
