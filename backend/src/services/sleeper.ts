// Sleeper API Service
// Documentation: https://docs.sleeper.com/

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

// Cache for players data (large response, cache for 24 hours)
let playersCache: Record<string, any> | null = null;
let playersCacheTime: number = 0;
const PLAYERS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface SleeperLeague {
  league_id: string;
  name: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: Record<string, any>;
  season: string;
  status: string;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata: {
    team_name?: string;
    [key: string]: any;
  };
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
  reserve: string[];
  taxi: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
  };
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number;
  college: string | null;
  number: number | null;
  status: string;
  injury_status: string | null;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: 'trade' | 'waiver' | 'free_agent';
  status: string;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: any[];
  created: number;
}

export interface SleeperDraftPick {
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
  season: string;
}

export class SleeperService {
  private leagueId: string;

  constructor(leagueId: string) {
    this.leagueId = leagueId;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${SLEEPER_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // Get league info
  async getLeague(): Promise<SleeperLeague> {
    return this.fetch<SleeperLeague>(`/league/${this.leagueId}`);
  }

  // Get league users
  async getUsers(): Promise<SleeperUser[]> {
    return this.fetch<SleeperUser[]>(`/league/${this.leagueId}/users`);
  }

  // Get league rosters
  async getRosters(): Promise<SleeperRoster[]> {
    return this.fetch<SleeperRoster[]>(`/league/${this.leagueId}/rosters`);
  }

  // Get matchups for a specific week
  async getMatchups(week: number): Promise<any[]> {
    return this.fetch<any[]>(`/league/${this.leagueId}/matchups/${week}`);
  }

  // Get transactions for a specific week
  async getTransactions(week: number): Promise<SleeperTransaction[]> {
    return this.fetch<SleeperTransaction[]>(`/league/${this.leagueId}/transactions/${week}`);
  }

  // Get traded draft picks
  async getTradedPicks(): Promise<SleeperDraftPick[]> {
    return this.fetch<SleeperDraftPick[]>(`/league/${this.leagueId}/traded_picks`);
  }

  // Get all drafts for the league
  async getDrafts(): Promise<any[]> {
    return this.fetch<any[]>(`/league/${this.leagueId}/drafts`);
  }

  // Get specific draft info
  async getDraft(draftId: string): Promise<any> {
    return this.fetch<any>(`/draft/${draftId}`);
  }

  // Get draft picks
  async getDraftPicks(draftId: string): Promise<any[]> {
    return this.fetch<any[]>(`/draft/${draftId}/picks`);
  }

  // Get all NFL players (cached)
  async getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    // Check cache
    if (playersCache && Date.now() - playersCacheTime < PLAYERS_CACHE_TTL) {
      return playersCache;
    }

    // Fetch fresh data
    console.log('Fetching fresh players data from Sleeper...');
    const players = await this.fetch<Record<string, SleeperPlayer>>('/players/nfl');
    
    // Update cache
    playersCache = players;
    playersCacheTime = Date.now();
    
    console.log(`Cached ${Object.keys(players).length} players`);
    return players;
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<any> {
    const response = await fetch(`${SLEEPER_API_BASE}/user/${username}`);
    if (!response.ok) {
      throw new Error(`User not found: ${username}`);
    }
    return response.json();
  }

  // Get user's leagues for a season
  static async getUserLeagues(userId: string, season: string = '2025'): Promise<any[]> {
    const response = await fetch(`${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${season}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch leagues for user: ${userId}`);
    }
    return response.json() as Promise<any[]>;
  }

  // Get trending players (adds/drops)
  static async getTrendingPlayers(type: 'add' | 'drop', lookbackHours: number = 24, limit: number = 25): Promise<any[]> {
    const response = await fetch(`${SLEEPER_API_BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch trending players');
    }
    return response.json() as Promise<any[]>;
  }
}

export default SleeperService;
