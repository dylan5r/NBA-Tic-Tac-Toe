"use client";

import type { MatchSnapshot, RoomSettings } from "@nba/contracts";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UIButton } from "../../../components/ui/Button";
import { UICard } from "../../../components/ui/Card";
import { getSocket } from "../../../lib/socket";
import { useApp } from "../../providers";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user } = useApp();
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit("session:resume", { userId: user.id });
    socket.emit("room:join", { userId: user.id, roomCode: String(code).toUpperCase() });

    socket.on("room:stateSync", (next) => {
      if (next.roomCode === String(code).toUpperCase()) setSnapshot(next);
      if (next.state === "IN_GAME" || next.state === "COUNTDOWN") {
        router.push(`/match/${next.matchId}?room=${next.roomCode}`);
      }
    });

    return () => {
      socket.off("room:stateSync");
    };
  }, [code, router, user]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
  };

  const ready = (value: boolean) => {
    if (!user) return;
    getSocket().emit("room:ready", { userId: user.id, roomCode: String(code).toUpperCase(), ready: value });
  };

  const start = () => {
    if (!user) return;
    getSocket().emit("room:start", { userId: user.id, roomCode: String(code).toUpperCase() });
  };

  const updateSetting = (next: Partial<RoomSettings>) => {
    if (!snapshot || !user) return;
    getSocket().emit("room:settings", {
      userId: user.id,
      roomCode: String(code).toUpperCase(),
      settings: { ...snapshot.settings, ...next }
    });
  };

  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#121212] p-4">
        <section className="surface w-full max-w-xl rounded-2xl p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Private Matchmaking</p>
          <p className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Joining room...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#121212] text-slate-100">
      <header className="nav-shell sticky top-0 z-30">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 md:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Private Matchmaking</p>
            <h1 className="text-xl font-black uppercase tracking-tight">Room {snapshot.roomCode}</h1>
          </div>
          <div className="app-chip">STATE {snapshot.state}</div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1280px] gap-5 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <UICard className="rounded-2xl border-white/15 p-6">
          <h2 className="text-2xl font-black uppercase tracking-tight">Players</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {snapshot.players.map((p) => (
              <article key={p.userId} className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
                <p className="text-2xl font-black uppercase tracking-tight">{p.username}</p>
                <p className="mt-1 text-xs text-slate-300">Side {p.symbol ?? "?"}</p>
                <p className={`mt-3 inline-flex rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${p.ready ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-200" : "border-[#2a2a2a] bg-[#121212] text-slate-300"}`}>
                  {p.ready ? "Ready" : "Not Ready"}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <UIButton onClick={() => ready(true)}>Ready</UIButton>
            <UIButton variant="secondary" onClick={() => ready(false)}>Unready</UIButton>
            <UIButton variant="secondary" onClick={start}>Start</UIButton>
          </div>
        </UICard>

        <UICard className="rounded-2xl border-white/15 p-6">
          <h3 className="text-2xl font-black uppercase tracking-tight">Lobby Controls</h3>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-orange-300">Code {snapshot.roomCode}</p>
          <UIButton variant="secondary" className="mt-3 w-full" onClick={copyLink}>Copy Invite Link</UIButton>

          <div className="mt-4 space-y-3">
            <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
              SERIES
              <select
                value={snapshot.settings.seriesLength}
                onChange={(e) => updateSetting({ seriesLength: Number(e.target.value) as 1 | 3 | 5 })}
                className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm"
              >
                <option value={1}>BEST OF 1</option>
                <option value={3}>BEST OF 3</option>
                <option value={5}>BEST OF 5</option>
              </select>
            </label>

            <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
              BOARD SKIN
              <select
                value={snapshot.settings.boardSkin}
                onChange={(e) => updateSetting({ boardSkin: e.target.value as RoomSettings["boardSkin"] })}
                className="focusable mt-2 w-full rounded-xl border border-[#2a2a2a] bg-[#121212] p-3 text-sm"
              >
                <option value="classic">CLASSIC</option>
                <option value="arena">ARENA</option>
                <option value="neon">NEON</option>
              </select>
            </label>
          </div>
        </UICard>
      </section>
    </main>
  );
}
