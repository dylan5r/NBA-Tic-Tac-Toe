"use client";

import type { MatchSnapshot } from "@nba/contracts";
import { UIButton } from "./ui/Button";

export const RightPanel = ({
  snapshot,
  onRematch,
  onSurrender
}: {
  snapshot: MatchSnapshot | null;
  onRematch?: () => void;
  onSurrender?: () => void;
}) => {
  if (!snapshot) {
    return (
      <aside className="w-full lg:w-72">
        <div className="surface-strong rounded-xl p-5 text-sm text-slate-300">Loading controls...</div>
      </aside>
    );
  }

  const p2 = snapshot.players.find((p) => p.symbol === "O") ?? snapshot.players[1];
  const moveTime = snapshot.settings.timerMode === "none" ? "--:--" : `00:${String(snapshot.remainingPerMove ?? 0).padStart(2, "0")}`;

  return (
    <aside className="w-full lg:w-72 flex flex-col gap-4">
      <section className="surface-strong rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Opponent</p>
          <p className="text-xs font-bold uppercase text-slate-500">Ranked</p>
        </div>
        <h3 className="text-3xl font-black tracking-tight">{p2?.username ?? "Player O"}</h3>
        <p className="mt-1 text-sm text-slate-400">Elo {p2?.rating ?? 1200}</p>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Opponent Turn</p>
          <p className="mt-1 text-5xl font-black tracking-tight text-white">{moveTime}</p>
        </div>
      </section>

      <section className="surface-strong rounded-xl p-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Match Actions</h4>
        <div className="mt-3 space-y-2">
          <UIButton variant="secondary" className="w-full" onClick={onRematch}>Propose Rematch</UIButton>
          <UIButton variant="danger" className="w-full" onClick={onSurrender}>Surrender</UIButton>
        </div>
      </section>

      <section className="surface-strong rounded-xl p-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Match Info</h4>
        <div className="mt-3 space-y-1 text-sm text-slate-300">
          <p>Room: {snapshot.roomCode ?? "LOCAL"}</p>
          <p>State: {snapshot.state}</p>
          <p>Board: {snapshot.boardVariant}</p>
        </div>
      </section>
    </aside>
  );
};

