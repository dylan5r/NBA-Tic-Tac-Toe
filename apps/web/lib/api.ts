import type { MatchHistoryItem, PublicUser } from "@nba/contracts";
import { API_URL } from "./config";

export interface NbaChallenge {
  id: string;
  text: string;
  difficulty?: "easy" | "medium" | "hard" | "expert";
  type?: string;
  category?: string;
  weight?: number;
}

export interface NbaPlayerOption {
  key: string;
  name: string;
}

export const api = {
  guest: async (username: string): Promise<PublicUser> => {
    const res = await fetch(`${API_URL}/auth/guest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    if (!res.ok) throw new Error("Unable to create guest account");
    return res.json();
  },
  me: async (userId: string): Promise<PublicUser> => {
    const res = await fetch(`${API_URL}/me?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error("Unable to load profile");
    return res.json();
  },
  leaderboard: async (scope: "global" | "weekly") => {
    const res = await fetch(`${API_URL}/leaderboard?scope=${scope}`);
    if (!res.ok) throw new Error("Unable to load leaderboard");
    return res.json();
  },
  matches: async (userId: string): Promise<MatchHistoryItem[]> => {
    const res = await fetch(`${API_URL}/matches?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    return res.json();
  },
  nbaChallenges: async (size: 3 | 4, mode: "casual" | "ranked" = "casual"): Promise<{ rows: NbaChallenge[]; cols: NbaChallenge[] }> => {
    const res = await fetch(`${API_URL}/nba/challenges?size=${size}&mode=${mode}`);
    if (!res.ok) throw new Error("Unable to load NBA challenges");
    const json = await res.json();
    return {
      rows: (json.rows ?? []) as NbaChallenge[],
      cols: (json.cols ?? []) as NbaChallenge[]
    };
  },
  nbaValidate: async (payload: { challengeId?: string; challengeIds?: string[]; answer: string; usedKeys: string[] }) => {
    const res = await fetch(`${API_URL}/nba/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Unable to validate answer");
    return res.json() as Promise<{ ok: boolean; reason?: string; key?: string; canonical?: string }>;
  },
  nbaSampleAnswer: async (payload: { challengeId?: string; challengeIds?: string[]; usedKeys: string[] }) => {
    const res = await fetch(`${API_URL}/nba/sample-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return (await res.json()) as { key: string; name: string } | null;
  },
  nbaPlayerSearch: async (query: string, limit = 8): Promise<NbaPlayerOption[]> => {
    const res = await fetch(`${API_URL}/nba/players?query=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.players ?? []) as NbaPlayerOption[];
  }
};
