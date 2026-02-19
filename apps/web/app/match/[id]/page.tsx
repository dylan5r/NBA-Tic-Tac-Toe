"use client";

import type { MatchSnapshot } from "@nba/contracts";
import { checkWinner, type Difficulty } from "@nba/game-engine";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameBoard } from "../../../components/GameBoard";
import { LeftPanel } from "../../../components/LeftPanel";
import { RightPanel } from "../../../components/RightPanel";
import { UIButton } from "../../../components/ui/Button";
import { UICard } from "../../../components/ui/Card";
import { api, type NbaChallenge, type NbaPlayerOption } from "../../../lib/api";
import { useApp } from "../../providers";
import { getSocket } from "../../../lib/socket";
import { aiTurn, newLocalGame, playLocalMove, type LocalGameState } from "../../../lib/local-game";

const confetti = Array.from({ length: 36 }).map((_, i) => (
  <span
    key={i}
    className="absolute h-2 w-2 animate-fade-up rounded-full bg-orange-400"
    style={{ left: `${(i * 19) % 100}%`, top: `${(i * 27) % 90}%` }}
  />
));

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user } = useApp();
  const id = params.id;
  const roomCode = search.get("room") ?? "";
  const mode = search.get("mode") ?? "online";

  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [localState, setLocalState] = useState<LocalGameState | null>(null);
  const [localRowChallenges, setLocalRowChallenges] = useState<NbaChallenge[]>([]);
  const [localColChallenges, setLocalColChallenges] = useState<NbaChallenge[]>([]);
  const [localUsedAnswerKeys, setLocalUsedAnswerKeys] = useState<string[]>([]);
  const [localUsedAnswers, setLocalUsedAnswers] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [playerOptions, setPlayerOptions] = useState<NbaPlayerOption[]>([]);
  const [activeOption, setActiveOption] = useState(-1);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const isLocal = id === "local";
  const board = isLocal ? localState?.board ?? [] : snapshot?.board ?? [];
  const size = ((isLocal ? localState?.variant : snapshot?.boardVariant) === "4x4" ? 4 : 3) as 3 | 4;
  const selectedRow = selectedCell !== null ? Math.floor(selectedCell / size) : null;
  const selectedCol = selectedCell !== null ? selectedCell % size : null;

  useEffect(() => {
    if (!isLocal || localState) return;
    const variant = (search.get("board") as "3x3" | "4x4") ?? "3x3";
    setLocalState(newLocalGame(variant));
  }, [isLocal, localState, search]);

  useEffect(() => {
    if (!isLocal || !localState) return;
    const size = localState.variant === "4x4" ? 4 : 3;
    const promptMode = mode.includes("ranked") ? "ranked" : "casual";
    api
      .nbaChallenges(size, promptMode)
      .then((grid) => {
        setLocalRowChallenges(grid.rows);
        setLocalColChallenges(grid.cols);
      })
      .catch(() =>
        {
          setLocalRowChallenges(Array(size).fill(null).map((_, i) => ({ id: `fr-${i}`, text: "Any NBA player in dataset" })));
          setLocalColChallenges(Array(size).fill(null).map((_, i) => ({ id: `fc-${i}`, text: "Any NBA player in dataset" })));
        }
      );
  }, [isLocal, localState?.variant, mode]);

  useEffect(() => {
    if (!isLocal || !localState || mode !== "ai") return;
    const side = (search.get("side") as "X" | "O") ?? "X";
    const aiSymbol = side === "X" ? "O" : "X";
    const difficulty = (search.get("difficulty") as Difficulty) ?? "hard";
    if (localState.turn === aiSymbol && !localState.winner && localRowChallenges.length === size && localColChallenges.length === size) {
      const t = setTimeout(async () => {
        const move = aiTurn(localState, aiSymbol, difficulty);
        const row = Math.floor(move / size);
        const col = move % size;
        const rPrompt = localRowChallenges[row];
        const cPrompt = localColChallenges[col];
        if (!rPrompt || !cPrompt) return;
        const sample = await api.nbaSampleAnswer({ challengeIds: [rPrompt.id, cPrompt.id], usedKeys: localUsedAnswerKeys });
        if (!sample) {
          setMessage("AI could not find a valid NBA answer for this prompt.");
          return;
        }
        setLocalState((s) => (s ? playLocalMove(s, move) : s));
        setLocalUsedAnswerKeys((prev) => [...prev, sample.key]);
        setLocalUsedAnswers((prev) => [...prev, sample.name]);
      }, 420);
      return () => clearTimeout(t);
    }
  }, [isLocal, localState, localRowChallenges, localColChallenges, localUsedAnswerKeys, mode, search, size]);

  useEffect(() => {
    if (isLocal || !user || !roomCode) return;
    const socket = getSocket();
    socket.emit("session:resume", { userId: user.id });
    socket.emit("reconnect:resume", { userId: user.id, roomCode });
    socket.on("room:stateSync", (next) => {
      if (next.roomCode === roomCode) setSnapshot(next);
    });
    socket.on("game:timerTick", ({ remainingPerMove, remainingPerGame }) => {
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              remainingPerMove,
              remainingPerGame
            }
          : prev
      );
    });
    socket.on("game:turnTimeout", ({ timedOut, nextTurn }) => {
      setMessage(`${timedOut} timed out. Turn switched to ${nextTurn}.`);
      setSnapshot((prev) => (prev ? { ...prev, turn: nextTurn } : prev));
    });
    socket.on("room:error", ({ message: m }) => setMessage(m));
    return () => {
      socket.off("room:stateSync");
      socket.off("game:timerTick");
      socket.off("game:turnTimeout");
      socket.off("room:error");
    };
  }, [isLocal, roomCode, user]);

  useEffect(() => {
    const q = answerInput.trim();
    if (q.length < 2) {
      setPlayerOptions([]);
      setActiveOption(-1);
      return;
    }
    const handle = setTimeout(() => {
      void api.nbaPlayerSearch(q, 8).then((rows) => {
        setPlayerOptions(rows);
        setActiveOption(rows.length ? 0 : -1);
      });
    }, 120);
    return () => clearTimeout(handle);
  }, [answerInput]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key)) return;
      const idx = Number(e.key) - 1;
      if (size === 3) handleMove(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const replayBoard = useMemo(() => {
    if (!snapshot || replayIdx === null) return null;
    const boardView = Array(snapshot.board.length).fill(null) as ("X" | "O" | null)[];
    snapshot.moves.slice(0, replayIdx).forEach((m) => {
      boardView[m.index] = m.symbol;
    });
    return boardView;
  }, [replayIdx, snapshot]);

  const handleMove = (index: number) => {
    setMessage("");
    setSelectedCell(index);
  };

  const submitAnswer = async () => {
    if (selectedCell === null) return;
    if (!answerInput.trim()) {
      setMessage("Enter an NBA player name.");
      return;
    }
    setSubmittingAnswer(true);
    try {
      if (isLocal) {
        if (!localState) {
          setMessage("Local game is not initialized.");
          return;
        }
        const rPrompt = selectedRow !== null ? localRowChallenges[selectedRow] : null;
        const cPrompt = selectedCol !== null ? localColChallenges[selectedCol] : null;
        if (!rPrompt || !cPrompt) {
          setMessage("Challenge not loaded for this cell.");
          return;
        }
        const verdict = await api.nbaValidate({
          challengeIds: [rPrompt.id, cPrompt.id],
          answer: answerInput,
          usedKeys: localUsedAnswerKeys
        });
        if (!verdict.ok) {
          setMessage(verdict.reason ?? "Invalid NBA answer.");
          return;
        }
        setLocalState(playLocalMove(localState, selectedCell));
        setLocalUsedAnswerKeys((prev) => [...prev, verdict.key!]);
        setLocalUsedAnswers((prev) => [...prev, verdict.canonical!]);
        setSelectedCell(null);
        setAnswerInput("");
        setPlayerOptions([]);
        setActiveOption(-1);
        return;
      }
      if (!user || !roomCode) {
        setMessage("Online session unavailable.");
        return;
      }
      getSocket().emit("game:move", { userId: user.id, roomCode, index: selectedCell, answer: answerInput });
      setSelectedCell(null);
      setAnswerInput("");
      setPlayerOptions([]);
      setActiveOption(-1);
    } catch {
      setMessage("Could not submit answer.");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const rematch = () => {
    if (isLocal) {
      const variant = localState?.variant ?? "3x3";
      setLocalState(newLocalGame(variant));
      const size = variant === "4x4" ? 4 : 3;
      const promptMode = mode.includes("ranked") ? "ranked" : "casual";
      void api.nbaChallenges(size, promptMode).then((grid) => {
        setLocalRowChallenges(grid.rows);
        setLocalColChallenges(grid.cols);
      });
      setLocalUsedAnswers([]);
      setLocalUsedAnswerKeys([]);
      setSelectedCell(null);
      setAnswerInput("");
      setPlayerOptions([]);
      setActiveOption(-1);
      return;
    }
    if (!user || !roomCode) return;
    getSocket().emit("game:rematch", { userId: user.id, roomCode });
  };

  const localWinner = localState ? checkWinner(localState.board, localState.variant).winner : null;
  const winner = isLocal ? localWinner : snapshot?.winner ?? null;
  const activeBoard = replayBoard ?? board;

  const selectedChallengeLabel = isLocal
    ? selectedCell !== null
      ? `${localRowChallenges[selectedRow ?? 0]?.text ?? "Any NBA player"} + ${localColChallenges[selectedCol ?? 0]?.text ?? "Any NBA player"}`
      : null
    : selectedCell !== null
      ? `${snapshot?.rowChallenges[selectedRow ?? 0] ?? "Any NBA player"} + ${snapshot?.colChallenges[selectedCol ?? 0] ?? "Any NBA player"}`
      : null;

  const chooseOption = (name: string) => {
    setAnswerInput(name);
    setPlayerOptions([]);
    setActiveOption(-1);
  };

  return (
    <main className="arena-shell mx-auto min-h-screen w-full max-w-[1420px] px-8 py-5">
      <button className="focusable mb-2 rounded-md border border-white/20 px-3 py-1 text-sm uppercase tracking-wider" onClick={() => router.push("/")}>
        Back
      </button>
      <div className="grid grid-cols-[280px_1fr_280px] gap-4">
        <LeftPanel
          snapshot={
            isLocal
              ? null
              : snapshot
          }
        />
        <section className="relative flex flex-col justify-center rounded-[24px] border border-slate-500/30 bg-gradient-to-b from-slate-900/55 to-slate-950/75 p-4 shadow-panel">
          {winner && winner !== "draw" && <div className="pointer-events-none absolute inset-0">{confetti}</div>}
          <GameBoard
            board={activeBoard}
            rowLabels={isLocal ? localRowChallenges.map((c) => c.text) : snapshot?.rowChallenges}
            colLabels={isLocal ? localColChallenges.map((c) => c.text) : snapshot?.colChallenges}
            usedAnswers={isLocal ? localUsedAnswers : snapshot?.usedAnswers}
            onCell={handleMove}
            size={size}
            disabled={!isLocal && snapshot?.state !== "IN_GAME"}
          />
          <UICard className="mx-auto mt-3 w-[900px] max-w-full rounded-2xl p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-300">NBA Prompt</p>
            <p className="mt-1 font-semibold text-slate-100">
              {selectedChallengeLabel ?? "Select a board tile to answer its NBA challenge"}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative w-full">
                <input
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (!playerOptions.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveOption((v) => Math.min(playerOptions.length - 1, v + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveOption((v) => Math.max(0, v - 1));
                    } else if (e.key === "Enter" && activeOption >= 0) {
                      e.preventDefault();
                      chooseOption(playerOptions[activeOption]!.name);
                    }
                  }}
                  placeholder="Enter full player name"
                  className="w-full rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm"
                />
                {!!playerOptions.length && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-white/20 bg-slate-950/95 p-1 shadow-panel">
                    {playerOptions.map((p, i) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${i === activeOption ? "bg-sky-400/25 text-sky-100" : "text-slate-200 hover:bg-white/10"}`}
                        onClick={() => chooseOption(p.name)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <UIButton onClick={submitAnswer} disabled={selectedCell === null || submittingAnswer}>
                Claim Tile
              </UIButton>
            </div>
          </UICard>
          <p className="mt-3 text-center text-sm uppercase tracking-widest text-slate-300">
            {winner ? (winner === "draw" ? "Draw round" : `${winner} wins`) : `Turn: ${isLocal ? localState?.turn : snapshot?.turn}`}
          </p>
          {message && <p className="mt-2 text-center text-sm text-red-300">{message}</p>}
          {snapshot?.state === "MATCH_END" && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <UIButton variant="secondary" onClick={() => setReplayIdx((replayIdx ?? snapshot.moves.length) - 1)}>
                Replay -
              </UIButton>
              <span className="score-led text-xs text-slate-200">FRAME {replayIdx ?? snapshot.moves.length}</span>
              <UIButton variant="secondary" onClick={() => setReplayIdx(Math.min((replayIdx ?? 0) + 1, snapshot.moves.length))}>
                Replay +
              </UIButton>
            </div>
          )}
        </section>
        <RightPanel snapshot={isLocal ? null : snapshot} onRematch={rematch} onSurrender={() => router.push("/")} />
      </div>
    </main>
  );
}
