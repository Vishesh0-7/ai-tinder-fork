const profileRows = [
  { id: "p_1", name: "Alex", age: 26, city: "Brooklyn", title: "Engineer" },
  { id: "p_2", name: "Sam", age: 25, city: "Queens", title: "Designer" },
];

const actionRows = [
  { action: "like", created_at: "2026-01-01 00:00:00", name: "Alex", age: 26, city: "Brooklyn" },
];

const mockDb = {
  prepare: jest.fn((sql) => {
    if (sql.includes("COUNT(*) as cnt FROM profiles")) {
      return { get: () => ({ cnt: profileRows.length }) };
    }
    if (sql.includes("COUNT(*) as cnt FROM actions")) {
      return { get: () => ({ cnt: actionRows.length }) };
    }
    if (sql.includes("FROM actions a JOIN profiles p")) {
      return { all: () => actionRows };
    }
    if (sql.includes("LIMIT 5")) {
      return { all: () => profileRows };
    }
    throw new Error(`Unexpected SQL in view-db test: ${sql}`);
  }),
};

jest.mock("../../server/db", () => ({ db: mockDb }));

describe("view-db script", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  test("prints summary, history, and sample profiles", () => {
    require("../../server/view-db");

    expect(console.log).toHaveBeenCalledWith("=== Database Summary ===");
    expect(console.log).toHaveBeenCalledWith("Profiles:", 2);
    expect(console.log).toHaveBeenCalledWith("Actions:", 1);
    expect(console.log).toHaveBeenCalledWith("\n=== Action History ===");
    expect(console.log).toHaveBeenCalledWith("\n=== Sample Profiles (first 5) ===");
  });
});
