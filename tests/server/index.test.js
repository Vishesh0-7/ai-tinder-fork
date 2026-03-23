const request = require("supertest");

const mockSeedIfEmpty = jest.fn();

jest.mock("../../server/db", () => ({ seedIfEmpty: mockSeedIfEmpty }));

jest.mock("../../server/routes/profiles", () => {
  const express = require("express");
  const router = express.Router();
  router.get("/", (req, res) => res.json([{ id: "p_1" }]));
  return router;
});

jest.mock("../../server/routes/actions", () => {
  const express = require("express");
  const router = express.Router();
  router.get("/", (req, res) => res.json({ ok: true }));
  return router;
});

jest.mock("../../server/routes/push", () => {
  const express = require("express");
  const router = express.Router();
  router.get("/vapid-public-key", (req, res) => res.json({ publicKey: "pub" }));
  return router;
});

describe("server/index", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("createApp wires api routes", async () => {
    const { createApp } = require("../../server/index");
    const app = createApp();

    const profilesRes = await request(app).get("/api/profiles");
    const actionsRes = await request(app).get("/api/actions");
    const pushRes = await request(app).get("/api/push/vapid-public-key");

    expect(profilesRes.status).toBe(200);
    expect(profilesRes.body).toEqual([{ id: "p_1" }]);
    expect(actionsRes.status).toBe(200);
    expect(pushRes.status).toBe(200);
  });

  test("startServer seeds database before listening", async () => {
    const { startServer } = require("../../server/index");
    const server = startServer(0);

    expect(mockSeedIfEmpty).toHaveBeenCalledTimes(1);

    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
});
