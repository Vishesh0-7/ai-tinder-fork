const express = require("express");
const cors = require("cors");
const path = require("path");
const { seedIfEmpty } = require("./db");
const profilesRouter = require("./routes/profiles");
const pushRouter = require("./routes/push"); // Load before actions so VAPID keys are configured
const actionsRouter = require("./routes/actions");

const PORT = process.env.PORT || 3000;

function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Serve frontend static files from parent directory
  app.use(express.static(path.join(__dirname, "..")));

  // API routes
  app.use("/api/profiles", profilesRouter);
  app.use("/api/actions", actionsRouter);
  app.use("/api/push", pushRouter);

  return app;
}

function startServer(port = PORT) {
  seedIfEmpty();
  const app = createApp();

  return app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`API endpoints:`);
    console.log(`  GET  /api/profiles         — Fetch unseen profiles`);
    console.log(`  POST /api/actions           — Record like/nope/super`);
    console.log(`  GET  /api/actions/history   — View action history`);
    console.log(`  GET  /api/push/vapid-public-key — Get VAPID public key`);
    console.log(`  POST /api/push/subscribe   — Register push subscription`);
    console.log(`  POST /api/push/send         — Send push to all subscribers`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { createApp, startServer, PORT };
