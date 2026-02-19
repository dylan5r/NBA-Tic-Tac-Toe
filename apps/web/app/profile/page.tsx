"use client";

import { useEffect, useState } from "react";
import { UICard } from "../../components/ui/Card";
import { useApp } from "../providers";
import { api } from "../../lib/api";
import type { MatchHistoryItem } from "@nba/contracts";

export default function ProfilePage() {
  const { user } = useApp();
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);

  useEffect(() => {
    if (!user) return;
    api.matches(user.id).then(setHistory).catch(() => setHistory([]));
  }, [user]);

  if (!user) return <main className="mx-auto mt-20 max-w-xl rounded-2xl border border-white/15 p-8">Sign in as guest on landing page.</main>;

  return (
    <main className="arena-shell mx-auto min-h-screen max-w-[1220px] px-12 py-10">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Player Profile</p>
      <h1 className="font-display text-6xl uppercase leading-none">{user.username}</h1>
      <UICard className="mt-6 rounded-[24px] p-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/20 bg-black/35 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-300">Rating</p>
            <p className="score-led mt-2 text-3xl text-orange-300">{user.rating}</p>
          </div>
          <div className="rounded-xl border border-white/20 bg-black/35 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-300">Record</p>
            <p className="score-led mt-2 text-3xl text-sky-300">
              {user.wins}/{user.losses}
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-black/35 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-300">Streak</p>
            <p className="score-led mt-2 text-3xl text-rose-300">{user.streak}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          W/L {user.wins}/{user.losses} | Streak {user.streak}
        </p>
      </UICard>
      <UICard className="mt-6 rounded-[24px] p-6">
        <h2 className="font-display text-4xl uppercase">Last 20 Matches</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {history.map((m) => (
            <li key={m.id} className="rounded-xl border border-white/15 bg-black/25 p-3">
              <p className="font-semibold uppercase tracking-wide text-slate-100">{m.mode.replaceAll("_", " ")}</p>
              <p className="text-xs text-slate-300">
                {m.ranked ? "Ranked" : "Unranked"} | {new Date(m.endedAt).toLocaleString()} | Delta {m.ratingDelta}
              </p>
            </li>
          ))}
        </ul>
      </UICard>
    </main>
  );
}
