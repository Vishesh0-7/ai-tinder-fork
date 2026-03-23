module.exports = {
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  collectCoverageFrom: [
    "app.js",
    "data.js",
    "sw.js",
    "server/**/*.js",
    "!server/package.json"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testEnvironment: "node"
};
