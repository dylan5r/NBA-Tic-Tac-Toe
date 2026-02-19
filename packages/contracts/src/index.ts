export type MatchMode = "local" | "ai" | "online_ranked" | "online_unranked" | "private_room";
export type RoomState = "LOBBY" | "COUNTDOWN" | "IN_GAME" | "ROUND_END" | "MATCH_END";
export type PlayerSymbol = "X" | "O";
export type TimerMode = "none" | "per_move" | "per_game";
export type BoardVariant = "3x3" | "4x4";

export interface RoomSettings {
  seriesLength: 1 | 3 | 5;
  timerMode: TimerMode;
  perMoveSeconds: number;
  perGameSeconds: number;
  boardVariant: BoardVariant;
  drawMode: "ignore" | "count";
  boardSkin: "classic" | "arena" | "neon";
}

export interface PublicUser {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  streak: number;
}

export interface RoomParticipant {
  userId: string;
  username: string;
  ready: boolean;
  connected: boolean;
  symbol?: PlayerSymbol;
  rating?: number;
}

export interface MatchMove {
  index: number;
  symbol: PlayerSymbol;
  playedBy: string;
  playedAt: number;
}

export interface MatchSnapshot {
  matchId: string;
  roomCode?: string;
  state: RoomState;
  board: (PlayerSymbol | null)[];
  rowChallenges: string[];
  colChallenges: string[];
  usedAnswers: string[];
  boardVariant: BoardVariant;
  turn: PlayerSymbol;
  winner: PlayerSymbol | "draw" | null;
  round: number;
  score: { X: number; O: number; draws: number };
  players: RoomParticipant[];
  settings: RoomSettings;
  moves: MatchMove[];
  countdownEndsAt?: number;
  reconnectDeadlines: Record<string, number>;
  remainingPerGame: Record<PlayerSymbol, number>;
  remainingPerMove: number | null;
}

export interface LeaderboardRow {
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  streak: number;
}

export interface MatchHistoryItem {
  id: string;
  mode: MatchMode;
  ranked: boolean;
  winnerUserId: string | null;
  startedAt: string;
  endedAt: string;
  ratingDelta: number;
}

export interface ServerToClientEvents {
  "matchmaking:found": (payload: { roomCode: string; matchId: string; ranked: boolean }) => void;
  "room:stateSync": (snapshot: MatchSnapshot) => void;
  "room:error": (payload: { message: string }) => void;
  "room:countdown": (payload: { endsAt: number }) => void;
  "game:timerTick": (payload: { remainingPerMove: number | null; remainingPerGame: Record<PlayerSymbol, number> }) => void;
  "game:turnTimeout": (payload: { timedOut: PlayerSymbol; nextTurn: PlayerSymbol }) => void;
  "game:over": (payload: { winner: PlayerSymbol | "draw"; reason: "board" | "timeout" | "forfeit" }) => void;
  "game:ratingDelta": (payload: { userId: string; delta: number; newRating: number }[]) => void;
  "reconnect:countdown": (payload: { userId: string; deadline: number }) => void;
}

export interface ClientToServerEvents {
  "session:resume": (payload: { userId: string }) => void;
  "matchmaking:join": (payload: { ranked: boolean; userId: string }) => void;
  "matchmaking:leave": (payload: { userId: string }) => void;
  "room:create": (payload: { userId: string; settings: RoomSettings }) => void;
  "room:join": (payload: { userId: string; roomCode: string; spectator?: boolean }) => void;
  "room:leave": (payload: { userId: string; roomCode: string }) => void;
  "room:ready": (payload: { userId: string; roomCode: string; ready: boolean }) => void;
  "room:start": (payload: { userId: string; roomCode: string }) => void;
  "room:settings": (payload: { userId: string; roomCode: string; settings: RoomSettings }) => void;
  "game:move": (payload: { userId: string; roomCode: string; index: number; answer?: string }) => void;
  "game:surrender": (payload: { userId: string; roomCode: string }) => void;
  "game:rematch": (payload: { userId: string; roomCode: string }) => void;
  "reconnect:resume": (payload: { userId: string; roomCode: string }) => void;
}
