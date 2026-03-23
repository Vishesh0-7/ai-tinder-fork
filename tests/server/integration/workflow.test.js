const express = require("express");
const request = require("supertest");

const mockDb = { prepare: jest.fn() };
const mockWebPush = { sendNotification: jest.fn() };

jest.mock("../../../server/db", () => ({ db: mockDb }));
jest.mock("web-push", () => mockWebPush, { virtual: true });

function buildSqlHandlers(state) {
  return (sql) => {
    if (sql.includes("FROM profiles") && sql.includes("WHERE id NOT IN")) {
      return {
        all: () =>
          state.profiles
            .filter((p) => !state.actions.find((a) => a.profile_id === p.id))
            .slice(0, 12)
            .map((p) => ({ ...p, tags: JSON.stringify(p.tags), images: JSON.stringify(p.images) })),
      };
    }

    if (sql.includes("SELECT id FROM profiles WHERE id = ?")) {
      return { get: (profileId) => (state.profiles.find((p) => p.id === profileId) ? { id: profileId } : undefined) };
    }

    if (sql.includes("SELECT id FROM actions WHERE profile_id = ?")) {
      return { get: (profileId) => (state.actions.find((a) => a.profile_id === profileId) ? { id: 1 } : undefined) };
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
        get: (profileId) => {
          const p = state.profiles.find((profile) => profile.id === profileId);
          return p ? { name: p.name } : undefined;
        },
      };
    }

    if (sql.includes("SELECT * FROM push_subscriptions")) {
      return { all: () => state.subscriptions };
    }

    if (sql.includes("DELETE FROM push_subscriptions WHERE endpoint = ?")) {
      return { run: () => {} };
    }

    if (sql.includes("FROM actions a") && sql.includes("JOIN profiles p")) {
      return {
        all: (...params) => {
          const filter = params[0];
          const actions = filter ? state.actions.filter((a) => a.action === filter) : state.actions;
          return actions.map((a) => {
            const p = state.profiles.find((profile) => profile.id === a.profile_id);
            return {
              action: a.action,
              created_at: a.created_at,
              id: p.id,
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

    throw new Error(`Unexpected SQL in integration test: ${sql}`);
  };
}

describe("api integration workflow", () => {
  let state;
  let app;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    state = {
      profiles: [
        {
          id: "p_1",
          name: "Alex",
          age: 28,
          city: "Brooklyn",
          title: "Engineer",
          bio: "Bio",
          tags: ["Coffee"],
          images: ["img1", "img2"],
        },
        {
          id: "p_2",
          name: "Sam",
          age: 27,
          city: "Queens",
          title: "Designer",
          bio: "Bio",
          tags: ["Movies"],
          images: ["img3", "img4"],
        },
      ],
      actions: [],
      subscriptions: [
        {
          endpoint: "https://push.example/1",
          keys_p256dh: "k1",
          keys_auth: "a1",
        },
      ],
    };

    mockDb.prepare.mockImplementation(buildSqlHandlers(state));
    mockWebPush.sendNotification.mockResolvedValue(undefined);

    const profilesRouter = require("../../../server/routes/profiles");
    const actionsRouter = require("../../../server/routes/actions");

    app = express();
    app.use(express.json());
    app.use("/api/profiles", profilesRouter);
    app.use("/api/actions", actionsRouter);
  });

  test("profile fetch then action then history creates consistent state", async () => {
    const profilesRes = await request(app).get("/api/profiles");
    expect(profilesRes.status).toBe(200);
    expect(profilesRes.body).toHaveLength(2);

    const likeRes = await request(app).post("/api/actions").send({ profileId: "p_1", action: "like" });
    expect(likeRes.status).toBe(201);
    expect(mockWebPush.sendNotification).toHaveBeenCalledTimes(1);

    const afterActionRes = await request(app).get("/api/profiles");
    expect(afterActionRes.status).toBe(200);
    expect(afterActionRes.body.map((p) => p.id)).toEqual(["p_2"]);

    const historyRes = await request(app).get("/api/actions/history?action=like");
    expect(historyRes.status).toBe(200);
    expect(historyRes.body).toHaveLength(1);
    expect(historyRes.body[0].profile.id).toBe("p_1");
  });
});
