"use client";

import type { MatchHistoryItem } from "@nba/contracts";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useApp } from "../providers";

export default function ProfilePage() {
  const { user } = useApp();
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);

  useEffect(() => {
    if (!user) return;
    api.matches(user.id).then(setHistory).catch(() => setHistory([]));
  }, [user]);

  if (!user) {
    return <main className="min-h-screen flex items-center justify-center text-sm">Sign in as guest on landing page.</main>;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-[#2a2a2a] bg-[#121212]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ee8c2b] flex items-center justify-center"><span className="material-symbols-outlined text-[#221910]">grid_view</span></div>
            <span className="text-xl font-extrabold uppercase italic tracking-tight">NBA <span className="text-[#ee8c2b]">Pro</span></span>
          </div>
          <div className="text-sm font-medium">Profile</div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="relative mb-8 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#ee8c2b]/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end">
            <div className="h-32 w-32 rounded-full border-4 border-[#ee8c2b] bg-black/20" />
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-black uppercase tracking-tight md:text-5xl">{user.username}</h1>
                <span className="rounded-full border border-[#ee8c2b]/30 bg-[#ee8c2b]/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#ee8c2b]">Hall of Fame</span>
              </div>
              <p className="mb-4 text-sm text-slate-300">Global competitor profile</p>
            </div>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="surface rounded-xl p-6 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#ee8c2b]/70">Career Record</p>
              <div className="text-5xl font-black tracking-tighter text-white">{user.wins}<span className="px-2 text-[#ee8c2b]/40">-</span>{user.losses}</div>
          </div>
          <div className="surface rounded-xl p-6 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#ee8c2b]/70">Rating</p>
            <div className="text-5xl font-black tracking-tighter text-[#ee8c2b]">{user.rating}</div>
          </div>
          <div className="surface rounded-xl p-6 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#ee8c2b]/70">Streak</p>
              <div className="text-5xl font-black tracking-tighter text-white">{user.streak}</div>
          </div>
        </section>

        <section>
          <h2 className="mb-6 flex items-center gap-3 text-2xl font-black uppercase italic tracking-tight">
            <span className="h-1 w-8 rounded-full bg-[#ee8c2b]" /> Recent Match History
          </h2>
          <div className="space-y-3">
            {history.map((m) => (
              <div key={m.id} className="group flex items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#1e1e1e] p-4 hover:border-[#ee8c2b]/50">
                <div>
                  <p className="text-base font-bold uppercase tracking-tight">{m.mode.replaceAll("_", " ")}</p>
                  <p className="text-xs text-slate-400">{new Date(m.endedAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black ${m.ratingDelta >= 0 ? "text-[#ee8c2b]" : "text-slate-400"}`}>{m.ratingDelta >= 0 ? `+${m.ratingDelta}` : m.ratingDelta} PTS</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{m.ranked ? "Ranked" : "Unranked"}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

