"use client";

import { useEffect, useState } from "react";
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
    <div className="min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <header className="border-b border-[#ee8c2b]/20 bg-background-dark sticky top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="size-8 rounded-lg bg-[#ee8c2b] flex items-center justify-center text-[#221910]"><span className="material-symbols-outlined">sports_basketball</span></div>
              <h1 className="text-xl font-bold uppercase tracking-tight">NBA <span className="text-[#ee8c2b]">TTT</span></h1>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a className="text-sm font-semibold uppercase tracking-wider text-slate-400 hover:text-[#ee8c2b]" href="#">Play</a>
              <a className="text-sm font-semibold uppercase tracking-wider text-[#ee8c2b] border-b-2 border-[#ee8c2b] py-5" href="#">Leaderboard</a>
              <a className="text-sm font-semibold uppercase tracking-wider text-slate-400 hover:text-[#ee8c2b]" href="#">Stats</a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-slate-100 dark:bg-[#1f1812] px-4 py-2 text-xs font-bold uppercase tracking-wider" onClick={() => setScope("global")}>Monthly</button>
            <button className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400" onClick={() => setScope("weekly")}>Weekly</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1000px] px-6 py-12">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter">Global Rankings</h2>
            <p className="mt-2 text-sm text-slate-500">Live leaderboard updates</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#ee8c2b]/10 bg-white dark:bg-[#1f1812] shadow-xl shadow-black/20">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#ee8c2b]/10 bg-slate-50 dark:bg-white/5">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Rank</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Username</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 text-right">Rating</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 text-right">Wins</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 text-right">Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#ee8c2b]/5">
              {rows.map((r, i) => {
                const total = r.wins + r.losses;
                const pct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
                return (
                  <tr key={r.userId} className="hover:bg-[#ee8c2b]/5">
                    <td className="px-6 py-5 text-lg font-black italic text-[#ee8c2b]">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-6 py-5 font-bold text-base tracking-tight">{r.username}</td>
                    <td className="px-6 py-5 text-right text-lg font-black tabular-nums">{r.rating}</td>
                    <td className="px-6 py-5 text-right text-slate-400 tabular-nums">{r.wins}</td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-sm">{pct}%</span>
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div className="h-full bg-[#ee8c2b]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

