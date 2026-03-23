const express = require("express");
const request = require("supertest");

const mockDb = { prepare: jest.fn() };
const mockWebPush = { sendNotification: jest.fn() };

jest.mock("web-push", () => mockWebPush, { virtual: true });
jest.mock("../../../server/db", () => ({ db: mockDb }));

function buildApp(state) {
  mockDb.prepare.mockImplementation((sql) => {
    if (sql.includes("SELECT id FROM profiles WHERE id = ?")) {
      return { get: (profileId) => (state.profiles[profileId] ? { id: profileId } : undefined) };
    }

    if (sql.includes("SELECT id FROM actions WHERE profile_id = ?")) {
      return {
        get: (profileId) => {
          const match = state.actions.find((a) => a.profile_id === profileId);
          return match ? { id: 1 } : undefined;
        },
      };
    }

    if (sql.includes("INSERT INTO actions")) {
      return {
        run: (profileId, action) => {
          state.actions.push({ profile_id: profileId, action, created_at: "2026-01-01 00:00:00" });
        },
      };
    }

    if (sql.includes("SELECT name FROM profiles WHERE id = ?")) {
      return {
        get: (profileId) => (state.profiles[profileId] ? { name: state.profiles[profileId].name } : undefined),
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

    if (sql.includes("FROM actions a")) {
      return {
        all: (...params) => {
          const actionFilter = params[0];
          const actions = actionFilter
            ? state.actions.filter((a) => a.action === actionFilter)
            : state.actions;

          return actions.map((a) => {
            const p = state.profiles[a.profile_id];
            return {
              action: a.action,
              created_at: a.created_at,
              id: a.profile_id,
              name: p.name,
              age: p.age,
              city: p.city,
              title: p.title,
              bio: p.bio,
              tags: JSON.stringify(p.tags),
              images: JSON.stringify(p.images),
            };
          });
        },
      };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const router = require("../../../server/routes/actions");
  const app = express();
  app.use(express.json());
  app.use("/", router);
  return app;
}

describe("actions route", () => {
  let state;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    state = {
      profiles: {
        p_1: {
          name: "Alex",
          age: 26,
          city: "Brooklyn",
          title: "Engineer",
          bio: "Hello",
          tags: ["Coffee"],
          images: ["img1", "img2"],
        },
      },
      actions: [],
      subscriptions: [
        {
          endpoint: "https://push.example/1",
          keys_p256dh: "k1",
          keys_auth: "a1",
        },
      ],
    };

    mockWebPush.sendNotification.mockResolvedValue(undefined);
  });

  test("rejects missing payload", async () => {
    const app = buildApp(state);

    const res = await request(app).post("/").send({ profileId: "p_1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test("rejects invalid action", async () => {
    const app = buildApp(state);

    const res = await request(app).post("/").send({ profileId: "p_1", action: "block" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be one of/);
  });

  test("returns 404 when profile does not exist", async () => {
    const app = buildApp(state);

    const res = await request(app).post("/").send({ profileId: "missing", action: "like" });

    expect(res.status).toBe(404);
  });

  test("returns 409 for duplicate actions", async () => {
    state.actions.push({ profile_id: "p_1", action: "like", created_at: "2026-01-01 00:00:00" });
    const app = buildApp(state);

    const res = await request(app).post("/").send({ profileId: "p_1", action: "like" });

    expect(res.status).toBe(409);
  });

  test("records nope action without sending push", async () => {
    const app = buildApp(state);

    const res = await request(app).post("/").send({ profileId: "p_1", action: "nope" });

    expect(res.status).toBe(201);
    expect(state.actions).toHaveLength(1);
    expect(mockWebPush.sendNotification).not.toHaveBeenCalled();
  });

  test("records like action and sends push notifications", async () => {
    const app = buildApp(state);

    const res = await request(app).post("/").send({ profileId: "p_1", action: "like" });

    expect(res.status).toBe(201);
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(mockWebPush.sendNotification.mock.calls[0][1]).toContain("liked you back");
  });

  test("removes invalid subscriptions when push fails with 410", async () => {
    mockWebPush.sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    const app = buildApp(state);

    await request(app).post("/").send({ profileId: "p_1", action: "super" });

    expect(state.subscriptions).toEqual([]);
  });

  test("returns history and supports filtering", async () => {
    state.actions.push(
      { profile_id: "p_1", action: "like", created_at: "2026-01-01 00:00:00" },
      { profile_id: "p_1", action: "nope", created_at: "2026-01-01 00:00:01" }
    );
    const app = buildApp(state);

    const all = await request(app).get("/history");
    const filtered = await request(app).get("/history?action=like");

    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].action).toBe("like");
    expect(filtered.body[0].profile.tags).toEqual(["Coffee"]);
  });
});
