import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const makeRoomCode = (): string => nanoid();

export const sanitizeUsername = (input: string): string => input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16);

export const expectedScore = (rA: number, rB: number): number => 1 / (1 + 10 ** ((rB - rA) / 400));

export const eloDelta = (rating: number, opponent: number, score: 0 | 0.5 | 1, k = 24): number =>
  Math.round(k * (score - expectedScore(rating, opponent)));
