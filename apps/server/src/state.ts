import type { MatchSnapshot, RoomParticipant, RoomSettings } from "@nba/contracts";
import { createInitialState } from "@nba/game-engine";
import { nbaData, type GeneratedPrompt } from "./nbaData.js";

export interface LiveRoom {
  code: string;
  hostId: string;
  ranked: boolean;
  state: MatchSnapshot["state"];
  snapshot: MatchSnapshot;
  socketsByUser: Map<string, string>;
  spectators: Set<string>;
  rematchVotes: Set<string>;
  rematchRequester: string | null;
  rowChallenges: GeneratedPrompt[];
  colChallenges: GeneratedPrompt[];
  usedAnswerKeys: Set<string>;
  matchId: string;
  timerHandle?: NodeJS.Timeout;
}

export const defaultSettings: RoomSettings = {
  seriesLength: 3,
  timerMode: "per_move",
  perMoveSeconds: 10,
  perGameSeconds: 60,
  boardVariant: "3x3",
  drawMode: "ignore",
  boardSkin: "classic"
};

const initialSnapshot = (
  matchId: string,
  settings: RoomSettings,
  players: RoomParticipant[],
  ranked: boolean,
  rowChallenges: GeneratedPrompt[],
  colChallenges: GeneratedPrompt[],
  roomCode?: string
): MatchSnapshot => {
  const initial = createInitialState(settings.boardVariant);
  return {
    matchId,
    roomCode,
    state: "LOBBY",
    board: initial.board,
    rowChallenges: rowChallenges.map((c) => c.text),
    colChallenges: colChallenges.map((c) => c.text),
    usedAnswers: [],
    boardVariant: settings.boardVariant,
    turn: "X",
    winner: null,
    round: 1,
    score: { X: 0, O: 0, draws: 0 },
    players,
    settings,
    moves: [],
    reconnectDeadlines: {},
    remainingPerGame: { X: settings.perGameSeconds, O: settings.perGameSeconds },
    remainingPerMove: settings.timerMode === "per_move" ? settings.perMoveSeconds : null
  };
};

export const rooms = new Map<string, LiveRoom>();

export const rankedQueue: string[] = [];
export const unrankedQueue: string[] = [];

export const createRoomState = (params: {
  code: string;
  hostId: string;
  ranked: boolean;
  matchId: string;
  settings: RoomSettings;
  players: RoomParticipant[];
}): LiveRoom => {
  const initial = createInitialState(params.settings.boardVariant);
  const size = params.settings.boardVariant === "4x4" ? 4 : 3;
  const { rows, cols } = nbaData.challengesForGrid({ size, ranked: params.ranked });
  const room: LiveRoom = {
    code: params.code,
    hostId: params.hostId,
    ranked: params.ranked,
    matchId: params.matchId,
    state: "LOBBY",
    socketsByUser: new Map(),
    spectators: new Set(),
    rematchVotes: new Set(),
    rematchRequester: null,
    rowChallenges: rows,
    colChallenges: cols,
    usedAnswerKeys: new Set(),
    snapshot: initialSnapshot(params.matchId, params.settings, params.players, params.ranked, rows, cols, params.code)
  };
  rooms.set(params.code, room);
  return room;
};
