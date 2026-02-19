"use client";

import type { RoomSettings } from "@nba/contracts";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { UIButton } from "../../components/ui/Button";
import { UICard } from "../../components/ui/Card";
import { useApp } from "../providers";
import { getSocket } from "../../lib/socket";

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
  const [roomCode, setRoomCode] = useState("");
  const [status, setStatus] = useState("");

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
    router.push(
      `/match/local?mode=${mode}&difficulty=${difficulty}&side=${side}&series=${settings.seriesLength}&timerMode=${settings.timerMode}&perMove=${settings.perMoveSeconds}&board=${settings.boardVariant}`
    );
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
    <main className="arena-shell mx-auto min-h-screen w-full max-w-[1320px] px-12 py-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Game Preparation</p>
          <h1 className="font-display text-6xl uppercase leading-none tracking-wide">Mode Setup</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.14em] text-slate-300">Selected: {mode.replaceAll("_", " ")}</p>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-6">
        <UICard className="space-y-4 rounded-[24px] p-7">
          <h2 className="font-display text-4xl uppercase tracking-wide">Match Settings</h2>
          <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
            Series
            <select
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm"
              value={settings.seriesLength}
              onChange={(e) => setSettings({ ...settings, seriesLength: Number(e.target.value) as 1 | 3 | 5 })}
            >
              <option value={1}>Bo1</option>
              <option value={3}>Bo3</option>
              <option value={5}>Bo5</option>
            </select>
          </label>

          <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
            Timer Mode
            <select
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm"
              value={settings.timerMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  timerMode: e.target.value as RoomSettings["timerMode"]
                })
              }
            >
              <option value="none">None</option>
              <option value="per_move">Per Move</option>
              <option value="per_game">Per Game</option>
            </select>
          </label>

          <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
            Per-move Seconds
            <input
              type="number"
              value={settings.perMoveSeconds}
              onChange={(e) => setSettings({ ...settings, perMoveSeconds: Number(e.target.value) })}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm"
            />
          </label>

          <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
            Board
            <select
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm"
              value={settings.boardVariant}
              onChange={(e) => setSettings({ ...settings, boardVariant: e.target.value as RoomSettings["boardVariant"] })}
            >
              <option value="3x3">3x3</option>
              <option value="4x4">4x4</option>
            </select>
          </label>
        </UICard>

        <UICard className="space-y-4 rounded-[24px] p-7">
          <h2 className="font-display text-4xl uppercase tracking-wide">Mode Controls</h2>

          {(mode === "local" || mode === "ai") && (
            <>
              {mode === "ai" && (
                <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
                  AI Difficulty
                  <select className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              )}
              <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
                Your Side
                <select className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm" value={side} onChange={(e) => setSide(e.target.value as "X" | "O")}>
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
              <label className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                <input type="checkbox" className="h-4 w-4 accent-orange-500" checked={ranked} onChange={(e) => setRanked(e.target.checked)} />
                Ranked queue
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
                  className="w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm uppercase"
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
                  className="w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm uppercase"
                />
                <UIButton variant="secondary" onClick={joinRoom}>
                  Join
                </UIButton>
              </div>
            </>
          )}
          {status && <p className="score-led text-xs text-orange-300">{status.toUpperCase()}</p>}
        </UICard>
      </div>
    </main>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<main className="mx-auto mt-16 max-w-2xl px-10 py-10">Loading setup...</main>}>
      <SetupPageContent />
    </Suspense>
  );
}
