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

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    // Dynamically import to avoid circular dependency
    const { useAuthStore } = await import('./authStore.js');
    const token = useAuthStore.getState().token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      // Handle 401 unauthorized - logout user
      if (error.response.status === 401) {
        const { useAuthStore } = await import('./authStore.js');
        await useAuthStore.getState().logout();
      }
      
      // Server responded with error
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.error || error.response.data.message || 'An error occurred');
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
export const getLeagueCapDetailed = (leagueId: string) =>
  api.get<{ data: any[] }>(`/api/teams/league/${leagueId}/cap-detailed`);
export const getTeamRoster = (teamId: string) =>
  api.get<{ data: Contract[] }>(`/api/teams/${teamId}/roster`);
export const getTeamCapProjection = (teamId: string) =>
  api.get<{ data: any }>(`/api/teams/${teamId}/cap-projection`);
export const getTeamDraftPicks = (teamId: string) =>
  api.get<{ data: any[] }>(`/api/teams/${teamId}/draft-picks`);
export const getLeagueDraftPicks = (leagueId: string) =>
  api.get<{ data: any[] }>(`/api/teams/league/${leagueId}/draft-picks`);
export const getTeamDeadCapBreakdown = (teamId: string) =>
  api.get<{ data: DeadCapBreakdown }>(`/api/teams/${teamId}/dead-cap-breakdown`);
export const updateTeam = (teamId: string, data: Partial<Team>) =>
  api.patch<{ data: Team }>(`/api/teams/${teamId}`, data);
export const getTeamCapAdjustments = (teamId: string) =>
  api.get<{ data: { adjustments: CapAdjustment[]; totals: CapAdjustmentTotals } }>(`/api/teams/${teamId}/cap-adjustments`);
export const createCapAdjustment = (teamId: string, data: CreateCapAdjustmentRequest) =>
  api.post<{ data: CapAdjustment }>(`/api/teams/${teamId}/cap-adjustment`, data);
export const deleteCapAdjustment = (teamId: string, adjustmentId: string) =>
  api.delete<{ data: { deleted: boolean; id: string } }>(`/api/teams/${teamId}/cap-adjustment/${adjustmentId}`);

// Cap Adjustment Types
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

// Dead Cap Breakdown Types
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
  releases: {
    total: number;
    items: DeadCapBreakdownItem[];
  };
  trades: {
    total: number;
    items: DeadCapBreakdownItem[];
  };
}

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
export const getContractEvaluation = (contractId: string, leagueId: string) =>
  api.get<{ data: ContractEvaluation }>(`/api/contracts/${contractId}/evaluation/${leagueId}`);
export const getLeagueContractRankings = (leagueId: string) =>
  api.get<{ data: any[] }>(`/api/contracts/league/${leagueId}/rankings`);

// Get signed players with evaluation data
export interface SignedPlayerContract extends Contract {
  age: number | null;
  evaluation?: {
    rating: ContractRating;
    value_score: number;
    rank: number;
  } | null;
}

export const getSignedPlayers = (
  leagueId: string,
  params?: { position?: string; rating?: string }
) =>
  api.get<{ data: SignedPlayerContract[] }>(
    `/api/contracts/league/${leagueId}/with-evaluations`,
    { params }
  );

// Contract Evaluation Types
export type ContractRating = 'ROOKIE' | 'BUST' | 'CORNERSTONE' | 'GOOD' | 'STEAL' | 'LEGENDARY';

export interface ContractEvaluation {
  rating: ContractRating;
  value_score: number;
  actual_salary: number;
  estimated_salary: number;
  salary_difference: number;
  league_rank: number | null;
  total_contracts: number;
  comparable_contracts: any[];
  reasoning: string;
  player_stats?: {
    ppg: number;
    games_played: number;
  };
}

// Players
export const searchPlayers = (q: string, position?: string) =>
  api.get<{ data: Player[] }>('/api/players/search', { params: { q, position } });
export const getPlayer = (id: string) => api.get<{ data: Player }>(`/api/players/${id}`);
export const getPlayerContracts = (playerId: string, leagueId?: string) =>
  api.get<{ data: Contract[] }>(`/api/players/${playerId}/contracts`, { params: { league_id: leagueId } });
export const getTopSalaries = (leagueId: string, position?: string, limit?: number) =>
  api.get<{ data: any[] }>(`/api/players/league/${leagueId}/top-salaries`, { params: { position, limit } });
export const getFreeAgents = (leagueId: string, params?: { position?: string; season?: number; search?: string }) =>
  api.get<{ data: any[] }>(`/api/players/league/${leagueId}/free-agents`, { params });
export const getPlayerEstimate = (playerId: string, leagueId: string) =>
  api.get<{ data: any }>(`/api/players/${playerId}/estimate/${leagueId}`);
export const getPlayerStats = (playerId: string, season?: number) =>
  api.get<{ data: any[] }>(`/api/players/${playerId}/stats`, { params: { season } });

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
export const withdrawTrade = (id: string, team_id: string) =>
  api.post(`/api/trades/${id}/withdraw`, { team_id });

// Season Management
export const advanceSeason = (leagueId: string, commissioner_team_id: string, franchise_tag_deadline?: string) =>
  api.post(`/api/leagues/${leagueId}/advance-season`, { commissioner_team_id, franchise_tag_deadline });

// Franchise Tags
export const getExpiringContracts = (teamId: string) =>
  api.get<{ data: any[] }>(`/api/teams/${teamId}/expiring-contracts`);
export const getFranchiseTagCost = (leagueId: string, position: string, season: number) =>
  api.get<{ data: { position: string; tag_salary: number; calculation: string } }>(`/api/leagues/${leagueId}/franchise-tags/${season}/${position}`);
export const releaseExpiringPlayer = (contractId: string) =>
  api.post(`/api/contracts/${contractId}/release`, { release_reason: 'expired' });
export const getTeamFranchiseTagUsage = (teamId: string, season: number) =>
  api.get<{ data: { has_used: boolean; tagged_player?: any } }>(`/api/teams/${teamId}/franchise-tag-usage/${season}`);

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
export const getLastSyncTime = (leagueId: string) =>
  api.get<{ data: { last_sync: string | null; minutes_ago: number | null } }>(`/api/sync/league/${leagueId}/last-sync`);
export const syncStats = (season: number, leagueId?: string) =>
  api.post<{ data: any }>(`/api/sync/stats/${season}`, { league_id: leagueId }, { timeout: 120000 }); // 2 min timeout for stats
export const syncPlayers = () =>
  api.post<{ data: { synced: number; skipped: number } }>('/api/players/sync', {}, { timeout: 300000 }); // 5 min timeout for large player sync

// Import
export const importCSV = (leagueId: string, csvData: string, dryRun?: boolean) =>
  api.post<{ data: any }>(`/api/import/csv/${leagueId}`, { csvData, dryRun });
export const previewCSV = (leagueId: string, csvData: string) =>
  api.post<{ data: any }>(`/api/import/preview/${leagueId}`, { csvData });

// =============================================
// LEAGUE RULES
// =============================================
export interface LeagueRules {
  buyIn?: {
    amount: number;
    payouts: { place: number; amount: number; label?: string }[];
  };
  salaryCap?: {
    hardCap: number;
    minYears: number;
    maxYears: number;
    minimumSalaries?: Record<number, number>;
  };
  keyDates?: {
    event: string;
    week: string;
    description: string;
  }[];
  deadCapTable?: number[][];
  tradeRules?: string[];
  rookieRules?: string[];
  tankingRules?: string[];
  raw?: string;
}

export const getLeagueRules = (leagueId: string) =>
  api.get<{ data: LeagueRules | null }>(`/api/leagues/${leagueId}/rules`);
export const updateLeagueRules = (leagueId: string, rules: LeagueRules) =>
  api.put<{ data: League }>(`/api/leagues/${leagueId}/rules`, { rules });

// =============================================
// LEAGUE HISTORY (Owner Statistics)
// =============================================
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
  season_records: {
    season: number;
    wins: number;
    losses: number;
    ties?: number;
    points: number;
    placing?: number;
    playoffs?: boolean;
    title?: boolean;
    division?: boolean;
  }[];
  current_team_id?: string;
  current_team_name?: string;
  is_active: boolean;
}

export const getLeagueHistory = (leagueId: string, activeOnly?: boolean) =>
  api.get<{ data: LeagueHistoryRecord[] }>(`/api/leagues/${leagueId}/history`, {
    params: activeOnly ? { active_only: 'true' } : undefined,
  });
export const getLeagueHistoryRecord = (leagueId: string, historyId: string) =>
  api.get<{ data: LeagueHistoryRecord }>(`/api/leagues/${leagueId}/history/${historyId}`);
export const updateLeagueHistory = (leagueId: string, historyId: string, data: Partial<LeagueHistoryRecord>) =>
  api.put<{ data: LeagueHistoryRecord }>(`/api/leagues/${leagueId}/history/${historyId}`, data);
export const createLeagueHistory = (leagueId: string, data: Partial<LeagueHistoryRecord>) =>
  api.post<{ data: LeagueHistoryRecord }>(`/api/leagues/${leagueId}/history`, data);
export const syncLeagueHistorySeason = (leagueId: string, season?: number) =>
  api.post<{ data: { season: number; updated: any[] } }>(`/api/leagues/${leagueId}/history/sync-season`, { season });

// =============================================
// LEAGUE BUY-INS
// =============================================
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

export const getLeagueBuyIns = (leagueId: string, season?: number) =>
  api.get<{ data: { season: number; buy_ins: LeagueBuyIn[]; totals: BuyInTotals } }>(
    `/api/leagues/${leagueId}/buy-ins`,
    { params: season ? { season } : undefined }
  );
export const getBuyInSeasons = (leagueId: string) =>
  api.get<{ data: number[] }>(`/api/leagues/${leagueId}/buy-ins/seasons`);
export const updateBuyIn = (leagueId: string, buyInId: string, data: Partial<LeagueBuyIn>) =>
  api.put<{ data: LeagueBuyIn }>(`/api/leagues/${leagueId}/buy-ins/${buyInId}`, data);
export const initializeBuyIns = (leagueId: string, season: number, amountDue?: number) =>
  api.post<{ data: { season: number; created: number; buy_ins: LeagueBuyIn[] } }>(
    `/api/leagues/${leagueId}/buy-ins/initialize`,
    { season, amount_due: amountDue }
  );

// =============================================
// AUTHENTICATION
// =============================================
export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      display_name: string;
      avatar_url?: string;
      has_sleeper_account: boolean;
      sleeper_username?: string;
    };
    token: string;
  };
}

export interface UserLeague {
  sleeper_league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  status: string;
  is_registered: boolean;
  is_salary_cap_league: boolean;
  app_league_id?: string;
  user_status: 'joined' | 'not_joined';
  action: 'already_joined' | 'join_league' | 'convert_to_salary_cap';
}

export const register = (email: string, password: string, display_name?: string) =>
  api.post<AuthResponse>('/api/auth/register', { email, password, display_name });

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/api/auth/login', { email, password });

export const googleAuth = (idToken: string) =>
  api.post<AuthResponse>('/api/auth/google', { idToken });

export const forgotPassword = (email: string) =>
  api.post<{ success: boolean; message: string }>('/api/auth/forgot-password', { email });

export const resetPassword = (token: string, newPassword: string) =>
  api.post<{ success: boolean; message: string }>('/api/auth/reset-password', { token, newPassword });

export const getCurrentUser = () =>
  api.get<{ success: boolean; data: any }>('/api/auth/me');

export const linkSleeperAccount = (username: string) =>
  api.post<{ success: boolean; data: any }>('/api/auth/link-sleeper', { username });

// =============================================
// USER LEAGUES
// =============================================
export const discoverLeagues = (season?: string) =>
  api.get<{ success: boolean; data: { season: string; sleeper_user_id: string; leagues: UserLeague[] } }>(
    '/api/user-leagues/discover',
    { params: { season } }
  );

export const convertLeague = (sleeper_league_id: string) =>
  api.post<{ success: boolean; message: string; data: any }>(
    '/api/user-leagues/convert',
    { sleeper_league_id }
  );

export const joinLeague = (sleeper_league_id: string) =>
  api.post<{ success: boolean; message: string; data: any }>(
    '/api/user-leagues/join',
    { sleeper_league_id }
  );

export const getMyLeagues = () =>
  api.get<{ success: boolean; data: any[] }>('/api/user-leagues/my-leagues');

export default api;
