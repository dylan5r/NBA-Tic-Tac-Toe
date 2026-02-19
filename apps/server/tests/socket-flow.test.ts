import { io as clientIo, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppServer } from "../src/server.js";

let baseUrl = "";
let closeServer: (() => void) | null = null;
let user1 = "";
let user2 = "";

const waitFor = <T>(socket: Socket, event: string, timeoutMs = 8_000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

const waitForState = async (socket: Socket, desired: string, timeoutMs = 20_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await waitFor<any>(socket, "room:stateSync");
    if (snapshot.state === desired) return snapshot;
  }
  throw new Error(`Timed out waiting for state ${desired}`);
};

const waitForSnapshot = async (socket: Socket, predicate: (snapshot: any) => boolean, timeoutMs = 20_000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snapshot = await waitFor<any>(socket, "room:stateSync");
    if (predicate(snapshot)) return snapshot;
  }
  throw new Error("Timed out waiting for snapshot condition");
};

describe("socket flow", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      "postgresql://postgres:postgres@localhost:5432/nba_ttt?schema=public";
    const { app, httpServer } = createAppServer();
    await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
    const addr = httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("No address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
    closeServer = () => httpServer.close();
    user1 = (await request(app).post("/auth/guest").send({ username: "testerA" })).body.id;
    user2 = (await request(app).post("/auth/guest").send({ username: "testerB" })).body.id;
  });

  afterAll(() => {
    closeServer?.();
  });

  it("can create room, join, start and enforce turn rules", async () => {
    const s1 = clientIo(baseUrl, { transports: ["websocket"] });
    const s2 = clientIo(baseUrl, { transports: ["websocket"] });
    try {
      await Promise.all([waitFor(s1 as unknown as Socket, "connect"), waitFor(s2 as unknown as Socket, "connect")]);
      s1.emit("session:resume", { userId: user1 });
      s2.emit("session:resume", { userId: user2 });

      const createdState = waitFor<any>(s1, "room:stateSync");
      s1.emit("room:create", {
        userId: user1,
        settings: {
          seriesLength: 1,
          timerMode: "none",
          perMoveSeconds: 10,
          perGameSeconds: 60,
          boardVariant: "3x3",
          drawMode: "ignore",
          boardSkin: "classic"
        }
      });

      const snapshot1 = await createdState;
      const roomCode = snapshot1.roomCode;
      const joinedState = waitFor<any>(s1, "room:stateSync");
      s2.emit("room:join", { userId: user2, roomCode });
      await joinedState;
      const readyState1 = waitFor<any>(s1, "room:stateSync");
      s1.emit("room:ready", { userId: user1, roomCode, ready: true });
      await readyState1;
      const readyState2 = waitFor<any>(s1, "room:stateSync");
      s2.emit("room:ready", { userId: user2, roomCode, ready: true });
      await readyState2;
      const countdownEvent = waitFor<any>(s1, "room:countdown");
      s1.emit("room:start", { userId: user1, roomCode });

      const countdown = await countdownEvent;
      expect(countdown.endsAt).toBeTypeOf("number");
      await waitForState(s1, "IN_GAME");

      // first valid move by X
      const moveState = waitForSnapshot(s1, (snap) => snap.board?.[0] === "X");
      s1.emit("game:move", { userId: user1, roomCode, index: 0, answer: "LeBron James" });
      const afterFirstMove = await moveState;
      expect(afterFirstMove.turn).toBe("O");

      // invalid out-of-turn move by same player should error
      const invalidTurnErr = waitFor<any>(s1, "room:error");
      s1.emit("game:move", { userId: user1, roomCode, index: 1, answer: "Tim Duncan" });
      const err = await invalidTurnErr;
      expect(err.message).toContain("Not your turn");
    } finally {
      s1.disconnect();
      s2.disconnect();
    }
  }, 25_000);
});
