const express = require("express");
const webpush = require("web-push");
const { db } = require("../db");

const router = express.Router();

// Generate VAPID keys once and store in DB, or use env vars
// For simplicity, generate on first run and persist via env or hardcode
// In production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars
let vapidKeys;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };
} else {
  // Auto-generate keys for development
  vapidKeys = webpush.generateVAPIDKeys();
  console.log("[Push] Generated VAPID keys (set env vars for production):");
  console.log(`  VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`  VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
}

webpush.setVapidDetails(
  "mailto:dev@tinder-clone.local",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// GET /api/push/vapid-public-key — Return the public VAPID key
router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// POST /api/push/subscribe — Store a push subscription
router.post("/subscribe", (req, res) => {
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }

  const stmt = db.prepare(`
    INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      keys_p256dh = excluded.keys_p256dh,
      keys_auth = excluded.keys_auth
  `);

  stmt.run(endpoint, keys.p256dh, keys.auth);
  res.status(201).json({ success: true });
});

// POST /api/push/send — Send a push notification to all subscribers (for testing / admin use)
router.post("/send", (req, res) => {
  const { title, body, url, tag } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }

  const payload = JSON.stringify({ title, body, url, tag });
  const subscriptions = db.prepare("SELECT * FROM push_subscriptions").all();

  let sent = 0;
  let failed = 0;

  const promises = subscriptions.map((sub) => {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };

    return webpush.sendNotification(pushSub, payload).then(() => {
      sent++;
    }).catch((err) => {
      failed++;
      // Remove invalid subscriptions (410 Gone or 404)
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
      }
    });
  });

  Promise.all(promises).then(() => {
    res.json({ sent, failed, total: subscriptions.length });
  });
});

module.exports = router;
