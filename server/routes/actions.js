const express = require("express");
const webpush = require("web-push");
const { db } = require("../db");

const router = express.Router();

const VALID_ACTIONS = ["like", "nope", "super"];

// POST /api/actions — Record a like/nope/super action
router.post("/", (req, res) => {
  const { profileId, action } = req.body;

  if (!profileId || !action) {
    return res.status(400).json({ error: "profileId and action are required" });
  }

  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(", ")}` });
  }

  // Verify profile exists
  const profile = db.prepare("SELECT id FROM profiles WHERE id = ?").get(profileId);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found" });
  }

  // Check for duplicate action on same profile
  const existing = db.prepare("SELECT id FROM actions WHERE profile_id = ?").get(profileId);
  if (existing) {
    return res.status(409).json({ error: "Action already recorded for this profile" });
  }

  db.prepare("INSERT INTO actions (profile_id, action) VALUES (?, ?)").run(profileId, action);

  // Simulate mutual match: if user liked/super-liked, send a push notification
  if (action === "like" || action === "super") {
    const profileData = db.prepare("SELECT name FROM profiles WHERE id = ?").get(profileId);
    const name = profileData ? profileData.name : "Someone";

    const payload = JSON.stringify({
      title: "It's a Match! 🔥",
      body: `${name} liked you back!`,
      tag: `match-${profileId}`,
    });

    const subscriptions = db.prepare("SELECT * FROM push_subscriptions").all();
    for (const sub of subscriptions) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
      };
      webpush.sendNotification(pushSub, payload).catch((err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
        }
      });
    }
  }

  res.status(201).json({ success: true, action, profileId });
});

// GET /api/actions/history — Get action history with profile data
router.get("/history", (req, res) => {
  const { action } = req.query;

  let query = `
    SELECT a.action, a.created_at,
           p.id, p.name, p.age, p.city, p.title, p.bio, p.tags, p.images
    FROM actions a
    JOIN profiles p ON a.profile_id = p.id
  `;
  const params = [];

  if (action && VALID_ACTIONS.includes(action)) {
    query += " WHERE a.action = ?";
    params.push(action);
  }

  query += " ORDER BY a.created_at DESC";

  const rows = db.prepare(query).all(...params);

  const history = rows.map((row) => ({
    action: row.action,
    created_at: row.created_at,
    profile: {
      id: row.id,
      name: row.name,
      age: row.age,
      city: row.city,
      title: row.title,
      bio: row.bio,
      tags: JSON.parse(row.tags),
      images: JSON.parse(row.images),
    },
  }));

  res.json(history);
});

module.exports = router;
