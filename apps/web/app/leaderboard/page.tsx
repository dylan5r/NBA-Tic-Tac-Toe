"use client";

import { useEffect, useState } from "react";
import { UIButton } from "../../components/ui/Button";
import { UICard } from "../../components/ui/Card";
import { api } from "../../lib/api";

interface Row {
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  streak: number;
  weeklyDelta?: number;
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<"global" | "weekly">("global");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api.leaderboard(scope).then(setRows).catch(() => setRows([]));
  }, [scope]);

  return (
    <main className="arena-shell mx-auto min-h-screen max-w-[1220px] px-12 py-10">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Rankings</p>
      <h1 className="font-display text-6xl uppercase leading-none">Leaderboard</h1>
      <div className="mt-4 flex gap-2">
        <UIButton variant={scope === "global" ? "primary" : "secondary"} onClick={() => setScope("global")}>
          Global
        </UIButton>
        <UIButton variant={scope === "weekly" ? "primary" : "secondary"} onClick={() => setScope("weekly")}>
          Weekly
        </UIButton>
      </div>
      <UICard className="mt-6 rounded-[24px] p-5">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-slate-300">
            <tr>
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Rating</th>
              <th className="pb-2">W/L</th>
              <th className="pb-2">Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId} className="border-t border-white/10 text-slate-100">
                <td className="py-2 score-led text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</td>
                <td className="py-2 font-semibold">{r.username}</td>
                <td className="py-2 score-led text-orange-300">{r.rating}</td>
                <td>
                  {r.wins}/{r.losses}
                </td>
                <td>{r.streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </UICard>
    </main>
  );
}
