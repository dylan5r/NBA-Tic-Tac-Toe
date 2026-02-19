"use client";

import type { MatchSnapshot } from "@nba/contracts";
import { UIButton } from "./ui/Button";
import { UICard } from "./ui/Card";

export const RightPanel = ({
  snapshot,
  onRematch,
  onSurrender
}: {
  snapshot: MatchSnapshot | null;
  onRematch?: () => void;
  onSurrender?: () => void;
}) => {
  if (!snapshot) return <aside className="matte-panel rounded-2xl p-4">Loading controls...</aside>;
  const p2 = snapshot.players.find((p) => p.symbol === "O") ?? snapshot.players[1];
  return (
    <aside className="space-y-4">
      <UICard className="space-y-4">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-slate-400">Away Side</p>
        <article className="rounded-xl border border-sky-300/35 bg-gradient-to-b from-slate-700/45 to-slate-950/70 p-4 shadow-glowBlue">
          <p className="font-display text-3xl uppercase tracking-wide">{p2?.username ?? "Player O"}</p>
          <p className="text-xs text-slate-300">Rating {p2?.rating ?? 1200}</p>
          <p className="mt-2 inline-flex rounded bg-black/40 px-2 py-1 text-xs text-sky-200">{p2?.connected ? "Connected" : "Reconnecting"}</p>
        </article>
        <div className="grid grid-cols-1 gap-2">
          <UIButton onClick={onRematch}>Rematch</UIButton>
          <UIButton variant="danger" onClick={onSurrender}>
            Surrender
          </UIButton>
          <UIButton variant="secondary">Settings</UIButton>
        </div>
      </UICard>

      <UICard className="space-y-2">
        <p className="font-display text-lg uppercase tracking-wide">Match Timeline</p>
        <div className="rounded-xl border border-white/15 bg-black/30 p-3">
          <ul className="max-h-52 space-y-2 overflow-auto text-xs text-slate-300">
            {snapshot.moves.map((m, i) => (
              <li key={`${m.playedAt}-${i}`} className="flex items-center gap-2">
                <span className="score-led text-[10px] text-slate-400">#{String(i + 1).padStart(2, "0")}</span>
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-400" />
                <span>
                  {m.symbol} to cell {m.index + 1}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </UICard>
      <UICard className="text-xs text-slate-300">
        <p>Room: {snapshot.roomCode ?? "LOCAL"}</p>
        <p>State: {snapshot.state}</p>
        <p>Board: {snapshot.boardVariant}</p>
      </UICard>
    </aside>
  );
};
