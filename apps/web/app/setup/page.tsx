"use client";

import type { RoomSettings } from "@nba/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { UIButton } from "../../components/ui/Button";
import { UICard } from "../../components/ui/Card";
import { getSocket } from "../../lib/socket";
import { useApp } from "../providers";

const LOCAL_MATCH_CONFIG_KEY = "nba_ttt_local_match_config_v1";

const baseSettings: RoomSettings = {
  seriesLength: 3,
  timerMode: "per_move",
  perMoveSeconds: 10,
  perGameSeconds: 60,
  boardVariant: "3x3",
  drawMode: "ignore",
  boardSkin: "classic"
};

function SetupPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useApp();
  const mode = params.get("mode") ?? "local";

  const [ranked, setRanked] = useState(mode === "online_ranked");
  const [difficulty, setDifficulty] = useState("hard");
  const [side, setSide] = useState<"X" | "O">("X");
  const [settings, setSettings] = useState<RoomSettings>(baseSettings);
  const [perMoveInput, setPerMoveInput] = useState(String(baseSettings.perMoveSeconds));
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPerMoveInput(String(settings.perMoveSeconds));
  }, [settings.perMoveSeconds]);

  useEffect(() => {
    const socket = getSocket();
    if (user) socket.emit("session:resume", { userId: user.id });

    socket.on("matchmaking:found", ({ roomCode: code, matchId }) => {
      router.push(`/match/${matchId}?room=${code}`);
    });

    socket.on("room:stateSync", (snapshot) => {
      if (snapshot.roomCode && status === "Creating room...") {
        router.push(`/room/${snapshot.roomCode}`);
      }
    });

    return () => {
      socket.off("matchmaking:found");
      socket.off("room:stateSync");
    };
  }, [router, status, user]);

  const startLocal = () => {
    const payload = {
      mode,
      difficulty,
      side,
      settings: {
        seriesLength: settings.seriesLength,
        timerMode: settings.timerMode,
        perMoveSeconds: settings.perMoveSeconds,
        boardVariant: settings.boardVariant
      }
    };
    try {
      sessionStorage.setItem(LOCAL_MATCH_CONFIG_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures; match page will fall back to defaults.
    }
    router.push("/match/local");
  };

  const queueOnline = () => {
    if (!user) return setStatus("Create guest account first.");
    setStatus("Searching for opponent...");
    getSocket().emit("matchmaking:join", { ranked, userId: user.id });
  };

  const createRoom = () => {
    if (!user) return setStatus("Create guest account first.");
    setStatus("Creating room...");
    getSocket().emit("room:create", { userId: user.id, settings });
  };

  const joinRoom = () => {
    if (!user || !roomCode) return;
    router.push(`/room/${roomCode.toUpperCase()}`);
  };

  return (
    <main className="min-h-screen bg-[#121212] text-slate-100">
      <header className="nav-shell sticky top-0 z-30">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 md:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Game Preparation</p>
            <h1 className="text-xl font-black uppercase tracking-tight">Mode Setup</h1>
          </div>
          <div className="app-chip">{mode.replaceAll("_", " ").toUpperCase()}</div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-6 lg:grid-cols-[1.2fr_1fr]">
        <UICard className="rounded-2xl border-white/15 p-6">
          <h2 className="text-2xl font-black uppercase tracking-tight">Match Settings</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              SERIES
              <select
                className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm"
                value={settings.seriesLength}
                onChange={(e) => setSettings({ ...settings, seriesLength: Number(e.target.value) as 1 | 3 | 5 })}
              >
                <option value={1}>BEST OF 1</option>
                <option value={3}>BEST OF 3</option>
                <option value={5}>BEST OF 5</option>
              </select>
            </label>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              TIMER MODE
              <select
                className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm"
                value={settings.timerMode}
                onChange={(e) => setSettings({ ...settings, timerMode: e.target.value as RoomSettings["timerMode"] })}
              >
                <option value="none">NONE</option>
                <option value="per_move">PER MOVE</option>
                <option value="per_game">PER GAME</option>
              </select>
            </label>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              PER-MOVE SECONDS
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={perMoveInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const normalized = digits.replace(/^0+(?=\d)/, "");
                  setPerMoveInput(normalized);
                  setSettings({ ...settings, perMoveSeconds: normalized ? Number(normalized) : 0 });
                }}
                onBlur={() => {
                  if (!perMoveInput || Number(perMoveInput) <= 0) {
                    setPerMoveInput("10");
                    setSettings({ ...settings, perMoveSeconds: 10 });
                  }
                }}
                className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm"
              />
            </label>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              BOARD
              <select
                className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm"
                value={settings.boardVariant}
                onChange={(e) => setSettings({ ...settings, boardVariant: e.target.value as RoomSettings["boardVariant"] })}
              >
                <option value="3x3">3x3</option>
                <option value="4x4">4x4</option>
              </select>
            </label>
          </div>
        </UICard>

        <UICard className="rounded-2xl border-white/15 p-6">
          <h2 className="text-2xl font-black uppercase tracking-tight">Mode Controls</h2>

          <div className="mt-4 space-y-3">
            {(mode === "local" || mode === "ai") && (
              <>
                {mode === "ai" && (
                  <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
                    AI DIFFICULTY
                    <select className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option value="easy">EASY</option>
                      <option value="medium">MEDIUM</option>
                      <option value="hard">HARD</option>
                    </select>
                  </label>
                )}

                <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
                  YOUR SIDE
                  <select className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm" value={side} onChange={(e) => setSide(e.target.value as "X" | "O")}>
                    <option value="X">X</option>
                    <option value="O">O</option>
                  </select>
                </label>

                <UIButton className="w-full" onClick={startLocal}>
                  Start Match
                </UIButton>
              </>
            )}

            {(mode === "online_ranked" || mode === "online_unranked") && (
              <>
                <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.11em] text-slate-300">
                  <input type="checkbox" className="h-4 w-4 accent-orange-500" checked={ranked} onChange={(e) => setRanked(e.target.checked)} />
                  RANKED QUEUE
                </label>
                <UIButton className="w-full" onClick={queueOnline}>
                  Quick Match
                </UIButton>
                <UIButton className="w-full" variant="secondary" onClick={createRoom}>
                  Create Private Room
                </UIButton>
                <div className="flex gap-2">
                  <input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="ROOMCODE"
                    className="focusable w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm uppercase"
                  />
                  <UIButton variant="secondary" onClick={joinRoom}>
                    Join
                  </UIButton>
                </div>
              </>
            )}

            {mode === "private_room" && (
              <>
                <UIButton className="w-full" onClick={createRoom}>
                  Create Room
                </UIButton>
                <div className="flex gap-2">
                  <input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="ROOMCODE"
                    className="focusable w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm uppercase"
                  />
                  <UIButton variant="secondary" onClick={joinRoom}>
                    Join
                  </UIButton>
                </div>
              </>
            )}
          </div>

          {status && <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-orange-300">{status}</p>}
        </UICard>
      </section>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-background-dark text-slate-200">Loading setup...</main>}>
      <SetupPageContent />
    </Suspense>
  );
}
