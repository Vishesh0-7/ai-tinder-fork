const express = require("express");
const request = require("supertest");

const mockDb = { prepare: jest.fn() };
const mockWebPush = {
  generateVAPIDKeys: jest.fn(() => ({ publicKey: "pub", privateKey: "priv" })),
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
};

jest.mock("web-push", () => mockWebPush, { virtual: true });
jest.mock("../../../server/db", () => ({ db: mockDb }));

function createPushApp(state) {
  mockDb.prepare.mockImplementation((sql) => {
    if (sql.includes("INSERT INTO push_subscriptions")) {
      return {
        run: (endpoint, p256dh, auth) => {
          const existing = state.subscriptions.find((s) => s.endpoint === endpoint);
          if (existing) {
            existing.keys_p256dh = p256dh;
            existing.keys_auth = auth;
          } else {
            state.subscriptions.push({ endpoint, keys_p256dh: p256dh, keys_auth: auth });
          }
        },
      };
    }

    if (sql.includes("SELECT * FROM push_subscriptions")) {
      return { all: () => state.subscriptions };
    }

    if (sql.includes("DELETE FROM push_subscriptions WHERE endpoint = ?")) {
      return {
        run: (endpoint) => {
          state.subscriptions = state.subscriptions.filter((s) => s.endpoint !== endpoint);
        },
      };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const router = require("../../../server/routes/push");
  const app = express();
  app.use(express.json());
  app.use("/", router);
  return app;
}

describe("push route", () => {
  let state;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    state = {
      subscriptions: [
        {
          endpoint: "https://push.example/a",
          keys_p256dh: "p-a",
          keys_auth: "a-a",
        },
      ],
    };
    mockWebPush.sendNotification.mockResolvedValue(undefined);
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  test("returns generated public VAPID key", async () => {
    const app = createPushApp(state);

    const res = await request(app).get("/vapid-public-key");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: "pub" });
    expect(mockWebPush.setVapidDetails).toHaveBeenCalled();
  });

  test("rejects invalid subscription objects", async () => {
    const app = createPushApp(state);

    const res = await request(app).post("/subscribe").send({ endpoint: "x" });

    expect(res.status).toBe(400);
  });

  test("upserts subscriptions", async () => {
    const app = createPushApp(state);

    const res = await request(app)
      .post("/subscribe")
      .send({ endpoint: "https://push.example/a", keys: { p256dh: "new-p", auth: "new-a" } });

    expect(res.status).toBe(201);
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0].keys_p256dh).toBe("new-p");
  });

  test("requires title and body when sending notifications", async () => {
    const app = createPushApp(state);

    const res = await request(app).post("/send").send({ title: "x" });

    expect(res.status).toBe(400);
  });

  test("sends pushes and reports sent and failed counters", async () => {
    state.subscriptions.push({ endpoint: "https://push.example/b", keys_p256dh: "p-b", keys_auth: "a-b" });
    mockWebPush.sendNotification
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ statusCode: 410 });

    const app = createPushApp(state);

    const res = await request(app).post("/send").send({ title: "hello", body: "world" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: 1, failed: 1, total: 2 });
    expect(state.subscriptions).toHaveLength(1);
  });

  test("uses environment VAPID keys when provided", async () => {
    process.env.VAPID_PUBLIC_KEY = "env-public";
    process.env.VAPID_PRIVATE_KEY = "env-private";

    const app = createPushApp(state);
    const res = await request(app).get("/vapid-public-key");

    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe("env-public");
    expect(mockWebPush.generateVAPIDKeys).not.toHaveBeenCalled();
  });
});
