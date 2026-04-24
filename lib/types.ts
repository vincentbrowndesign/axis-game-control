export type Player = {
  id: string;
  team_id?: string | null;
  first_name?: string | null;
  last_name: string;
  jersey_number?: string | null;
  position?: string | null;
  is_active?: boolean;
};

export type GameSession = {
  id: string;
  team_id?: string | null;
  opponent_name: string;
  game_date?: string;
  period?: string;
  game_clock?: string;
  our_score?: number;
  opponent_score?: number;
  status?: string;
  video_url?: string | null;
};

export type EventType =
  | "MAKE_2"
  | "MAKE_3"
  | "MISS"
  | "TURNOVER"
  | "REBOUND"
  | "ASSIST"
  | "FOUL"
  | "OPP_1"
  | "OPP_2"
  | "OPP_3"
  | "TIMEOUT";

export type GameEventInput = {
  session_id: string;
  player_id?: string | null;
  event_type: EventType;
  event_value?: number;
  video_time_ms: number;
  game_clock?: string;
  period?: string;
  lineup_player_ids?: string[];
  metadata?: Record<string, unknown>;
};

export type SubEventInput = {
  session_id: string;
  player_out: string;
  player_in: string;
  video_time_ms: number;
  game_clock?: string;
  period?: string;
};