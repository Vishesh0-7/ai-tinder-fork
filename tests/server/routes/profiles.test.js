const express = require("express");
const request = require("supertest");

const mockDb = { prepare: jest.fn() };

jest.mock("../../../server/db", () => ({
  db: mockDb,
}));

describe("profiles route", () => {
  let app;

  beforeEach(() => {
    jest.resetModules();

    mockDb.prepare.mockImplementation((sql) => {
      if (sql.includes("FROM profiles")) {
        return {
          all: () => [
            {
              id: "p_1",
              name: "Alex",
              age: 25,
              city: "Brooklyn",
              title: "Engineer",
              bio: "Hi",
              tags: JSON.stringify(["Coffee"]),
              images: JSON.stringify(["img1", "img2"]),
            },
          ],
        };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const router = require("../../../server/routes/profiles");
    app = express();
    app.use("/", router);
  });

  test("returns normalized profile payload", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: "p_1",
        name: "Alex",
        age: 25,
        city: "Brooklyn",
        title: "Engineer",
        bio: "Hi",
        tags: ["Coffee"],
        images: ["img1", "img2"],
        currentPhotoIndex: 0,
      },
    ]);
  });

  test("returns empty array when no unseen profiles are left", async () => {
    mockDb.prepare.mockReturnValueOnce({ all: () => [] });

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
