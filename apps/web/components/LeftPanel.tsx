"use client";

import type { MatchSnapshot } from "@nba/contracts";

export const LeftPanel = ({ snapshot }: { snapshot: MatchSnapshot | null }) => {
  if (!snapshot) {
    return (
      <aside className="w-full lg:w-72">
        <div className="surface-strong rounded-xl p-5 text-sm text-slate-300">Waiting for match data...</div>
      </aside>
    );
  }

  const p1 = snapshot.players.find((p) => p.symbol === "X") ?? snapshot.players[0];
  const moveTime = snapshot.settings.timerMode === "none" ? "--:--" : `00:${String(snapshot.remainingPerMove ?? 0).padStart(2, "0")}`;

  return (
    <aside className="w-full lg:w-72 flex flex-col gap-4">
      <section className="surface-strong rounded-xl border border-[#ee8c2b]/30 p-5 shadow-[0_0_20px_rgba(238,140,43,0.15)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-[#ee8c2b]">Player</p>
          <p className="text-xs font-bold uppercase text-slate-500">Ranked</p>
        </div>
        <h3 className="text-3xl font-black tracking-tight">{p1?.username ?? "Player X"}</h3>
        <p className="mt-1 text-sm text-slate-400">Elo {p1?.rating ?? 1200}</p>

        <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Your Turn</p>
          <p className="mt-1 text-5xl font-black tracking-tight text-white">{moveTime}</p>
        </div>
      </section>

      <section className="surface-strong rounded-xl p-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Series History</h4>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
            <span>vs Current Opponent</span>
            <span className="font-bold text-[#ee8c2b]">IN PROGRESS</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
            <span>Round</span>
            <span className="font-bold text-emerald-400">{snapshot.round}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
            <span>Score</span>
            <span className="font-bold text-white">{snapshot.score.X} - {snapshot.score.O}</span>
          </div>
        </div>
      </section>

      <section className="surface-strong rounded-xl p-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Season Stats</h4>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase text-slate-500">Win Rate</p>
            <p className="text-xl font-black text-white">N/A</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase text-slate-500">Turn</p>
            <p className="text-xl font-black text-emerald-400">{snapshot.turn}</p>
          </div>
        </div>
      </section>
    </aside>
  );
};

