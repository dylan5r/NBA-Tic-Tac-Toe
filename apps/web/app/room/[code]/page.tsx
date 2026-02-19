"use client";

import type { MatchSnapshot, RoomSettings } from "@nba/contracts";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UIButton } from "../../../components/ui/Button";
import { UICard } from "../../../components/ui/Card";
import { useApp } from "../../providers";
import { getSocket } from "../../../lib/socket";

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
      <main className="mx-auto mt-20 max-w-xl rounded-2xl border border-white/20 bg-black/30 p-8">
        Joining room...
      </main>
    );
  }

  return (
    <main className="arena-shell mx-auto min-h-screen max-w-[1320px] px-12 py-10">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Private Matchmaking</p>
      <h1 className="font-display text-6xl uppercase leading-none">Room {snapshot.roomCode}</h1>
      <div className="mt-7 grid grid-cols-3 gap-6">
        <UICard className="col-span-2 rounded-[24px] p-7">
          <h2 className="font-display text-4xl uppercase">Players</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {snapshot.players.map((p) => (
              <article key={p.userId} className="rounded-xl border border-white/20 bg-gradient-to-b from-slate-800/70 to-slate-950/80 p-4">
                <p className="font-display text-2xl uppercase leading-none tracking-wide">{p.username}</p>
                <p className="mt-1 text-xs text-slate-300">Side {p.symbol ?? "?"}</p>
                <p className={`mt-3 inline-flex rounded px-2 py-1 text-xs ${p.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                  {p.ready ? "Ready" : "Not ready"}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <UIButton onClick={() => ready(true)}>
              Ready
            </UIButton>
            <UIButton variant="secondary" onClick={() => ready(false)}>
              Unready
            </UIButton>
            <UIButton variant="secondary" onClick={start}>
              Start
            </UIButton>
          </div>
        </UICard>

        <UICard className="rounded-[24px] p-6 space-y-3">
          <h3 className="font-display text-4xl uppercase">Lobby</h3>
          <p className="score-led text-sm text-orange-300">CODE {snapshot.roomCode}</p>
          <UIButton variant="secondary" className="w-full" onClick={copyLink}>
            Copy invite link
          </UIButton>
          <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
            Series
            <select
              value={snapshot.settings.seriesLength}
              onChange={(e) => updateSetting({ seriesLength: Number(e.target.value) as 1 | 3 | 5 })}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm"
            >
              <option value={1}>Bo1</option>
              <option value={3}>Bo3</option>
              <option value={5}>Bo5</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-[0.12em] text-slate-300">
            Board Skin
            <select
              value={snapshot.settings.boardSkin}
              onChange={(e) => updateSetting({ boardSkin: e.target.value as RoomSettings["boardSkin"] })}
              className="mt-2 w-full rounded-xl border border-white/20 bg-black/35 p-3 text-sm"
            >
              <option value="classic">Classic</option>
              <option value="arena">Arena</option>
              <option value="neon">Neon</option>
            </select>
          </label>
          <div className="rounded-xl border border-white/20 bg-black/30 p-3 text-xs text-slate-300">
            <p>State: {snapshot.state}</p>
            <p>Board: {snapshot.boardVariant}</p>
          </div>
        </UICard>
      </div>
    </main>
  );
}
