import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAppServer } from "../src/server.js";

describe("rest", () => {
  it("creates guest and fetches /me", async () => {
    const { app } = createAppServer();
    const created = await request(app).post("/auth/guest").send({ username: "nbaFan" });
    expect(created.status).toBe(200);
    const me = await request(app).get(`/me?userId=${created.body.id}`);
    expect(me.status).toBe(200);
    expect(me.body.username).toContain("nbaFan");
  });
});
