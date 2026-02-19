export type PlayerSymbol = "X" | "O";
export type BoardVariant = "3x3" | "4x4";

export interface EngineState {
  board: (PlayerSymbol | null)[];
  turn: PlayerSymbol;
  variant: BoardVariant;
}

export interface WinResult {
  winner: PlayerSymbol | "draw" | null;
  line: number[] | null;
}

export const sizeFromVariant = (variant: BoardVariant): number => (variant === "3x3" ? 3 : 4);

export const createInitialState = (variant: BoardVariant = "3x3"): EngineState => {
  const size = sizeFromVariant(variant);
  return {
    board: Array(size * size).fill(null),
    turn: "X",
    variant
  };
};

export const legalMoves = (board: (PlayerSymbol | null)[]): number[] => {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
};

const makeLines = (size: number): number[][] => {
  const lines: number[][] = [];

  for (let r = 0; r < size; r += 1) {
    const row: number[] = [];
    const col: number[] = [];
    for (let c = 0; c < size; c += 1) {
      row.push(r * size + c);
      col.push(c * size + r);
    }
    lines.push(row, col);
  }

  const d1: number[] = [];
  const d2: number[] = [];
  for (let i = 0; i < size; i += 1) {
    d1.push(i * size + i);
    d2.push(i * size + (size - 1 - i));
  }
  lines.push(d1, d2);
  return lines;
};

export const checkWinner = (board: (PlayerSymbol | null)[], variant: BoardVariant): WinResult => {
  const size = sizeFromVariant(variant);
  const lines = makeLines(size);

  for (const line of lines) {
    const firstIdx = line[0];
    if (firstIdx === undefined) continue;
    const first = board[firstIdx];
    if (!first) continue;
    if (line.every((idx) => board[idx] === first)) {
      return { winner: first, line };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", line: null };
  }

  return { winner: null, line: null };
};

export const applyMove = (state: EngineState, index: number): EngineState => {
  if (index < 0 || index >= state.board.length) {
    throw new Error("Move out of range");
  }
  if (state.board[index] !== null) {
    throw new Error("Cell already occupied");
  }
  const nextBoard = [...state.board];
  nextBoard[index] = state.turn;
  return {
    ...state,
    board: nextBoard,
    turn: state.turn === "X" ? "O" : "X"
  };
};

export type Difficulty = "easy" | "medium" | "hard";

const randomPick = (items: number[]): number => items[Math.floor(Math.random() * items.length)]!;

const findWinningMove = (board: (PlayerSymbol | null)[], variant: BoardVariant, symbol: PlayerSymbol): number | null => {
  for (const m of legalMoves(board)) {
    const temp = [...board];
    temp[m] = symbol;
    if (checkWinner(temp, variant).winner === symbol) return m;
  }
  return null;
};

const mediumMove = (board: (PlayerSymbol | null)[], variant: BoardVariant, symbol: PlayerSymbol): number => {
  const opponent = symbol === "X" ? "O" : "X";
  const win = findWinningMove(board, variant, symbol);
  if (win !== null) return win;
  const block = findWinningMove(board, variant, opponent);
  if (block !== null) return block;

  if (variant === "3x3") {
    if (board[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
    if (corners.length) return randomPick(corners);
  }

  return randomPick(legalMoves(board));
};

const minimax = (
  board: (PlayerSymbol | null)[],
  variant: BoardVariant,
  maximizing: boolean,
  ai: PlayerSymbol,
  human: PlayerSymbol,
  depth: number
): number => {
  const result = checkWinner(board, variant).winner;
  if (result === ai) return 10 - depth;
  if (result === human) return depth - 10;
  if (result === "draw") return 0;

  const moves = legalMoves(board);
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const temp = [...board];
      temp[m] = ai;
      best = Math.max(best, minimax(temp, variant, false, ai, human, depth + 1));
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    const temp = [...board];
    temp[m] = human;
    best = Math.min(best, minimax(temp, variant, true, ai, human, depth + 1));
  }
  return best;
};

const hardMove = (board: (PlayerSymbol | null)[], variant: BoardVariant, symbol: PlayerSymbol): number => {
  if (variant === "4x4") {
    return mediumMove(board, variant, symbol);
  }
  const opponent = symbol === "X" ? "O" : "X";
  let bestScore = -Infinity;
  let bestMove = legalMoves(board)[0]!;
  for (const m of legalMoves(board)) {
    const temp = [...board];
    temp[m] = symbol;
    const score = minimax(temp, variant, false, symbol, opponent, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove;
};

export const chooseAiMove = (
  board: (PlayerSymbol | null)[],
  variant: BoardVariant,
  symbol: PlayerSymbol,
  difficulty: Difficulty
): number => {
  const moves = legalMoves(board);
  if (!moves.length) throw new Error("No legal moves");

  if (difficulty === "easy") {
    if (Math.random() < 0.25) {
      const m = findWinningMove(board, variant, symbol);
      if (m !== null) return m;
    }
    return randomPick(moves);
  }
  if (difficulty === "medium") return mediumMove(board, variant, symbol);
  return hardMove(board, variant, symbol);
};
