import { applyMove, checkWinner, chooseAiMove, createInitialState, type BoardVariant, type Difficulty, type PlayerSymbol } from "@nba/game-engine";

export interface LocalGameState {
  board: (PlayerSymbol | null)[];
  turn: PlayerSymbol;
  variant: BoardVariant;
  winner: PlayerSymbol | "draw" | null;
}

export const newLocalGame = (variant: BoardVariant = "3x3"): LocalGameState => {
  const s = createInitialState(variant);
  return { board: s.board, turn: s.turn, variant, winner: null };
};

export const playLocalMove = (state: LocalGameState, idx: number): LocalGameState => {
  if (state.winner) return state;
  const next = applyMove({ board: state.board, turn: state.turn, variant: state.variant }, idx);
  const result = checkWinner(next.board, state.variant);
  return { ...state, board: next.board, turn: next.turn, winner: result.winner };
};

export const aiTurn = (state: LocalGameState, aiSymbol: PlayerSymbol, difficulty: Difficulty): number =>
  chooseAiMove(state.board, state.variant, aiSymbol, difficulty);
