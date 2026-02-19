"use client";

import type { MatchSnapshot } from "@nba/contracts";
import { UICard } from "./ui/Card";

export const LeftPanel = ({ snapshot }: { snapshot: MatchSnapshot | null }) => {
  if (!snapshot) {
    return <aside className="matte-panel rounded-2xl p-4">Waiting for match data...</aside>;
  }
  const p1 = snapshot.players.find((p) => p.symbol === "X") ?? snapshot.players[0];
  const underFive = snapshot.settings.timerMode !== "none" && (snapshot.remainingPerMove ?? 99) <= 5;
  return (
    <aside className="space-y-4">
      <UICard className="space-y-4">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-slate-400">Home Side</p>
        <article className="rounded-xl border border-orange-300/35 bg-gradient-to-b from-slate-700/45 to-slate-950/70 p-4 shadow-glowOrange">
          <p className="font-display text-3xl uppercase tracking-wide">{p1?.username ?? "Player X"}</p>
          <p className="text-xs text-slate-300">Rating {p1?.rating ?? 1200}</p>
          <p className="mt-2 inline-flex rounded bg-black/40 px-2 py-1 text-xs text-orange-200">{p1?.connected ? "Connected" : "Reconnecting"}</p>
        </article>
      </UICard>

      <UICard className="space-y-3">
        <p className="font-display text-xl uppercase tracking-wide">Series Score</p>
        <div className="score-led rounded-xl border border-white/20 bg-black/55 px-3 py-2 text-center text-2xl">
          {snapshot.score.X} : {snapshot.score.O}
        </div>
        <p className="text-xs text-slate-300">Round {snapshot.round}</p>
        <p className="text-sm text-slate-300">Turn: {snapshot.turn}</p>
      </UICard>

      <UICard>
        <p className="font-display text-xl uppercase tracking-wide">Shot Clock</p>
        <div className={`score-led mt-3 rounded-xl border bg-black px-3 py-3 text-center text-3xl ${underFive ? "animate-pulse-led border-rose-400/80 text-rose-300" : "border-white/20 text-slate-100"}`}>
          {snapshot.settings.timerMode === "none" ? "--" : `${snapshot.remainingPerMove ?? "--"}s`}
        </div>
      </UICard>
    </aside>
  );
};
