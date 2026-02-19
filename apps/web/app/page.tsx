"use client";

import Link from "next/link";
import { useState } from "react";
import { ModeCard } from "../components/ModeCard";
import { SettingsModal } from "../components/SettingsModal";
import { UIButton } from "../components/ui/Button";
import { UICard } from "../components/ui/Card";
import { UIModal } from "../components/ui/Modal";
import { useApp } from "./providers";
import { api } from "../lib/api";

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
    <main className="arena-shell mx-auto min-h-screen w-full max-w-[1400px] px-12 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Elite Arena Mode</p>
          <h1 className="font-display text-7xl uppercase leading-none tracking-wide">NBA Tic-Tac-Toe</h1>
        </div>
        <button className="focusable rounded-xl border border-slate-400/40 bg-slate-900/50 px-4 py-2 text-sm uppercase tracking-widest" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </header>

      <section className="mt-8 grid grid-cols-12 gap-7">
        <UICard className="col-span-8 overflow-hidden rounded-[28px] p-9">
          <div className="animate-slow-pan">
            <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Broadcast Arena Presentation</p>
            <h2 className="mt-3 font-display text-7xl uppercase leading-[0.9]">Own The Board. Own The Moment.</h2>
          </div>
          <p className="mt-5 max-w-2xl text-slate-300">
            Local pass-and-play, hard AI, ranked online matchmaking, and private room invites. Server-authoritative gameplay
            with reconnection and match replay support.
          </p>
          <div className="mt-7 flex gap-4">
            <Link href="/setup?mode=online_unranked">
              <UIButton size="lg">PLAY</UIButton>
            </Link>
            <UIButton size="lg" variant="secondary" onClick={() => setRulesOpen(true)}>
              Rules
            </UIButton>
          </div>
        </UICard>

        <UICard className="col-span-4 rounded-[28px] p-6">
          <h3 className="font-display text-4xl uppercase tracking-wide">Player Check-In</h3>
          {user ? (
            <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-4">
              <p className="font-semibold">Signed in as {user.username}</p>
              <p className="score-led mt-1 text-sm text-orange-300">RATING {user.rating}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter username"
                className="focusable w-full border-0 border-b border-white/30 bg-transparent px-1 py-2 text-base outline-none transition focus:border-orange-400"
              />
              <UIButton onClick={createGuest} className="w-full">
                Continue as Guest
              </UIButton>
              {error && <p className="text-sm text-red-300">{error}</p>}
            </div>
          )}
        </UICard>
      </section>

      <section className="mt-8 grid grid-cols-4 gap-4">
        <ModeCard title="Local" description="Pass-and-play on one browser with timers and series." href="/setup?mode=local" accent="neutral" />
        <ModeCard title="AI" description="Easy, medium, or hard minimax opponent with delays." href="/setup?mode=ai" accent="orange" />
        <ModeCard title="Ranked" description="Queue online and climb Elo with series wins." href="/setup?mode=online_ranked" accent="red" />
        <ModeCard title="Private Room" description="Invite friends with room code and host controls." href="/setup?mode=private_room" accent="blue" />
      </section>

      <section className="mt-10 grid grid-cols-2 gap-6">
        <UICard className="rounded-2xl p-5">
          <h4 className="font-display text-4xl uppercase">How it works</h4>
          <ol className="mt-3 space-y-2 text-sm text-slate-300">
            <li>1. Choose mode and settings.</li>
            <li>2. Match starts with server-authoritative turn/timer state.</li>
            <li>3. Win rounds, take the series, gain rating in ranked.</li>
          </ol>
        </UICard>
        <UICard className="rounded-2xl p-5">
          <h4 className="font-display text-4xl uppercase">Keyboard</h4>
          <p className="mt-3 text-sm text-slate-300">
            Use `Tab` to focus controls, `Enter` to confirm, and number keys `1-9` for fast moves on 3x3 boards.
          </p>
        </UICard>
      </section>

      <UIModal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Arena Rules">
        <p className="text-sm text-slate-300">
          Standard tic-tac-toe. First to align three (or four in 4x4 variant) wins the round. Timeout forfeits the round.
          Series winner is first to the configured round target.
        </p>
      </UIModal>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
