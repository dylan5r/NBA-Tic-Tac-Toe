"use client";

import Link from "next/link";
import { useState } from "react";
import { ModeCard } from "../components/ModeCard";
import { SettingsModal } from "../components/SettingsModal";
import { UIButton } from "../components/ui/Button";
import { UIModal } from "../components/ui/Modal";
import { api } from "../lib/api";
import { useApp } from "./providers";

export default function LandingPage() {
  const { user, setUser } = useApp();
  const [name, setName] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState("");

  const createGuest = async () => {
    setError("");
    try {
      const created = await api.guest(name);
      setUser(created);
    } catch {
      setError("Guest creation failed. Use 3-16 letters/numbers.");
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-slate-100">
      <nav className="sticky top-0 z-50 w-full nav-shell">
        <div className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#ee8c2b] p-1.5">
              <span className="material-symbols-outlined text-2xl font-bold text-[#221910]">grid_view</span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter">NBA <span className="text-[#ee8c2b]">TIC TAC TOE</span></h1>
          </div>
          <div className="hidden items-center gap-10 md:flex">
            <Link className="border-b-2 border-[#ee8c2b] pb-1 text-sm font-semibold" href="/">Play</Link>
            <Link className="pb-1 text-sm font-semibold text-slate-300 hover:text-[#ee8c2b]" href="/leaderboard">Leaderboard</Link>
            <Link className="pb-1 text-sm font-semibold text-slate-300 hover:text-[#ee8c2b]" href="/profile">Profile</Link>
            <button className="pb-1 text-sm font-semibold text-slate-300 hover:text-[#ee8c2b]" onClick={() => setSettingsOpen(true)}>Settings</button>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-slate-400 md:flex">
              <span className="material-symbols-outlined text-base">search</span>
              Search player...
            </div>
            <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-[#ee8c2b] bg-[#ee8c2b]/20" />
          </div>
        </div>
      </nav>

      <main>
        <section className="hero-gradient relative flex min-h-[70vh] items-center justify-center px-6 py-20 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ee8c2b]/30 bg-[#ee8c2b]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#ee8c2b]">
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              Season 4 Now Live
            </div>
            <h2 className="mb-6 text-6xl font-black uppercase italic tracking-tighter text-white md:text-8xl">
              NBA <span className="text-[#ee8c2b]">TIC TAC TOE</span>
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
              Test your basketball knowledge. Dominate the court in the world&apos;s most competitive NBA grid challenge.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/setup?mode=online_unranked"><UIButton size="lg">Play Now</UIButton></Link>
              <Link href="/leaderboard"><UIButton size="lg" variant="secondary">View Rankings</UIButton></Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-6 py-16">
          <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h3 className="mb-2 text-3xl font-black uppercase tracking-tight">Select Game Mode</h3>
              <p className="text-slate-500 dark:text-slate-400">Choose how you want to dominate the grid today.</p>
            </div>
            <button className="flex items-center gap-2 font-bold text-[#ee8c2b] hover:underline">
              View All Modes <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ModeCard title="Local Play" description="Challenge a friend sitting right next to you." href="/setup?mode=local" accent="neutral" />
            <ModeCard title="AI Challenge" description="Sharpen your skills against NBA AI." href="/setup?mode=ai" accent="orange" />
            <ModeCard title="Ranked Match" description="Climb global leaderboards with Elo." href="/setup?mode=online_ranked" accent="red" />
            <ModeCard title="Private Room" description="Create a lobby and invite with code." href="/setup?mode=private_room" accent="blue" />
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#ee8c2b]">Quick Login</p>
            {user ? (
              <p className="text-sm text-slate-200">Signed in as <span className="font-bold text-white">{user.username}</span> • Elo {user.rating}</p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter username"
                  className="focusable w-full rounded-lg border border-[#2a2a2a] bg-[#121212] px-3 py-3 text-sm text-white"
                />
                <UIButton onClick={createGuest}>Continue</UIButton>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-white/5 py-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-6 text-xs uppercase tracking-[0.2em] text-slate-500 md:flex-row">
          <p>© 2024 NBA Tic Tac Toe Challenge</p>
          <div className="flex items-center gap-6">
            <a className="hover:text-[#ee8c2b]" href="#">Terms</a>
            <a className="hover:text-[#ee8c2b]" href="#">Privacy</a>
            <a className="hover:text-[#ee8c2b]" href="#">Contact</a>
          </div>
        </div>
      </footer>

      <UIModal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Arena Rules">
        <p className="text-sm text-slate-300">Win by completing lines while answering NBA prompt intersections correctly.</p>
      </UIModal>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

