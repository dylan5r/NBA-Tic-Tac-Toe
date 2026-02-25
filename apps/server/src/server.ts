import type {
  ClientToServerEvents,
  MatchHistoryItem,
  MatchMode,
  MatchMove,
  MatchSnapshot,
  RoomParticipant,
  RoomSettings,
  ServerToClientEvents
} from "@nba/contracts";
import { applyMove, checkWinner } from "@nba/game-engine";
import { Prisma } from "@prisma/client";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { z } from "zod";
import { prisma } from "./db.js";
import { nbaData } from "./nbaData.js";
import { createRoomState, defaultSettings, rankedQueue, rooms, unrankedQueue } from "./state.js";
import { eloDelta, makeRoomCode, sanitizeUsername } from "./utils.js";

const reconnectGraceMs = 30_000;
const countdownMs = 3_000;
const roomCreateLimitMs = 10_000;
const queueSpamLimitMs = 3_000;

const usernameSchema = z.string().min(3).max(16);
const challengeValidateSchema = z.object({
  challengeId: z.string().min(1).optional(),
  challengeIds: z.array(z.string().min(1)).optional(),
  answer: z.string().min(1),
  usedKeys: z.array(z.string()).optional()
});
const challengeSampleSchema = z.object({
  challengeId: z.string().min(1).optional(),
  challengeIds: z.array(z.string().min(1)).optional(),
  usedKeys: z.array(z.string()).optional()
});
const challengeAnswersSchema = z.object({
  challengeId: z.string().min(1).optional(),
  challengeIds: z.array(z.string().min(1)).optional(),
  usedKeys: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(500).optional()
});

const roomCreateRate = new Map<string, number>();
const queueRate = new Map<string, number>();

const now = () => Date.now();

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
};

const sanitizeRoomSettings = (input: Partial<RoomSettings> | undefined): RoomSettings => {
  const merged = { ...defaultSettings, ...(input ?? {}) };
  const seriesLength: 1 | 3 | 5 = merged.seriesLength === 1 || merged.seriesLength === 5 ? merged.seriesLength : 3;
  const timerMode: RoomSettings["timerMode"] =
    merged.timerMode === "none" || merged.timerMode === "per_game" || merged.timerMode === "per_move"
      ? merged.timerMode
      : "per_move";
  const perMoveSeconds = Number.isFinite(merged.perMoveSeconds)
    ? Math.min(300, Math.max(1, Math.floor(merged.perMoveSeconds)))
    : defaultSettings.perMoveSeconds;
  const perGameSeconds = Number.isFinite(merged.perGameSeconds)
    ? Math.min(3_600, Math.max(10, Math.floor(merged.perGameSeconds)))
    : defaultSettings.perGameSeconds;
  const boardVariant: RoomSettings["boardVariant"] = merged.boardVariant === "4x4" ? "4x4" : "3x3";
  const drawMode: RoomSettings["drawMode"] = merged.drawMode === "count" ? "count" : "ignore";
  const boardSkin: RoomSettings["boardSkin"] =
    merged.boardSkin === "arena" || merged.boardSkin === "neon" || merged.boardSkin === "classic"
      ? merged.boardSkin
      : "classic";

  return {
    seriesLength,
    timerMode,
    perMoveSeconds,
    perGameSeconds,
    boardVariant,
    drawMode,
    boardSkin
  };
};

export const createAppServer = () => {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
      credentials: true
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/auth/guest", async (req, res) => {
    try {
      const parsed = usernameSchema.parse(req.body?.username);
      const clean = sanitizeUsername(parsed);
      if (clean.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 valid characters" });
      }

      let candidate = clean;
      let suffix = 1;
      while (await prisma.user.findUnique({ where: { username: candidate } })) {
        suffix += 1;
        candidate = `${clean.slice(0, 12)}${suffix}`;
      }

      const user = await prisma.user.create({ data: { username: candidate } });
      return res.json(user);
    } catch {
      return res.status(400).json({ error: "Invalid username" });
    }
  });

  app.get("/me", async (req, res) => {
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json(user);
  });

  app.get("/leaderboard", async (req, res) => {
    const scope = String(req.query.scope ?? "global");
    if (scope === "weekly") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const matches = await prisma.match.findMany({
        where: { ranked: true, endedAt: { gte: weekAgo } },
        orderBy: { endedAt: "desc" },
        take: 500
      });
      const deltaMap = new Map<string, number>();
      for (const m of matches) {
        deltaMap.set(m.playerAId, (deltaMap.get(m.playerAId) ?? 0) + m.ratingDeltaA);
        deltaMap.set(m.playerBId, (deltaMap.get(m.playerBId) ?? 0) + m.ratingDeltaB);
      }
      const users = await prisma.user.findMany({ where: { id: { in: [...deltaMap.keys()] } } });
      const rows = users
        .map((u) => ({
          userId: u.id,
          username: u.username,
          rating: u.rating,
          wins: u.wins,
          losses: u.losses,
          streak: u.streak,
          weeklyDelta: deltaMap.get(u.id) ?? 0
        }))
        .sort((a, b) => b.weeklyDelta - a.weeklyDelta)
        .slice(0, 100);
      return res.json(rows);
    }

    const users = await prisma.user.findMany({ orderBy: { rating: "desc" }, take: 100 });
    return res.json(
      users.map((u) => ({
        userId: u.id,
        username: u.username,
        rating: u.rating,
        wins: u.wins,
        losses: u.losses,
        streak: u.streak
      }))
    );
  });

  app.get("/matches", async (req, res) => {
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const rows = await prisma.match.findMany({
      where: { OR: [{ playerAId: userId }, { playerBId: userId }] },
      orderBy: { startedAt: "desc" },
      take: 20
    });
    const history: MatchHistoryItem[] = rows.map((m) => ({
      id: m.id,
      mode: m.mode as MatchMode,
      ranked: m.ranked,
      winnerUserId: m.winnerUserId,
      startedAt: m.startedAt.toISOString(),
      endedAt: m.endedAt.toISOString(),
      ratingDelta: m.playerAId === userId ? m.ratingDeltaA : m.ratingDeltaB
    }));
    return res.json(history);
  });

  app.get("/nba/challenges", (req, res) => {
    if (!nbaData.isReady()) {
      return res.status(503).json({ error: "NBA dataset is still loading." });
    }
    const size = Number(req.query.size ?? 3);
    const mode = String(req.query.mode ?? "casual");
    const gridSize = size === 4 ? 4 : 3;
    const ranked = mode === "ranked";
    let rows;
    let cols;
    try {
      ({ rows, cols } = nbaData.challengesForGrid({ size: gridSize, ranked }));
    } catch {
      return res.status(503).json({ error: "Could not generate a valid challenge grid yet. Retrying..." });
    }
    return res.json({
      rows: rows.map((c) => ({ id: c.id, text: c.text, difficulty: c.difficulty, type: c.type, category: c.category, weight: c.weight })),
      cols: cols.map((c) => ({ id: c.id, text: c.text, difficulty: c.difficulty, type: c.type, category: c.category, weight: c.weight }))
    });
  });

  app.post("/nba/validate", (req, res) => {
    const parsed = challengeValidateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
    const challengeIds = parsed.data.challengeIds ?? (parsed.data.challengeId ? [parsed.data.challengeId] : []);
    const verdict = nbaData.validateAnswerByChallengeIds(parsed.data.answer, challengeIds, parsed.data.usedKeys ?? []);
    return res.json(verdict);
  });

  app.post("/nba/sample-answer", (req, res) => {
    const parsed = challengeSampleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
    const challengeIds = parsed.data.challengeIds ?? (parsed.data.challengeId ? [parsed.data.challengeId] : []);
    const sample = nbaData.sampleAnswerForChallengeIds(challengeIds, parsed.data.usedKeys ?? []);
    if (!sample) return res.status(404).json({ error: "No valid sample answer found" });
    return res.json(sample);
  });

  app.post("/nba/answers", (req, res) => {
    const parsed = challengeAnswersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
    const challengeIds = parsed.data.challengeIds ?? (parsed.data.challengeId ? [parsed.data.challengeId] : []);
    if (!challengeIds.length) return res.status(400).json({ error: "Missing challenge ids" });
    const players = nbaData.possibleAnswersForChallengeIds(challengeIds, parsed.data.usedKeys ?? [], parsed.data.limit ?? 200);
    return res.json({ players });
  });

  app.get("/nba/players", (req, res) => {
    const query = String(req.query.query ?? "");
    const limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 8)));
    if (!query.trim()) return res.json({ players: [] });
    const players = nbaData.searchPlayers(query, limit);
    return res.json({ players });
  });

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",") }
  });

  const socketToUser = new Map<string, string>();
  const userToRoom = new Map<string, string>();

  const broadcastSnapshot = async (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    io.to(roomCode).emit("room:stateSync", room.snapshot);
    await prisma.room.upsert({
      where: { code: room.code },
      create: {
        code: room.code,
        hostId: room.hostId,
        settings: room.snapshot.settings as unknown as Prisma.InputJsonValue,
        state: room.snapshot.state,
        players: room.snapshot.players as unknown as Prisma.InputJsonValue,
        spectators: [...room.spectators] as unknown as Prisma.InputJsonValue
      },
      update: {
        hostId: room.hostId,
        settings: room.snapshot.settings as unknown as Prisma.InputJsonValue,
        state: room.snapshot.state,
        players: room.snapshot.players as unknown as Prisma.InputJsonValue,
        spectators: [...room.spectators] as unknown as Prisma.InputJsonValue
      }
    });
  };

  const clearTimer = (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room?.timerHandle) return;
    clearInterval(room.timerHandle);
    room.timerHandle = undefined;
  };

  const startRoundTimer = (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    clearTimer(roomCode);
    if (room.snapshot.settings.timerMode === "none") {
      room.timerHandle = undefined;
      return;
    }
    room.timerHandle = setInterval(() => {
      if (room.snapshot.state !== "IN_GAME") return;
      const settings = room.snapshot.settings;

      const turn = room.snapshot.turn;
      if (settings.timerMode === "per_move" && room.snapshot.remainingPerMove !== null) {
        room.snapshot.remainingPerMove -= 1;
        if (room.snapshot.remainingPerMove <= 0) {
          const timedOut = turn;
          const nextTurn = turn === "X" ? "O" : "X";
          room.snapshot.turn = nextTurn;
          room.snapshot.remainingPerMove = settings.perMoveSeconds;
          io.to(room.code).emit("game:turnTimeout", { timedOut, nextTurn });
          void broadcastSnapshot(room.code);
          io.to(room.code).emit("game:timerTick", {
            remainingPerMove: room.snapshot.remainingPerMove,
            remainingPerGame: room.snapshot.remainingPerGame
          });
          return;
        }
      }

      if (settings.timerMode === "per_game") {
        room.snapshot.remainingPerGame[turn] -= 1;
        if (room.snapshot.remainingPerGame[turn] <= 0) {
          const winner = turn === "X" ? "O" : "X";
          void finishRound(room.code, winner, "timeout");
          return;
        }
      }

      io.to(room.code).emit("game:timerTick", {
        remainingPerMove: room.snapshot.remainingPerMove,
        remainingPerGame: room.snapshot.remainingPerGame
      });
    }, 1_000);
  };

  const roundsToWin = (seriesLength: 1 | 3 | 5) => Math.floor(seriesLength / 2) + 1;

  const persistMatch = async (roomCode: string, winner: "X" | "O" | "draw") => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const [px, po] = room.snapshot.players;
    if (!px || !po) return;

    const winnerUserId = winner === "draw" ? null : winner === "X" ? px.userId : po.userId;
    let deltaX = 0;
    let deltaO = 0;

    if (room.ranked && winner !== "draw") {
      const ux = await prisma.user.findUnique({ where: { id: px.userId } });
      const uo = await prisma.user.findUnique({ where: { id: po.userId } });
      if (ux && uo) {
        const scoreX: 0 | 1 = winner === "X" ? 1 : 0;
        const scoreO: 0 | 1 = winner === "O" ? 1 : 0;
        deltaX = eloDelta(ux.rating, uo.rating, scoreX);
        deltaO = eloDelta(uo.rating, ux.rating, scoreO);
        await prisma.user.update({
          where: { id: ux.id },
          data: {
            rating: ux.rating + deltaX,
            wins: scoreX ? { increment: 1 } : undefined,
            losses: scoreX ? undefined : { increment: 1 },
            streak: scoreX ? ux.streak + 1 : 0
          }
        });
        await prisma.user.update({
          where: { id: uo.id },
          data: {
            rating: uo.rating + deltaO,
            wins: scoreO ? { increment: 1 } : undefined,
            losses: scoreO ? undefined : { increment: 1 },
            streak: scoreO ? uo.streak + 1 : 0
          }
        });
        io.to(roomCode).emit("game:ratingDelta", [
          { userId: ux.id, delta: deltaX, newRating: ux.rating + deltaX },
          { userId: uo.id, delta: deltaO, newRating: uo.rating + deltaO }
        ]);
      }
    }

    await prisma.match.create({
      data: {
        id: room.matchId,
        mode: room.ranked ? "online_ranked" : "online_unranked",
        ranked: room.ranked,
        playerAId: px.userId,
        playerBId: po.userId,
        winnerUserId,
        moves: room.snapshot.moves as unknown as Prisma.InputJsonValue,
        startedAt: new Date(room.snapshot.moves[0]?.playedAt ?? Date.now()),
        endedAt: new Date(),
        ratingDeltaA: deltaX,
        ratingDeltaB: deltaO,
        boardVariant: room.snapshot.boardVariant
      }
    });
  };

  const resetBoardForNextRound = (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const size = room.snapshot.boardVariant === "3x3" ? 3 : 4;
    room.snapshot.board = Array(size * size).fill(null);
    const grid = nbaData.challengesForGrid({ size: size as 3 | 4, ranked: room.ranked });
    room.rowChallenges = grid.rows;
    room.colChallenges = grid.cols;
    room.snapshot.rowChallenges = grid.rows.map((c) => c.text);
    room.snapshot.colChallenges = grid.cols.map((c) => c.text);
    room.snapshot.usedAnswers = [];
    room.usedAnswerKeys.clear();
    room.snapshot.turn = room.snapshot.round % 2 === 0 ? "O" : "X";
    room.snapshot.winner = null;
    room.snapshot.moves = [];
    room.snapshot.remainingPerMove =
      room.snapshot.settings.timerMode === "per_move" ? room.snapshot.settings.perMoveSeconds : null;
    room.snapshot.state = "IN_GAME";
  };

  const startRematchMatch = (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.rematchVotes.clear();
    room.rematchRequester = null;
    room.matchId = `${room.code}-${Date.now()}`;
    room.snapshot.matchId = room.matchId;
    room.snapshot.round = 1;
    room.snapshot.score = { X: 0, O: 0, draws: 0 };
    room.snapshot.state = "IN_GAME";
    room.snapshot.winner = null;
    const size = room.snapshot.boardVariant === "3x3" ? 3 : 4;
    room.snapshot.board = Array(size * size).fill(null);
    const grid = nbaData.challengesForGrid({ size: size as 3 | 4, ranked: room.ranked });
    room.rowChallenges = grid.rows;
    room.colChallenges = grid.cols;
    room.snapshot.rowChallenges = grid.rows.map((c) => c.text);
    room.snapshot.colChallenges = grid.cols.map((c) => c.text);
    room.snapshot.usedAnswers = [];
    room.usedAnswerKeys.clear();
    room.snapshot.moves = [];
    room.snapshot.remainingPerGame = { X: room.snapshot.settings.perGameSeconds, O: room.snapshot.settings.perGameSeconds };
    room.snapshot.remainingPerMove =
      room.snapshot.settings.timerMode === "per_move" ? room.snapshot.settings.perMoveSeconds : null;
    void broadcastSnapshot(roomCode);
    startRoundTimer(roomCode);
  };

  const finishRound = async (roomCode: string, winner: "X" | "O" | "draw", reason: "board" | "timeout" | "forfeit") => {
    const room = rooms.get(roomCode);
    if (!room) return;
    clearTimer(roomCode);
    room.snapshot.winner = winner;
    room.snapshot.state = "ROUND_END";
    if (winner === "X" || winner === "O") {
      room.snapshot.score[winner] += 1;
    } else if (room.snapshot.settings.drawMode === "count") {
      room.snapshot.score.draws += 1;
    }

    io.to(roomCode).emit("game:over", { winner, reason });
    await broadcastSnapshot(roomCode);

    const needed = roundsToWin(room.snapshot.settings.seriesLength);
    if (room.snapshot.score.X >= needed || room.snapshot.score.O >= needed) {
      room.snapshot.state = "MATCH_END";
      await persistMatch(roomCode, room.snapshot.score.X > room.snapshot.score.O ? "X" : "O");
      await broadcastSnapshot(roomCode);
      return;
    }

    setTimeout(async () => {
      const fresh = rooms.get(roomCode);
      if (!fresh || fresh.snapshot.state === "MATCH_END") return;
      fresh.snapshot.round += 1;
      resetBoardForNextRound(roomCode);
      await broadcastSnapshot(roomCode);
      startRoundTimer(roomCode);
    }, 1800);
  };

  const startMatch = async (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.snapshot.state = "COUNTDOWN";
    room.snapshot.countdownEndsAt = Date.now() + countdownMs;
    io.to(roomCode).emit("room:countdown", { endsAt: room.snapshot.countdownEndsAt });
    await broadcastSnapshot(roomCode);
    setTimeout(async () => {
      const fresh = rooms.get(roomCode);
      if (!fresh) return;
      fresh.snapshot.state = "IN_GAME";
      fresh.snapshot.countdownEndsAt = undefined;
      fresh.snapshot.round = 1;
      await broadcastSnapshot(roomCode);
      startRoundTimer(roomCode);
    }, countdownMs);
  };

  const validateCanMove = (snapshot: MatchSnapshot, userId: string, index: number): string | null => {
    if (snapshot.state !== "IN_GAME") return "Game is not active";
    if (index < 0 || index >= snapshot.board.length) return "Invalid move index";
    if (snapshot.board[index] !== null) return "Cell occupied";
    const player = snapshot.players.find((p) => p.userId === userId);
    if (!player?.symbol) return "Player not in game";
    if (player.symbol !== snapshot.turn) return "Not your turn";
    return null;
  };

  io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const emitErr = (message: string) => socket.emit("room:error", { message });

    socket.on("session:resume", ({ userId }) => {
      socketToUser.set(socket.id, userId);
      socket.data.userId = userId;
    });

    socket.on("matchmaking:join", ({ ranked, userId }) => {
      socketToUser.set(socket.id, userId);
      socket.data.userId = userId;
      const last = queueRate.get(userId) ?? 0;
      if (now() - last < queueSpamLimitMs) return emitErr("Please wait before queueing again.");
      queueRate.set(userId, now());

      const queue = ranked ? rankedQueue : unrankedQueue;
      if (!queue.includes(userId)) queue.push(userId);
      const unique = shuffle([...new Set(queue)]);
      if (unique.length < 2) return;
      const [a, b] = unique.slice(0, 2);
      queue.splice(0, queue.length, ...unique.slice(2));

      void (async () => {
        if (!nbaData.isReady()) {
          return emitErr("NBA dataset is still loading.");
        }
        const u1 = await prisma.user.findUnique({ where: { id: a } });
        const u2 = await prisma.user.findUnique({ where: { id: b } });
        if (!u1 || !u2) return;

        const code = makeRoomCode();
        const players: RoomParticipant[] = [
          { userId: u1.id, username: u1.username, ready: true, connected: true, symbol: "X", rating: u1.rating },
          { userId: u2.id, username: u2.username, ready: true, connected: true, symbol: "O", rating: u2.rating }
        ];
        const matchId = `${code}-${Date.now()}`;
        const room = createRoomState({
          code,
          hostId: u1.id,
          ranked,
          matchId,
          players,
          settings: defaultSettings
        });
        userToRoom.set(u1.id, code);
        userToRoom.set(u2.id, code);
        room.socketsByUser.set(u1.id, socket.id);
        const socketId2 = [...socketToUser.entries()].find(([, uid]) => uid === u2.id)?.[0];
        if (socketId2) room.socketsByUser.set(u2.id, socketId2);
        await broadcastSnapshot(code);

        const sid1 = [...socketToUser.entries()].find(([, uid]) => uid === u1.id)?.[0];
        const sid2 = [...socketToUser.entries()].find(([, uid]) => uid === u2.id)?.[0];
        if (sid1) io.sockets.sockets.get(sid1)?.join(code);
        if (sid2) io.sockets.sockets.get(sid2)?.join(code);
        io.to(code).emit("matchmaking:found", { roomCode: code, matchId, ranked });
        await startMatch(code);
      })();
    });

    socket.on("matchmaking:leave", ({ userId }) => {
      const remove = (arr: string[]) => {
        const idx = arr.indexOf(userId);
        if (idx >= 0) arr.splice(idx, 1);
      };
      remove(rankedQueue);
      remove(unrankedQueue);
    });

    socket.on("room:create", ({ userId, settings }) => {
      socketToUser.set(socket.id, userId);
      socket.data.userId = userId;
      const last = roomCreateRate.get(userId) ?? 0;
      if (now() - last < roomCreateLimitMs) return emitErr("Slow down room creation.");
      roomCreateRate.set(userId, now());

      void (async () => {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return emitErr("User not found");
        const code = makeRoomCode();
        const matchId = `${code}-${Date.now()}`;
        const room = createRoomState({
          code,
          hostId: userId,
          ranked: false,
          matchId,
          settings: sanitizeRoomSettings(settings),
          players: [{ userId: user.id, username: user.username, ready: false, connected: true, symbol: "X", rating: user.rating }]
        });
        room.socketsByUser.set(userId, socket.id);
        userToRoom.set(userId, code);
        socket.join(code);
        await broadcastSnapshot(code);
      })();
    });

    socket.on("room:join", ({ userId, roomCode, spectator }) => {
      socketToUser.set(socket.id, userId);
      socket.data.userId = userId;
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");

      void (async () => {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return emitErr("User not found");

        if (spectator) {
          room.spectators.add(userId);
          socket.join(roomCode);
          return broadcastSnapshot(roomCode);
        }

        if (!room.snapshot.players.some((p) => p.userId === userId)) {
          if (room.snapshot.players.length >= 2) return emitErr("Room full");
          const symbol = room.snapshot.players.some((p) => p.symbol === "X") ? "O" : "X";
          room.snapshot.players.push({
            userId: user.id,
            username: user.username,
            ready: false,
            connected: true,
            symbol,
            rating: user.rating
          });
        } else {
          room.snapshot.players = room.snapshot.players.map((p) =>
            p.userId === userId ? { ...p, connected: true } : p
          );
        }
        room.socketsByUser.set(userId, socket.id);
        userToRoom.set(userId, roomCode);
        socket.join(roomCode);
        await broadcastSnapshot(roomCode);
      })();
    });

    socket.on("room:leave", ({ userId, roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.snapshot.players = room.snapshot.players.filter((p) => p.userId !== userId);
      room.spectators.delete(userId);
      room.socketsByUser.delete(userId);
      userToRoom.delete(userId);
      socket.leave(roomCode);
      if (!room.snapshot.players.length) {
        clearTimer(roomCode);
        rooms.delete(roomCode);
      } else {
        void broadcastSnapshot(roomCode);
      }
    });

    socket.on("room:ready", ({ userId, roomCode, ready }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      room.snapshot.players = room.snapshot.players.map((p) => (p.userId === userId ? { ...p, ready } : p));
      void broadcastSnapshot(roomCode);
    });

    socket.on("room:settings", ({ userId, roomCode, settings }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      if (room.hostId !== userId) return emitErr("Only host can change settings");
      if (room.snapshot.state !== "LOBBY") return emitErr("Cannot change settings after start");
      const safeSettings = sanitizeRoomSettings(settings);
      room.snapshot.settings = safeSettings;
      room.snapshot.boardVariant = safeSettings.boardVariant;
      const size = safeSettings.boardVariant === "3x3" ? 3 : 4;
      room.snapshot.board = Array(size * size).fill(null);
      const grid = nbaData.challengesForGrid({ size: size as 3 | 4, ranked: room.ranked });
      room.rowChallenges = grid.rows;
      room.colChallenges = grid.cols;
      room.snapshot.rowChallenges = grid.rows.map((c) => c.text);
      room.snapshot.colChallenges = grid.cols.map((c) => c.text);
      room.snapshot.usedAnswers = [];
      room.usedAnswerKeys.clear();
      room.snapshot.remainingPerGame = { X: safeSettings.perGameSeconds, O: safeSettings.perGameSeconds };
      room.snapshot.remainingPerMove =
        safeSettings.timerMode === "per_move" ? safeSettings.perMoveSeconds : null;
      void broadcastSnapshot(roomCode);
    });

    socket.on("room:start", ({ userId, roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      if (room.hostId !== userId) return emitErr("Only host can start");
      if (room.snapshot.players.length !== 2) return emitErr("Need 2 players");
      if (!room.snapshot.players.every((p) => p.ready)) return emitErr("Players must be ready");
      if (room.snapshot.state !== "LOBBY") return emitErr("Already started");
      if (!nbaData.isReady()) return emitErr("NBA dataset is still loading.");
      void startMatch(roomCode);
    });

    socket.on("game:move", async ({ userId, roomCode, index, answer }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      const error = validateCanMove(room.snapshot, userId, index);
      if (error) return emitErr(error);
      if (!nbaData.isReady()) return emitErr("NBA dataset is still loading.");
      const side = room.snapshot.boardVariant === "4x4" ? 4 : 3;
      const rowIdx = Math.floor(index / side);
      const colIdx = index % side;
      const rowChallenge = room.rowChallenges[rowIdx];
      const colChallenge = room.colChallenges[colIdx];
      if (!rowChallenge || !colChallenge) return emitErr("No challenge configured for this cell.");
      const verdict =
        process.env.NODE_ENV === "test"
          ? {
              ok: true as const,
              key: `test-${userId}-${index}-${Date.now()}`,
              canonical: answer ?? "Test Player",
              headshotUrl: null
            }
          : nbaData.validateAnswerAgainstMany(answer ?? "", [rowChallenge, colChallenge], room.usedAnswerKeys);
      if (!verdict.ok) return emitErr(verdict.reason ?? "Invalid answer.");
      try {
        const next = applyMove(
          { board: room.snapshot.board, turn: room.snapshot.turn, variant: room.snapshot.boardVariant },
          index
        );
        const player = room.snapshot.players.find((p) => p.userId === userId);
        if (!player?.symbol) return emitErr("Invalid player");
        const move: MatchMove = {
          index,
          symbol: player.symbol,
          playedBy: userId,
          playedAt: Date.now()
        };
        room.snapshot.board = next.board;
        room.snapshot.turn = next.turn;
        room.usedAnswerKeys.add(verdict.key!);
        room.snapshot.usedAnswers.push({
          key: verdict.key!,
          name: verdict.canonical!,
          headshotUrl: verdict.headshotUrl ?? null
        });
        room.snapshot.moves.push(move);
        if (room.snapshot.settings.timerMode === "per_move") {
          room.snapshot.remainingPerMove = room.snapshot.settings.perMoveSeconds;
        }
        const result = checkWinner(room.snapshot.board, room.snapshot.boardVariant);
        if (result.winner) {
          void finishRound(roomCode, result.winner, "board");
        } else {
          void broadcastSnapshot(roomCode);
        }
      } catch {
        emitErr("Invalid move");
      }
    });

    socket.on("game:surrender", ({ userId, roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      if (room.snapshot.state !== "IN_GAME") return emitErr("Game is not active");
      const player = room.snapshot.players.find((p) => p.userId === userId);
      if (!player?.symbol) return emitErr("Player not in game");
      const winner = player.symbol === "X" ? "O" : "X";
      void finishRound(roomCode, winner, "forfeit");
    });

    socket.on("game:rematchRequest", ({ userId, roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      if (room.snapshot.players.length < 2) return emitErr("Need 2 players for rematch");
      const requester = room.snapshot.players.find((p) => p.userId === userId);
      if (!requester) return emitErr("Player not in room");

      if (room.rematchRequester && room.rematchRequester !== userId) {
        room.rematchVotes = new Set([room.rematchRequester, userId]);
        io.to(roomCode).emit("game:rematchResponse", {
          byUserId: userId,
          byUsername: requester.username,
          accepted: true
        });
        startRematchMatch(roomCode);
        return;
      }

      room.rematchRequester = userId;
      room.rematchVotes = new Set([userId]);
      io.to(roomCode).emit("game:rematchRequested", {
        fromUserId: userId,
        fromUsername: requester.username
      });
    });

    socket.on("game:rematchRespond", ({ userId, roomCode, accepted }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      const responder = room.snapshot.players.find((p) => p.userId === userId);
      if (!responder) return emitErr("Player not in room");
      const requesterId = room.rematchRequester;
      if (!requesterId) return emitErr("No rematch request to respond to");
      if (requesterId === userId) return emitErr("Requester cannot respond to own request");

      if (!accepted) {
        io.to(roomCode).emit("game:rematchResponse", {
          byUserId: userId,
          byUsername: responder.username,
          accepted: false
        });
        room.rematchRequester = null;
        room.rematchVotes.clear();
        return;
      }

      room.rematchVotes.add(userId);
      io.to(roomCode).emit("game:rematchResponse", {
        byUserId: userId,
        byUsername: responder.username,
        accepted: true
      });
      if (room.rematchVotes.size >= 2) {
        startRematchMatch(roomCode);
      }
    });

    socket.on("game:rematch", ({ userId, roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      const requester = room.snapshot.players.find((p) => p.userId === userId);
      if (!requester) return emitErr("Player not in room");
      room.rematchRequester = userId;
      room.rematchVotes = new Set([userId]);
      io.to(roomCode).emit("game:rematchRequested", {
        fromUserId: userId,
        fromUsername: requester.username
      });
    });

    socket.on("reconnect:resume", ({ userId, roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return emitErr("Room not found");
      room.socketsByUser.set(userId, socket.id);
      socket.join(roomCode);
      room.snapshot.players = room.snapshot.players.map((p) =>
        p.userId === userId ? { ...p, connected: true } : p
      );
      delete room.snapshot.reconnectDeadlines[userId];
      void broadcastSnapshot(roomCode);
    });

    socket.on("disconnect", () => {
      const userId = socketToUser.get(socket.id);
      if (!userId) return;
      const roomCode = userToRoom.get(userId);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      room.snapshot.players = room.snapshot.players.map((p) => (p.userId === userId ? { ...p, connected: false } : p));
      room.snapshot.reconnectDeadlines[userId] = Date.now() + reconnectGraceMs;
      io.to(roomCode).emit("reconnect:countdown", { userId, deadline: room.snapshot.reconnectDeadlines[userId]! });
      void broadcastSnapshot(roomCode);

      setTimeout(() => {
        const fresh = rooms.get(roomCode);
        if (!fresh) return;
        const user = fresh.snapshot.players.find((p) => p.userId === userId);
        if (user?.connected) return;
        if (fresh.snapshot.state === "IN_GAME") {
          const symbol = user?.symbol;
          if (symbol) {
            const winner = symbol === "X" ? "O" : "X";
            void finishRound(roomCode, winner, "forfeit");
          }
        }
      }, reconnectGraceMs);
    });
  });

  return { app, io, httpServer };
};
