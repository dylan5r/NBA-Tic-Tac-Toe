import { describe, expect, it } from "vitest";
import { applyMove, checkWinner, chooseAiMove, createInitialState, legalMoves } from "../src/index.js";

describe("game engine", () => {
  it("creates initial board", () => {
    const state = createInitialState("3x3");
    expect(state.board).toHaveLength(9);
    expect(state.turn).toBe("X");
  });

  it("applies legal move and swaps turn", () => {
    const state = createInitialState("3x3");
    const next = applyMove(state, 0);
    expect(next.board[0]).toBe("X");
    expect(next.turn).toBe("O");
  });

  it("detects row winner", () => {
    const result = checkWinner(["X", "X", "X", null, null, null, null, null, null], "3x3");
    expect(result.winner).toBe("X");
    expect(result.line).toEqual([0, 1, 2]);
  });

  it("hard ai blocks immediate win", () => {
    const move = chooseAiMove(["X", "X", null, null, "O", null, null, null, null], "3x3", "O", "hard");
    expect(move).toBe(2);
  });

  it("returns legal moves only", () => {
    const moves = legalMoves(["X", null, "O", null, null, null, "X", null, "O"]);
    expect(moves).toEqual([1, 3, 4, 5, 7]);
  });
});
