const path = require("path");

let countValue = 0;
const insertRuns = [];

const mockDbInstance = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn((sql) => {
    if (sql.includes("SELECT COUNT(*) as cnt FROM profiles")) {
      return { get: () => ({ cnt: countValue }) };
    }

    if (sql.includes("INSERT INTO profiles")) {
      return {
        run: (...args) => {
          insertRuns.push(args);
        },
      };
    }

    throw new Error(`Unexpected SQL in db test: ${sql}`);
  }),
  transaction: jest.fn((fn) => fn),
};

const mockDatabaseCtor = jest.fn(() => mockDbInstance);

jest.mock("better-sqlite3", () => mockDatabaseCtor, { virtual: true });

describe("db module", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    insertRuns.length = 0;
    countValue = 0;
  });

  test("creates db with expected path and initializes schema", () => {
    require("../../server/db");

    expect(mockDatabaseCtor).toHaveBeenCalledTimes(1);
    const dbPathArg = mockDatabaseCtor.mock.calls[0][0];
    expect(dbPathArg).toMatch(/[\\/]server[\\/]tinder\.db$/);
    expect(mockDbInstance.pragma).toHaveBeenCalledWith("journal_mode = WAL");
    expect(mockDbInstance.pragma).toHaveBeenCalledWith("foreign_keys = ON");
    expect(mockDbInstance.exec).toHaveBeenCalled();
  });

  test("seedIfEmpty skips when profiles already exist", () => {
    countValue = 10;
    const { seedIfEmpty } = require("../../server/db");

    seedIfEmpty();

    expect(insertRuns).toHaveLength(0);
  });

  test("seedIfEmpty inserts 50 profiles into empty DB", () => {
    countValue = 0;
    const { seedIfEmpty } = require("../../server/db");

    seedIfEmpty();

    expect(insertRuns).toHaveLength(50);
    for (const args of insertRuns) {
      expect(args).toHaveLength(8);
      expect(args[0]).toMatch(/^p_/);
      expect(args[6]).toMatch(/^\[/);
      expect(args[7]).toMatch(/^\[/);
    }
  });
});
