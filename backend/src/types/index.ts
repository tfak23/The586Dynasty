// League-related types
export interface League {
  id: string;
  sleeper_league_id: string;
  name: string;
  salary_cap: number;
  min_contract_years: number;
  max_contract_years: number;
  trade_approval_mode: 'auto' | 'commissioner' | 'league_vote';
  league_vote_window_hours: number;
  veto_threshold: number;
  current_season: number;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

export interface Team {
  id: string;
  league_id: string;
  sleeper_roster_id: number;
  sleeper_user_id: string;
  team_name: string;
  owner_name: string;
  avatar_url: string;
  division: string;
  created_at: Date;
  updated_at: Date;
}

export interface Player {
  id: string;
  sleeper_player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  years_exp: number;
  college: string;
  number: number;
  status: string;
  search_full_name: string;
  search_last_name: string;
  updated_at: Date;
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
  contract_type: 'standard' | 'rookie' | 'extension' | 'free_agent' | 'tag';
  has_option: boolean;
  option_year: number | null;
  option_exercised: boolean | null;
  is_franchise_tagged: boolean;
  status: 'active' | 'released' | 'traded' | 'expired' | 'voided';
  roster_status: 'active' | 'ir' | 'taxi';
  acquisition_type: 'draft' | 'trade' | 'free_agent' | 'waivers' | 'import' | 'extension' | 'tag';
  acquisition_date: Date;
  acquisition_details: Record<string, any>;
  released_at: Date | null;
  release_reason: string | null;
  dead_cap_hit: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Trade {
  id: string;
  league_id: string;
  status: 'pending' | 'accepted' | 'approved' | 'completed' | 'rejected' | 'expired' | 'cancelled';
  approval_mode: string;
  requires_commissioner_approval: boolean;
  requires_league_vote: boolean;
  votes_for: number;
  votes_against: number;
  vote_deadline: Date | null;
  commissioner_approved_by: string | null;
  commissioner_approved_at: Date | null;
  expires_at: Date;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TradeTeam {
  id: string;
  trade_id: string;
  team_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  accepted_at: Date | null;
}

export interface TradeAsset {
  id: string;
  trade_id: string;
  from_team_id: string;
  to_team_id: string;
  asset_type: 'contract' | 'draft_pick' | 'cap_space';
  contract_id: string | null;
  draft_pick_id: string | null;
  cap_amount: number | null;
}

export interface DraftPick {
  id: string;
  league_id: string;
  season: number;
  round: number;
  pick_number: number | null;
  original_team_id: string;
  current_team_id: string;
  is_used: boolean;
  used_for_player_id: string | null;
  used_for_contract_id: string | null;
}

export interface FranchiseTag {
  id: string;
  league_id: string;
  season: number;
  position: string;
  tag_salary: number;
  pool_size: number;
  top_players: any[];
  calculated_at: Date;
}

// API Response types
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Cap calculation types
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

export interface TeamContractYears {
  team_id: string;
  team_name: string;
  min_contract_years: number;
  max_contract_years: number;
  total_years: number;
  status: 'below_minimum' | 'above_maximum' | 'valid';
}

// Import types
export interface CSVImportRow {
  Player: string;
  CON: string;
  POS: string;
  '2025': string;
  '2026': string;
  '2027': string;
  '2028': string;
  '2029': string;
  '2030': string;
  Owner: string;
  'Roster Status': string;
}

export interface ImportResult {
  playersImported: number;
  contractsCreated: number;
  expiredContracts: number;
  errors: string[];
  warnings: string[];
}
