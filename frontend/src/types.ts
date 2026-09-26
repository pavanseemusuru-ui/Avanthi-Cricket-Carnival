export interface Player {
  id: number;
  roll_number: string;
  name: string;
  photo_url?: string;
  course: string;
  program: string;
  branch: string;
  year_of_study: number;
  year_override?: number;
  bucket: string;
  base_price: number;
  cricheroes_url?: string;
  profile_status: 'completed' | 'profile_creation_pending';
  payment_status: 'unpaid' | 'paid';
  can_edit: boolean;

  // Skills
  is_skilled_batter: boolean;
  batting_style?: string;
  preferred_batting_pos?: string;
  batting_arm: string;
  
  is_skilled_bowler: boolean;
  bowling_arm?: string;
  bowling_type?: string;
  pace_variety?: string;
  spin_variety?: string;
  bowling_roles?: string;
  
  is_wicket_keeper: boolean;
  fielding_zone?: string;
  preferred_fielding_pos?: string;
  
  highest_level_played: string;
  played_acc_before: boolean;
  previous_acc_team?: string;
  derived_player_type: string;

  // Stats
  matches: number;
  runs: number;
  batting_avg: number;
  strike_rate: number;
  highest_score: number;
  wickets: number;
  bowling_avg: number;
  economy: number;
  best_bowling: string;
  catches: number;
  stumpings: number;

  referring_team_name?: string;

  retained_franchise_id?: number;
  retained_role?: 'captain' | 'vice_captain';
  referred_franchise_id?: number;
  sold_franchise_id?: number;
  sold_price?: number;
  sold_type?: 'sold' | 'allotted' | 'scouted' | 'retained' | 'referred' | 'direct_assigned';
  is_skipped: boolean;
  random_lot_number?: number;
}

export interface AdminPlayer extends Player {
  mobile_number: string;
  cricheroes_mobile?: string;
}

export interface Franchise {
  id: number;
  name: string;
  short_code: string;
  logo_url?: string;
  faculty_coordinator_name: string;
  faculty_coordinator_dept: string;
  faculty_coordinator_photo?: string;
  captain_name?: string;
  vice_captain_name?: string;
  purse: number;
  squad_count: number;
  auction_purchases_count: number;
  max_permissible_bid: number;
  bucket_counts: Record<string, number>;
  mandatory_slots_needed: number;
  is_blocked: boolean;
}

export interface AdminFranchise extends Franchise {
  faculty_coordinator_mobile: string;
  captain_mobile?: string;
  vice_captain_mobile?: string;
}

export interface ScarcityInfo {
  bucket: string;
  unsold_supply: number;
  total_needed_players: number;
  teams_needing: number;
  warning_active: boolean;
}

export interface AuctionState {
  current_bucket: string;
  current_player: Player | null;
  current_bid_price: number;
  current_bidder: Franchise | null;
  next_required_bid: number;
  timer_seconds: number;
  timer_duration_seconds?: number;
  timer_running: boolean;
  draw_mode: 'auto' | 'guest';
  passed_franchise_ids: number[];
  bucket_minimums: Record<string, number>;
  scarcity_warnings: Record<string, ScarcityInfo>;
  is_paused: boolean;
  round_number: number;
}

export interface AuditLog {
  id: number;
  action_type: string;
  player_id?: number;
  franchise_id?: number;
  amount?: number;
  performed_by: string;
  reason?: string;
  is_undone: boolean;
  timestamp: string;
}

export type ViewMode = 'public' | 'projector' | 'bidding' | 'admin' | 'register' | 'squads';

export type AuthRole = 'Super Admin' | 'Admin' | 'Operator' | 'Captain';

export interface AuthSession {
  access_token: string;
  token_type: 'bearer';
  role: AuthRole;
  franchise_id: number | null;
  expires_in: number;
  expires_at: number;
}

