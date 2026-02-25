"use client";

import type { MatchSnapshot } from "@nba/contracts";
import { checkWinner, type Difficulty } from "@nba/game-engine";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameBoard, type TileClaim } from "../../../components/GameBoard";
import { UIButton } from "../../../components/ui/Button";
import { api, type NbaChallenge, type NbaPlayerOption, type NbaPossibleAnswer } from "../../../lib/api";
import { aiTurn, newLocalGame, playLocalMove, type LocalGameState } from "../../../lib/local-game";
import { getSocket } from "../../../lib/socket";
import { useApp } from "../../providers";

const confetti = Array.from({ length: 36 }).map((_, i) => (
  <span key={i} className="absolute h-2 w-2 animate-fade-up rounded-full bg-orange-400" style={{ left: `${(i * 19) % 100}%`, top: `${(i * 27) % 90}%` }} />
));
const SHOW_DEV_MODE_TOGGLE = true;
const LOCAL_MATCH_CONFIG_KEY = "nba_ttt_local_match_config_v1";
const LOCAL_DEFAULTS = {
  mode: "local",
  playerSide: "X" as "X" | "O",
  aiDifficulty: "hard" as Difficulty,
  localSeriesLength: 3 as 1 | 3 | 5,
  timerMode: "per_move" as "none" | "per_move" | "per_game",
  localPerMove: 30,
  localPerGame: 60,
  localBoardVariant: "3x3" as "3x3" | "4x4"
};

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user } = useApp();
  const id = params.id;
  const initialConfigRef = useRef<{
    roomCode: string;
    mode: string;
    timerMode: "none" | "per_move" | "per_game";
    localPerMove: number;
    localPerGame: number;
    playerSide: "X" | "O";
    aiDifficulty: Difficulty;
    localSeriesLength: number;
    localBoardVariant: "3x3" | "4x4";
  } | null>(null);
  if (!initialConfigRef.current) {
    let mode = "online";
    let timerMode: "none" | "per_move" | "per_game" = LOCAL_DEFAULTS.timerMode;
    let playerSide: "X" | "O" = LOCAL_DEFAULTS.playerSide;
    let aiDifficulty: Difficulty = LOCAL_DEFAULTS.aiDifficulty;
    let localSeriesLength: 1 | 3 | 5 = LOCAL_DEFAULTS.localSeriesLength;
    let localPerMove = LOCAL_DEFAULTS.localPerMove;
    let localPerGame = LOCAL_DEFAULTS.localPerGame;
    let localBoardVariant: "3x3" | "4x4" = LOCAL_DEFAULTS.localBoardVariant;

    if (id === "local") {
      try {
        const raw = sessionStorage.getItem(LOCAL_MATCH_CONFIG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            mode?: string;
            difficulty?: string;
            side?: string;
            settings?: {
              seriesLength?: number;
              timerMode?: string;
              perMoveSeconds?: number;
              perGameSeconds?: number;
              boardVariant?: string;
            };
          };
          mode = parsed.mode === "ai" ? "ai" : "local";
          playerSide = parsed.side === "O" ? "O" : "X";
          aiDifficulty =
            parsed.difficulty === "easy" || parsed.difficulty === "medium" || parsed.difficulty === "hard"
              ? parsed.difficulty
              : LOCAL_DEFAULTS.aiDifficulty;
          localSeriesLength =
            parsed.settings?.seriesLength === 1 || parsed.settings?.seriesLength === 5
              ? parsed.settings.seriesLength
              : LOCAL_DEFAULTS.localSeriesLength;
          timerMode =
            parsed.settings?.timerMode === "none" ||
            parsed.settings?.timerMode === "per_move" ||
            parsed.settings?.timerMode === "per_game"
              ? parsed.settings.timerMode
              : LOCAL_DEFAULTS.timerMode;
          localPerMove =
            Number.isFinite(parsed.settings?.perMoveSeconds) && (parsed.settings?.perMoveSeconds ?? 0) > 0
              ? Math.floor(parsed.settings!.perMoveSeconds!)
              : LOCAL_DEFAULTS.localPerMove;
          localPerGame =
            Number.isFinite(parsed.settings?.perGameSeconds) && (parsed.settings?.perGameSeconds ?? 0) >= 10
              ? Math.floor(parsed.settings!.perGameSeconds!)
              : LOCAL_DEFAULTS.localPerGame;
          localBoardVariant = parsed.settings?.boardVariant === "4x4" ? "4x4" : "3x3";
        } else {
          mode = LOCAL_DEFAULTS.mode;
        }
      } catch {
        mode = LOCAL_DEFAULTS.mode;
      }
    } else {
      mode = search.get("mode") ?? "online";
    }

    initialConfigRef.current = {
      roomCode: search.get("room") ?? "",
      mode,
      timerMode,
      localPerMove,
      localPerGame,
      playerSide,
      aiDifficulty,
      localSeriesLength,
      localBoardVariant
    };
  }
  const roomCode = initialConfigRef.current.roomCode;
  const mode = initialConfigRef.current.mode;
  const timerMode = initialConfigRef.current.timerMode;
  const localPerMove = initialConfigRef.current.localPerMove;
  const playerSide = initialConfigRef.current.playerSide;
  const aiDifficulty = initialConfigRef.current.aiDifficulty;
  const localSeriesLength = initialConfigRef.current.localSeriesLength;
  const localWinsNeeded = Math.floor(localSeriesLength / 2) + 1;

  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [localState, setLocalState] = useState<LocalGameState | null>(null);
  const [localRowChallenges, setLocalRowChallenges] = useState<NbaChallenge[]>([]);
  const [localColChallenges, setLocalColChallenges] = useState<NbaChallenge[]>([]);
  const [localUsedAnswerKeys, setLocalUsedAnswerKeys] = useState<string[]>([]);
  const [localAnswersByIndex, setLocalAnswersByIndex] = useState<Record<number, TileClaim>>({});
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [playerOptions, setPlayerOptions] = useState<NbaPlayerOption[]>([]);
  const [activeOption, setActiveOption] = useState(-1);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");
  const [timeoutNotice, setTimeoutNotice] = useState<{ id: number; text: string } | null>(null);
  const [timeoutFlash, setTimeoutFlash] = useState<"X" | "O" | null>(null);
  const [localRemainingPerMove, setLocalRemainingPerMove] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<"leave" | "surrender" | "rematch" | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const [incomingRematch, setIncomingRematch] = useState<{ fromUserId: string; fromUsername: string } | null>(null);
  const [localRound, setLocalRound] = useState(1);
  const [localScore, setLocalScore] = useState<{ X: number; O: number }>({ X: 0, O: 0 });
  const [localRoundWinner, setLocalRoundWinner] = useState<"X" | "O" | "draw" | null>(null);
  const [localMatchWinner, setLocalMatchWinner] = useState<"X" | "O" | null>(null);
  const [localChallengeSeed, setLocalChallengeSeed] = useState(0);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [confirmDevMode, setConfirmDevMode] = useState(false);
  const [devPossibleAnswers, setDevPossibleAnswers] = useState<NbaPossibleAnswer[]>([]);
  const [devAnswersLoading, setDevAnswersLoading] = useState(false);
  const localRoundAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocal = id === "local";
  const board = isLocal ? localState?.board ?? [] : snapshot?.board ?? [];
  const size = ((isLocal ? localState?.variant : snapshot?.boardVariant) === "4x4" ? 4 : 3) as 3 | 4;
  const selectedRow = selectedCell !== null ? Math.floor(selectedCell / size) : null;
  const selectedCol = selectedCell !== null ? selectedCell % size : null;
  const localXName = mode === "ai" ? (playerSide === "X" ? "You" : "AI Bot") : "Player 1";
  const localOName = mode === "ai" ? (playerSide === "O" ? "You" : "AI Bot") : "Player 2";

  const reloadLocalChallenges = useCallback((variant: "3x3" | "4x4") => {
    const boardSize = variant === "4x4" ? 4 : 3;
    const promptMode = mode.includes("ranked") ? "ranked" : "casual";
    void api
      .nbaChallenges(boardSize, promptMode)
      .then((grid) => {
        setLocalRowChallenges(grid.rows);
        setLocalColChallenges(grid.cols);
      })
      .catch(() => {
        setLocalChallengeSeed((v) => v + 1);
      });
  }, [mode]);

  useEffect(() => {
    if (!isLocal || localState) return;
    const variant = initialConfigRef.current?.localBoardVariant ?? "3x3";
    setLocalState(newLocalGame(variant));
  }, [isLocal, localState]);

  useEffect(() => {
    if (!isLocal || !localState?.variant) return;
    let cancelled = false;
    const boardSize = localState.variant === "4x4" ? 4 : 3;
    const promptMode = mode.includes("ranked") ? "ranked" : "casual";

    const loadChallenges = async () => {
      while (!cancelled) {
        try {
          const grid = await api.nbaChallenges(boardSize, promptMode);
          if (grid.rows.length === boardSize && grid.cols.length === boardSize) {
            if (!cancelled) {
              setLocalRowChallenges(grid.rows);
              setLocalColChallenges(grid.cols);
            }
            return;
          }
        } catch {
          // Retry until dataset is ready.
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };

    void loadChallenges();
    return () => {
      cancelled = true;
    };
  }, [isLocal, localChallengeSeed, localState?.variant, mode]);

  useEffect(() => {
    if (!isLocal || !localState) return;
    if (timerMode !== "per_move") {
      setLocalRemainingPerMove(null);
      return;
    }
    setLocalRemainingPerMove(localPerMove);
  }, [isLocal, localPerMove, localRoundWinner, localState, timerMode]);

  useEffect(() => {
    if (!isLocal || timerMode !== "per_move" || !localState || localState.winner || localRoundWinner || localMatchWinner) return;
    if (localRemainingPerMove === null) return;
    const t = setTimeout(() => {
      if (localRemainingPerMove <= 1) {
        const timedOut = localState.turn;
        const nextTurn = timedOut === "X" ? "O" : "X";
        setLocalState((s) => (s ? { ...s, turn: s.turn === "X" ? "O" : "X" } : s));
        setLocalRemainingPerMove(localPerMove);
        setTimeoutFlash(timedOut);
        setTimeoutNotice({
          id: Date.now(),
          text: `${timedOut === "X" ? "PLAYER 1" : "PLAYER 2"} TIME EXPIRED - TURN PASSED TO ${nextTurn === "X" ? "PLAYER 1" : "PLAYER 2"}`
        });
        setMessageTone("error");
        setMessage(`Timer expired for ${timedOut}. Turn switched to ${nextTurn}.`);
      } else {
        setLocalRemainingPerMove((n) => (n === null ? n : n - 1));
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [isLocal, localMatchWinner, localPerMove, localRemainingPerMove, localRoundWinner, localState, timerMode]);

  useEffect(() => {
    if (!isLocal || !localState || mode !== "ai" || localRoundWinner || localMatchWinner) return;
    const aiSymbol = playerSide === "X" ? "O" : "X";
    if (localState.turn === aiSymbol && !localState.winner && localRowChallenges.length === size && localColChallenges.length === size) {
      const t = setTimeout(async () => {
        const move = aiTurn(localState, aiSymbol, aiDifficulty);
        const row = Math.floor(move / size);
        const col = move % size;
        const rPrompt = localRowChallenges[row];
        const cPrompt = localColChallenges[col];
        if (!rPrompt || !cPrompt) return;
        const sample = await api.nbaSampleAnswer({ challengeIds: [rPrompt.id, cPrompt.id], usedKeys: localUsedAnswerKeys });
        if (!sample) {
          setMessageTone("error");
          setMessage("AI could not find a valid NBA answer for this prompt.");
          return;
        }
        setLocalState((s) => (s ? playLocalMove(s, move) : s));
        setLocalUsedAnswerKeys((prev) => [...prev, sample.key]);
        setLocalAnswersByIndex((prev) => ({
          ...prev,
          [move]: { name: sample.name, headshotUrl: sample.headshotUrl ?? null }
        }));
        if (timerMode === "per_move") setLocalRemainingPerMove(localPerMove);
      }, 420);
      return () => clearTimeout(t);
    }
  }, [aiDifficulty, isLocal, localMatchWinner, localPerMove, localRoundWinner, localState, localRowChallenges, localColChallenges, localUsedAnswerKeys, mode, playerSide, size, timerMode]);

  useEffect(() => {
    if (!isLocal || !localState?.winner || localRoundWinner) return;

    const roundWinner = localState.winner;
    setLocalRoundWinner(roundWinner);
    setSelectedCell(null);

    if (roundWinner === "draw") {
      setMessageTone("info");
      setMessage("Round ended in a draw.");
      return;
    }

    setLocalScore((prev) => {
      const next = { ...prev, [roundWinner]: prev[roundWinner] + 1 };
      if (next[roundWinner] >= localWinsNeeded) {
        setLocalMatchWinner(roundWinner);
        setMessageTone("success");
        setMessage(`${roundWinner === "X" ? localXName : localOName} wins the match.`);
      } else {
        setMessageTone("success");
        setMessage(`${roundWinner === "X" ? localXName : localOName} wins the round.`);
      }
      return next;
    });
  }, [isLocal, localOName, localRoundWinner, localState?.winner, localWinsNeeded, localXName]);

  useEffect(() => {
    if (!isLocal || !localRoundWinner || localMatchWinner || !localState) return;
    if (localRoundAdvanceRef.current) clearTimeout(localRoundAdvanceRef.current);
    localRoundAdvanceRef.current = setTimeout(() => {
      const variant = localState.variant;
      setLocalRound((r) => r + 1);
      setLocalState(newLocalGame(variant));
      setLocalRoundWinner(null);
      setLocalUsedAnswerKeys([]);
      setLocalAnswersByIndex({});
      setSelectedCell(null);
      setAnswerInput("");
      setPlayerOptions([]);
      setActiveOption(-1);
      setReplayIdx(null);
      setLocalRemainingPerMove(timerMode === "per_move" ? localPerMove : null);
      reloadLocalChallenges(variant);
    }, 1800);

    return () => {
      if (localRoundAdvanceRef.current) {
        clearTimeout(localRoundAdvanceRef.current);
        localRoundAdvanceRef.current = null;
      }
    };
  }, [isLocal, localMatchWinner, localPerMove, localRoundWinner, localState, reloadLocalChallenges, timerMode]);

  useEffect(() => {
    if (isLocal || !user || !roomCode) return;
    const socket = getSocket();
    socket.emit("session:resume", { userId: user.id });
    socket.emit("reconnect:resume", { userId: user.id, roomCode });
    socket.on("room:stateSync", (next) => {
      if (next.roomCode === roomCode) {
        setSnapshot(next);
        if (rematchPending && next.state === "IN_GAME" && next.round === 1 && next.moves.length === 0) {
          setRematchPending(false);
          setIncomingRematch(null);
          setMessageTone("success");
          setMessage("Rematch accepted. New match started.");
        }
      }
    });
    socket.on("game:timerTick", ({ remainingPerMove, remainingPerGame }) => {
      setSnapshot((prev) => (prev ? { ...prev, remainingPerMove, remainingPerGame } : prev));
    });
    socket.on("game:turnTimeout", ({ timedOut, nextTurn }) => {
      setTimeoutFlash(timedOut);
      setTimeoutNotice({
        id: Date.now(),
        text: `${timedOut} TIME EXPIRED - TURN PASSED TO ${nextTurn}`
      });
      setMessageTone("error");
      setMessage(`${timedOut} timed out. Turn switched to ${nextTurn}.`);
      setSnapshot((prev) => (prev ? { ...prev, turn: nextTurn } : prev));
    });
    socket.on("game:rematchRequested", ({ fromUserId, fromUsername }) => {
      if (fromUserId === user.id) return;
      setIncomingRematch({ fromUserId, fromUsername });
      setMessageTone("info");
      setMessage(`${fromUsername} proposed a rematch.`);
    });
    socket.on("game:rematchResponse", ({ byUserId, byUsername, accepted }) => {
      if (!accepted) {
        setRematchPending(false);
        setIncomingRematch(null);
        setMessageTone("info");
        setMessage(`${byUsername} declined the rematch request.`);
        return;
      }
      if (byUserId !== user.id) {
        setMessageTone("info");
        setMessage(`${byUsername} accepted rematch. Starting...`);
      }
    });
    socket.on("room:error", ({ message: m }) => {
      setRematchPending(false);
      setIncomingRematch(null);
      setMessageTone("error");
      setMessage(m);
    });
    return () => {
      socket.off("room:stateSync");
      socket.off("game:timerTick");
      socket.off("game:turnTimeout");
      socket.off("game:rematchRequested");
      socket.off("game:rematchResponse");
      socket.off("room:error");
    };
  }, [isLocal, rematchPending, roomCode, user]);

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
    if (!isLocal || !devModeEnabled || selectedCell === null) {
      setDevPossibleAnswers([]);
      setDevAnswersLoading(false);
      return;
    }
    const rPrompt = selectedRow !== null ? localRowChallenges[selectedRow] : null;
    const cPrompt = selectedCol !== null ? localColChallenges[selectedCol] : null;
    if (!rPrompt || !cPrompt) {
      setDevPossibleAnswers([]);
      return;
    }
    let cancelled = false;
    setDevAnswersLoading(true);
    void api
      .nbaPossibleAnswers({
        challengeIds: [rPrompt.id, cPrompt.id],
        usedKeys: localUsedAnswerKeys,
        limit: 250
      })
      .then((rows) => {
        if (!cancelled) setDevPossibleAnswers(rows);
      })
      .finally(() => {
        if (!cancelled) setDevAnswersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [devModeEnabled, isLocal, localColChallenges, localRowChallenges, localUsedAnswerKeys, selectedCell, selectedCol, selectedRow]);

  const replayBoard = useMemo(() => {
    if (!snapshot || replayIdx === null) return null;
    const boardView = Array(snapshot.board.length).fill(null) as ("X" | "O" | null)[];
    snapshot.moves.slice(0, replayIdx).forEach((m) => {
      boardView[m.index] = m.symbol;
    });
    return boardView;
  }, [replayIdx, snapshot]);

  const onlineAnswersByIndex = useMemo(() => {
    if (!snapshot) return {};
    const upto = replayIdx ?? snapshot.moves.length;
    const out: Record<number, TileClaim> = {};
    snapshot.moves.slice(0, upto).forEach((m, i) => {
      const answer = snapshot.usedAnswers[i];
      if (answer) out[m.index] = { name: answer.name, headshotUrl: answer.headshotUrl ?? null };
    });
    return out;
  }, [replayIdx, snapshot]);

  const handleMove = (index: number) => {
    setMessage("");
    if (!hasChallengesLoaded) {
      setMessageTone("error");
      setMessage("Challenges are still loading.");
      return;
    }
    if (!isMyTurn) {
      setMessageTone("error");
      setMessage("Wait for your turn.");
      return;
    }
    if (isLocal && (!localState || localRoundWinner || localMatchWinner)) {
      setMessageTone("info");
      setMessage(localMatchWinner ? "Match already ended. Start a rematch." : "Round already ended.");
      return;
    }
    setSelectedCell(index);
  };

  const submitAnswer = async () => {
    if (selectedCell === null) return;
    if (!hasChallengesLoaded) {
      setMessageTone("error");
      setMessage("Challenges are still loading.");
      return;
    }
    if (!isMyTurn) {
      setMessageTone("error");
      setMessage("Wait for your turn.");
      return;
    }
    if (!answerInput.trim()) {
      setMessageTone("error");
      setMessage("Enter an NBA player name.");
      return;
    }
    setSubmittingAnswer(true);
    try {
      if (isLocal) {
        if (!localState) {
          setMessageTone("error");
          setMessage("Local game is not initialized.");
          return;
        }
        if (localRoundWinner || localMatchWinner) {
          setMessageTone("info");
          setMessage("Round is complete.");
          return;
        }
        const rPrompt = selectedRow !== null ? localRowChallenges[selectedRow] : null;
        const cPrompt = selectedCol !== null ? localColChallenges[selectedCol] : null;
        if (!rPrompt || !cPrompt) {
          setMessageTone("error");
          setMessage("Challenge not loaded for this cell.");
          return;
        }
        const verdict = await api.nbaValidate({ challengeIds: [rPrompt.id, cPrompt.id], answer: answerInput, usedKeys: localUsedAnswerKeys });
        if (!verdict.ok) {
          setMessageTone("error");
          setMessage(verdict.reason ?? "Invalid NBA answer.");
          return;
        }
        setLocalState(playLocalMove(localState, selectedCell));
        setLocalUsedAnswerKeys((prev) => [...prev, verdict.key!]);
        setLocalAnswersByIndex((prev) => ({
          ...prev,
          [selectedCell]: {
            name: verdict.canonical ?? answerInput.trim(),
            headshotUrl: verdict.headshotUrl ?? null
          }
        }));
        setMessageTone("success");
        setMessage("Correct answer.");
        if (timerMode === "per_move") setLocalRemainingPerMove(localPerMove);
        setSelectedCell(null);
        setAnswerInput("");
        setPlayerOptions([]);
        setActiveOption(-1);
        return;
      }

      if (!user || !roomCode) {
        setMessageTone("error");
        setMessage("Online session unavailable.");
        return;
      }
      getSocket().emit("game:move", { userId: user.id, roomCode, index: selectedCell, answer: answerInput });
      setMessageTone("info");
      setMessage("Answer submitted.");
      setSelectedCell(null);
      setAnswerInput("");
      setPlayerOptions([]);
      setActiveOption(-1);
    } catch {
      setMessageTone("error");
      setMessage("Could not submit answer.");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const rematchNow = () => {
    if (isLocal) {
      const variant = localState?.variant ?? "3x3";
      if (localRoundAdvanceRef.current) {
        clearTimeout(localRoundAdvanceRef.current);
        localRoundAdvanceRef.current = null;
      }
      setLocalState(newLocalGame(variant));
      reloadLocalChallenges(variant);
      setLocalRound(1);
      setLocalScore({ X: 0, O: 0 });
      setLocalRoundWinner(null);
      setLocalMatchWinner(null);
      setLocalUsedAnswerKeys([]);
      setLocalAnswersByIndex({});
      setSelectedCell(null);
      setAnswerInput("");
      setPlayerOptions([]);
      setActiveOption(-1);
      setMessageTone("info");
      setMessage("New match started.");
      setLocalRemainingPerMove(timerMode === "per_move" ? localPerMove : null);
      return;
    }
    if (!user || !roomCode) return;
    setRematchPending(true);
    setMessageTone("info");
    setMessage("Rematch request sent. Waiting for opponent.");
    getSocket().emit("game:rematchRequest", { userId: user.id, roomCode });
  };

  const leaveGameNow = () => {
    if (!isLocal && user && roomCode) {
      getSocket().emit("room:leave", { userId: user.id, roomCode });
    }
    router.push("/");
  };

  const surrenderNow = () => {
    if (isLocal) {
      const losingTurn = localState?.turn ?? "X";
      const winner = losingTurn === "X" ? "O" : "X";
      setLocalState((s) => (s ? { ...s, winner } : s));
      setMessageTone("info");
      setMessage(`${losingTurn === "X" ? localXName : localOName} surrendered.`);
      return;
    }
    if (!user || !roomCode) return;
    getSocket().emit("game:surrender", { userId: user.id, roomCode });
    setMessageTone("info");
    setMessage("Surrender sent.");
  };

  const runConfirmedAction = () => {
    if (!confirmAction) return;
    if (confirmAction === "leave") leaveGameNow();
    if (confirmAction === "surrender") surrenderNow();
    if (confirmAction === "rematch") rematchNow();
    setConfirmAction(null);
  };

  const toggleDevMode = () => {
    if (!devModeEnabled) {
      setConfirmDevMode(true);
      return;
    }
    setDevModeEnabled(false);
    setDevPossibleAnswers([]);
  };

  const confirmEnableDevMode = () => {
    setDevModeEnabled(true);
    setConfirmDevMode(false);
    setMessageTone("info");
    setMessage("Developer mode enabled.");
  };

  const respondRematch = (accepted: boolean) => {
    if (isLocal || !user || !roomCode || !incomingRematch) return;
    getSocket().emit("game:rematchRespond", { userId: user.id, roomCode, accepted });
    if (!accepted) {
      setMessageTone("info");
      setMessage("Rematch declined.");
    } else {
      setMessageTone("info");
      setMessage("Rematch accepted. Starting...");
    }
    setIncomingRematch(null);
  };

  const shareMatch = async () => {
    const link = !isLocal && roomCode ? `${window.location.origin}/room/${roomCode}` : window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setMessageTone("success");
      setMessage("Link copied.");
    } catch {
      setMessageTone("error");
      setMessage("Could not copy link.");
    }
  };

  const localWinner = localState ? checkWinner(localState.board, localState.variant).winner : null;
  const winner = isLocal ? localMatchWinner ?? localRoundWinner ?? localWinner : snapshot?.winner ?? null;
  const activeBoard = replayBoard ?? board;
  const userSymbol = !isLocal ? snapshot?.players.find((p) => p.userId === user?.id)?.symbol : undefined;
  const currentTurn = isLocal ? localState?.turn : snapshot?.turn;
  const isLocalRoundActive = Boolean(isLocal && localState && !localRoundWinner && !localMatchWinner);
  const isMyTurn = isLocal ? (isLocalRoundActive ? (mode === "ai" ? currentTurn === playerSide : true) : false) : userSymbol === currentTurn;
  const hasChallengesLoaded = isLocal
    ? localRowChallenges.length === size && localColChallenges.length === size
    : Boolean(snapshot?.rowChallenges?.length === size && snapshot?.colChallenges?.length === size);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (!["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key)) return;
      const idx = Number(e.key) - 1;
      if (size !== 3) return;
      if (!hasChallengesLoaded) return;
      if (!isMyTurn) return;
      setSelectedCell(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasChallengesLoaded, isMyTurn, size]);

  const selectedChallengeLabel = isLocal
    ? selectedCell !== null
      ? `${localRowChallenges[selectedRow ?? 0]?.text ?? "Any NBA player"} + ${localColChallenges[selectedCol ?? 0]?.text ?? "Any NBA player"}`
      : null
    : selectedCell !== null
      ? `${snapshot?.rowChallenges[selectedRow ?? 0] ?? "Any NBA player"} + ${snapshot?.colChallenges[selectedCol ?? 0] ?? "Any NBA player"}`
      : null;
  const rowLabels = isLocal ? localRowChallenges.map((c) => c.text) : snapshot?.rowChallenges ?? Array(size).fill("Row prompt");
  const colLabels = isLocal ? localColChallenges.map((c) => c.text) : snapshot?.colChallenges ?? Array(size).fill("Column prompt");

  const chooseOption = (name: string) => {
    setAnswerInput(name);
    setPlayerOptions([]);
    setActiveOption(-1);
  };

  useEffect(() => {
    if (!isMyTurn || !hasChallengesLoaded) {
      setSelectedCell(null);
    }
  }, [hasChallengesLoaded, isMyTurn]);

  useEffect(() => {
    if (!timeoutNotice) return;
    const t = setTimeout(() => setTimeoutNotice(null), 2600);
    return () => clearTimeout(t);
  }, [timeoutNotice]);

  useEffect(() => {
    if (!timeoutFlash) return;
    const t = setTimeout(() => setTimeoutFlash(null), 2000);
    return () => clearTimeout(t);
  }, [timeoutFlash]);

  const px = isLocal
    ? { username: localXName, rating: undefined }
    : snapshot?.players.find((p) => p.symbol === "X") ?? snapshot?.players[0];
  const po = isLocal
    ? { username: localOName, rating: undefined }
    : snapshot?.players.find((p) => p.symbol === "O") ?? snapshot?.players[1];
  const leftMeta = isLocal ? (mode === "ai" && localXName === "AI Bot" ? "CPU Opponent" : "Local Device") : "Los Angeles, CA";
  const rightMeta = isLocal ? (mode === "ai" && localOName === "AI Bot" ? "CPU Opponent" : "Local Device") : "Chicago, IL";
  const leftRankLabel = isLocal ? "Local" : "Ranked";
  const rightRankLabel = isLocal ? "Local" : "Ranked";
  const leftActive = currentTurn === "X";
  const rightActive = currentTurn === "O";
  const leftTurnLabel = isLocal ? (leftActive ? "Player 1 Turn" : "Waiting") : leftActive ? "Your Turn" : "Waiting";
  const rightTurnLabel = isLocal ? (rightActive ? "Player 2 Turn" : "Waiting") : rightActive ? "Opponent Turn" : "Waiting";
  const timeLabel = (seconds?: number | null) => {
    if (seconds === undefined || seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
  const leftTime = timeLabel(isLocal ? (leftActive ? localRemainingPerMove : null) : snapshot?.remainingPerMove);
  const rightTime = timeLabel(isLocal ? (rightActive ? localRemainingPerMove : null) : snapshot?.remainingPerMove);

  return (
    <div className="min-h-screen bg-[#121212] text-[#e5e5e5]" style={{ fontFamily: "Lexend, system-ui, sans-serif" }}>
      <header className="z-20 flex h-16 items-center justify-between border-b border-[#2a2a2a] bg-[#1e1e1e] px-6 shadow-subtle">
        <div className="flex items-center gap-8">
          <button type="button" onClick={() => router.push("/")} className="group flex items-center gap-3">
            <span className="material-symbols-outlined grid h-8 w-8 place-items-center rounded bg-[#ee8c2b] text-[#221910]">sports_basketball</span>
            <span className="text-xl font-bold uppercase tracking-wide" style={{ fontFamily: "Oswald, sans-serif" }}>
              NBA <span className="text-[#ee8c2b]">TTT</span>
            </span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            <button type="button" className="rounded bg-[#2a2a2a]/50 px-4 py-2 text-sm font-medium text-white">Play</button>
            <button type="button" onClick={() => router.push("/leaderboard")} className="px-4 py-2 text-sm font-medium text-[#a3a3a3] transition-colors hover:text-white">Leaderboard</button>
            <button type="button" onClick={() => router.push("/profile")} className="px-4 py-2 text-sm font-medium text-[#a3a3a3] transition-colors hover:text-white">Profile</button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {SHOW_DEV_MODE_TOGGLE && isLocal && (
            <button
              type="button"
              onClick={toggleDevMode}
              className={`rounded border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                devModeEnabled
                  ? "border-amber-400/70 bg-amber-500/20 text-amber-200"
                  : "border-[#2a2a2a] bg-[#121212] text-[#a3a3a3] hover:text-white"
              }`}
            >
              {devModeEnabled ? "Dev Mode On" : "Dev Mode Off"}
            </button>
          )}
          <UIButton variant="secondary" onClick={() => setConfirmAction("leave")}>Leave Game</UIButton>
        </div>
      </header>

      <main className="relative flex min-h-[calc(100vh-4rem)] overflow-y-auto">
        <aside className="hidden w-80 flex-col border-r border-[#2a2a2a] bg-[#121212] lg:flex">
          <div className="border-b border-[#2a2a2a] bg-gradient-to-b from-[#1e1e1e] to-[#121212] p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">{leftRankLabel}</div>
                <div className="text-2xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>{px?.rating ?? (isLocal ? "--" : 1240)}</div>
              </div>
            </div>
            <h2 className="mb-1 text-xl font-bold text-white">{px?.username ?? "Player X"}</h2>
            <div className="mb-6 text-sm text-[#a3a3a3]">{leftMeta}</div>
            <div
              className={`rounded-lg border p-4 ${
                timeoutFlash === "X"
                  ? "animate-pulse border-red-500/50 bg-red-500/10"
                  : leftActive
                    ? "border-blue-500/30 bg-[#1e1e1e] shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                    : "border-[#2a2a2a] bg-[#1e1e1e]/70 opacity-70"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${leftActive ? "animate-pulse text-blue-500" : "text-[#a3a3a3]"}`}>{leftTurnLabel}</span>
                <span className="material-symbols-outlined text-blue-500">schedule</span>
              </div>
              <div className="text-4xl font-bold tabular-nums text-white" style={{ fontFamily: "Oswald, sans-serif" }}>{leftTime}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#a3a3a3]">Series History</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded border border-[#2a2a2a] bg-[#1e1e1e] p-3">
                <span className="text-sm font-medium text-white">vs {po?.username ?? "Opponent"}</span>
                <span className="text-xs font-bold text-[#ee8c2b]">IN PROGRESS</span>
              </div>
              <div className="rounded border border-[#2a2a2a]/50 p-3 text-sm text-[#a3a3a3]">Round: {isLocal ? localRound : snapshot?.round ?? 1}</div>
              <div className="rounded border border-[#2a2a2a]/50 p-3 text-sm text-[#a3a3a3]">Score: {isLocal ? localScore.X : snapshot?.score.X ?? 0} - {isLocal ? localScore.O : snapshot?.score.O ?? 0}</div>
            </div>
            <div className="mt-8">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#a3a3a3]">Match Snapshot</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-[#2a2a2a] bg-[#1e1e1e] p-3">
                  <div className="mb-1 text-xs text-[#a3a3a3]">Series</div>
                  <div className="text-lg font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>Best of {isLocal ? localSeriesLength : snapshot?.settings.seriesLength ?? 3}</div>
                </div>
                <div className="rounded border border-[#2a2a2a] bg-[#1e1e1e] p-3">
                  <div className="mb-1 text-xs text-[#a3a3a3]">Board</div>
                  <div className="text-lg font-bold text-green-500" style={{ fontFamily: "Oswald, sans-serif" }}>{size}x{size}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative flex flex-1 flex-col items-center justify-start bg-[#121212] px-4 pb-12 pt-8 md:px-8 md:pt-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-5">
            <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
            <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
            <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-white" />
          </div>
          {devModeEnabled && (
            <div className="z-20 mb-2 inline-flex items-center gap-2 rounded border border-amber-400/60 bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <span className="material-symbols-outlined text-sm">construction</span>
              Developer Mode Enabled
            </div>
          )}
          {winner && winner !== "draw" && <div className="pointer-events-none absolute inset-0">{confetti}</div>}
          <div className="z-10 mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-xs font-medium uppercase tracking-wider text-[#a3a3a3]">{isLocal ? "Local Match" : "Ranked Match"} - Game {isLocal ? localRound : snapshot?.round ?? 1}</span>
            </div>
            {timeoutNotice && (
              <div className="mb-3 inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300">
                <span className="material-symbols-outlined text-base">timer_off</span>
                {timeoutNotice.text}
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-wide text-white md:text-4xl" style={{ fontFamily: "Oswald, sans-serif" }}>
              {winner
                ? winner === "draw"
                  ? "DRAW"
                  : isLocal
                    ? `${winner === "X" ? localXName : localOName} WINS${localMatchWinner ? " THE MATCH" : " THE ROUND"}`
                    : `${winner} WINS`
                : "YOUR TURN"}
            </h1>
            <p className="mt-1 text-sm text-[#a3a3a3]">Select a square to place your mark</p>
          </div>
          <div className="relative z-40 mt-5 w-full max-w-[860px] overflow-visible rounded border border-[#2a2a2a] bg-[#1e1e1e] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#a3a3a3]">Challenge</p>
            <p className="mt-2 text-sm leading-relaxed text-white">
              {hasChallengesLoaded
                ? selectedChallengeLabel ?? "Select a board tile to load the challenge."
                : "Loading challenges..."}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative z-50 w-full">
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
                  placeholder="Type NBA player..."
                  className="focusable w-full rounded border border-[#2a2a2a] bg-[#121212] px-3 py-3 text-sm text-white placeholder-gray-600"
                />
                {!!playerOptions.length && (
                  <div className="absolute z-[70] mt-1 max-h-56 w-full overflow-auto rounded border border-[#2a2a2a] bg-[#121212] p-1 shadow-2xl">
                    {playerOptions.map((p, i) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`block w-full rounded px-3 py-2 text-left text-sm ${i === activeOption ? "bg-[#ee8c2b]/20 text-[#ee8c2b]" : "text-[#e5e5e5] hover:bg-[#2a2a2a]"}`}
                        onClick={() => chooseOption(p.name)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={selectedCell === null || submittingAnswer || !hasChallengesLoaded || !isMyTurn}
                onClick={submitAnswer}
                className="rounded bg-[#ee8c2b] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#221910] transition-all hover:bg-[#da7d22] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Answer
              </button>
            </div>
          </div>
          {devModeEnabled && isLocal && selectedCell !== null && (
            <div className="relative z-40 mt-4 w-full max-w-[860px] rounded border border-amber-400/40 bg-[#161616] p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Dev Inspector: Possible Answers</p>
                <p className="text-[11px] text-[#a3a3a3]">{devAnswersLoading ? "Loading..." : `${devPossibleAnswers.length} results`}</p>
              </div>
              <div className="max-h-52 overflow-auto rounded border border-[#2a2a2a] bg-[#121212] p-2">
                {devAnswersLoading ? (
                  <p className="px-2 py-1 text-sm text-[#a3a3a3]">Loading possible answers...</p>
                ) : devPossibleAnswers.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-[#a3a3a3]">No answers for this intersection.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {devPossibleAnswers.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className="flex items-center gap-2 rounded border border-[#2a2a2a] bg-[#1b1b1b] px-2 py-1.5 text-left hover:bg-[#222]"
                        onClick={() => setAnswerInput(p.name)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            p.headshotUrl ??
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=64&background=1f2937&color=f8fafc&bold=true&rounded=true&format=png`
                          }
                          alt={p.name}
                          className="h-8 w-8 rounded object-cover"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=64&background=1f2937&color=f8fafc&bold=true&rounded=true&format=png`;
                            if (img.src !== fb) img.src = fb;
                          }}
                        />
                        <span className="line-clamp-1 text-xs text-white">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-8 w-full">
            <GameBoard
              board={activeBoard}
              rowLabels={rowLabels}
              colLabels={colLabels}
              cellAnswersByIndex={isLocal ? localAnswersByIndex : onlineAnswersByIndex}
              hoverSymbol={currentTurn === "O" ? "O" : "X"}
              onCell={handleMove}
              size={size}
              compact
              disabled={Boolean((!isLocal && snapshot?.state !== "IN_GAME") || !hasChallengesLoaded || !isMyTurn || (isLocal && !isLocalRoundActive))}
            />
          </div>
          {message && (
            <p className={`z-10 mt-4 text-sm ${messageTone === "error" ? "text-red-400" : messageTone === "success" ? "text-emerald-400" : "text-slate-300"}`}>
              {message}
            </p>
          )}
          {snapshot?.state === "MATCH_END" && (
            <div className="z-10 mt-4 flex items-center gap-2">
              <UIButton variant="secondary" onClick={() => setReplayIdx((replayIdx ?? snapshot.moves.length) - 1)}>Replay -</UIButton>
              <span className="text-xs font-bold uppercase tracking-wider text-[#a3a3a3]">Frame {replayIdx ?? snapshot.moves.length}</span>
              <UIButton variant="secondary" onClick={() => setReplayIdx(Math.min((replayIdx ?? 0) + 1, snapshot.moves.length))}>Replay +</UIButton>
            </div>
          )}
        </section>

        <aside className="hidden w-80 flex-col border-l border-[#2a2a2a] bg-[#121212] lg:flex">
          <div className="border-b border-[#2a2a2a] p-6">
            <div className="mb-4 flex items-start justify-between opacity-80">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">{rightRankLabel}</div>
                <div className="text-2xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>{po?.rating ?? (isLocal ? "--" : 1215)}</div>
              </div>
            </div>
            <h2 className="mb-1 text-xl font-bold text-white">{po?.username ?? "Player O"}</h2>
            <div className="mb-6 text-sm text-[#a3a3a3]">{rightMeta}</div>
            <div
              className={`rounded-lg border p-4 ${
                timeoutFlash === "O"
                  ? "animate-pulse border-red-500/50 bg-red-500/10"
                  : rightActive
                    ? "border-blue-500/30 bg-[#1e1e1e] shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                    : "border-[#2a2a2a] bg-[#1e1e1e]/70 opacity-70"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${rightActive ? "animate-pulse text-blue-500" : "text-[#a3a3a3]"}`}>{rightTurnLabel}</span>
                <span className="material-symbols-outlined text-[#a3a3a3]">schedule</span>
              </div>
              <div className="text-4xl font-bold tabular-nums text-[#a3a3a3]" style={{ fontFamily: "Oswald, sans-serif" }}>{rightTime}</div>
            </div>
          </div>
          <div className="flex flex-1 flex-col p-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#a3a3a3]">Match Actions</h3>
            <div className="space-y-3">
              <button type="button" onClick={() => setConfirmAction("rematch")} className="w-full rounded border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3 text-sm font-medium text-white transition-all hover:bg-[#2a2a2a]">
                Propose Rematch
              </button>
              <button type="button" onClick={() => setConfirmAction("surrender")} className="w-full rounded border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3 text-sm font-medium text-red-500 transition-all hover:border-red-500/30 hover:bg-red-500/10">
                Surrender
              </button>
            </div>

            <div className="mt-8 rounded border border-[#2a2a2a] bg-[#1e1e1e] p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#a3a3a3]">Match Info</h4>
              <div className="space-y-2 text-xs text-[#c9c9c9]">
                <p>Mode: {isLocal ? mode.toUpperCase() : "ONLINE"}</p>
                <p>Board: {size}x{size}</p>
                <p>Series: Best of {isLocal ? localSeriesLength : snapshot?.settings.seriesLength ?? 3}</p>
                <p>Timer: {(snapshot?.settings.timerMode ?? timerMode).replace("_", " ").toUpperCase()}</p>
              </div>
            </div>

            <div className="mt-auto flex justify-end gap-2 pt-6">
              <button type="button" onClick={shareMatch} className="rounded border border-[#2a2a2a] bg-[#1e1e1e] px-3 py-2 text-[#a3a3a3] transition-colors hover:bg-[#2a2a2a] hover:text-white">
                <span className="material-symbols-outlined text-base">share</span>
              </button>
            </div>
          </div>
        </aside>
      </main>

      {(confirmAction || rematchPending || incomingRematch || confirmDevMode) && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-5 shadow-2xl">
            {confirmAction && (
              <>
                <h3 className="text-lg font-bold uppercase tracking-wide text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                  {confirmAction === "leave" ? "Leave Match?" : confirmAction === "surrender" ? "Confirm Surrender?" : "Request Rematch?"}
                </h3>
                <p className="mt-3 text-sm text-[#c9c9c9]">
                  {confirmAction === "leave"
                    ? "You will exit this game screen."
                    : confirmAction === "surrender"
                      ? "This forfeits the current round immediately."
                      : isLocal
                        ? "This will reset the current local match and score."
                        : "Your request will be sent. Match restarts when both players accept."}
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-[#2a2a2a] px-4 py-2 text-sm text-[#c9c9c9] hover:bg-[#2a2a2a]"
                    onClick={() => setConfirmAction(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`rounded px-4 py-2 text-sm font-bold uppercase tracking-wide ${
                      confirmAction === "surrender" ? "bg-red-600 text-white hover:bg-red-500" : "bg-[#ee8c2b] text-[#221910] hover:bg-[#da7d22]"
                    }`}
                    onClick={runConfirmedAction}
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}

            {!confirmAction && rematchPending && (
              <>
                <h3 className="text-lg font-bold uppercase tracking-wide text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                  Rematch Requested
                </h3>
                <p className="mt-3 text-sm text-[#c9c9c9]">Waiting for opponent to accept the rematch request.</p>
                <div className="mt-5 flex items-center justify-end">
                  <button
                    type="button"
                    className="rounded border border-[#2a2a2a] px-4 py-2 text-sm text-[#c9c9c9] hover:bg-[#2a2a2a]"
                    onClick={() => setRematchPending(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {!confirmAction && !rematchPending && incomingRematch && (
              <>
                <h3 className="text-lg font-bold uppercase tracking-wide text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                  Rematch Proposal
                </h3>
                <p className="mt-3 text-sm text-[#c9c9c9]">{incomingRematch.fromUsername} wants a rematch. Accept?</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-[#2a2a2a] px-4 py-2 text-sm text-[#c9c9c9] hover:bg-[#2a2a2a]"
                    onClick={() => respondRematch(false)}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#ee8c2b] px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#221910] hover:bg-[#da7d22]"
                    onClick={() => respondRematch(true)}
                  >
                    Accept
                  </button>
                </div>
              </>
            )}

            {!confirmAction && !rematchPending && !incomingRematch && confirmDevMode && (
              <>
                <h3 className="text-lg font-bold uppercase tracking-wide text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                  Enable Developer Mode?
                </h3>
                <p className="mt-3 text-sm text-[#c9c9c9]">
                  Developer mode shows all valid answers for the selected tile (local matches only).
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-[#2a2a2a] px-4 py-2 text-sm text-[#c9c9c9] hover:bg-[#2a2a2a]"
                    onClick={() => setConfirmDevMode(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-amber-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#221910] hover:bg-amber-400"
                    onClick={confirmEnableDevMode}
                  >
                    Enable
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
