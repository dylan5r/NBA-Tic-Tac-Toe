import { io as clientIo, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppServer } from "../src/server.js";

let baseUrl = "";
let closeServer: (() => void) | null = null;
let user1 = "";
let user2 = "";

const waitFor = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => socket.once(event, (data: T) => resolve(data)));

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

  it("can create room, join, start and play to win", async () => {
    const s1 = clientIo(baseUrl, { transports: ["websocket"] });
    const s2 = clientIo(baseUrl, { transports: ["websocket"] });
    s1.emit("session:resume", { userId: user1 });
    s2.emit("session:resume", { userId: user2 });

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

    const snapshot1 = await waitFor<any>(s1, "room:stateSync");
    const roomCode = snapshot1.roomCode;
    s2.emit("room:join", { userId: user2, roomCode });
    await waitFor<any>(s1, "room:stateSync");
    s1.emit("room:ready", { userId: user1, roomCode, ready: true });
    s2.emit("room:ready", { userId: user2, roomCode, ready: true });
    s1.emit("room:start", { userId: user1, roomCode });

    const countdown = await waitFor<any>(s1, "room:countdown");
    expect(countdown.endsAt).toBeTypeOf("number");

    // simple X win row: 0,1,2
    setTimeout(() => s1.emit("game:move", { userId: user1, roomCode, index: 0, answer: "LeBron James" }), 3200);
    setTimeout(() => s2.emit("game:move", { userId: user2, roomCode, index: 3, answer: "Kobe Bryant" }), 3400);
    setTimeout(() => s1.emit("game:move", { userId: user1, roomCode, index: 1, answer: "Tim Duncan" }), 3600);
    setTimeout(() => s2.emit("game:move", { userId: user2, roomCode, index: 4, answer: "Kevin Durant" }), 3800);
    setTimeout(() => s1.emit("game:move", { userId: user1, roomCode, index: 2, answer: "Stephen Curry" }), 4000);

    const gameOver = await waitFor<any>(s1, "game:over");
    expect(gameOver.winner).toBe("X");

    s1.disconnect();
    s2.disconnect();
  }, 15_000);
});
