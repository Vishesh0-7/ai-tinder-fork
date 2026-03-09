const express = require("express");
const { db } = require("../db");

const router = express.Router();

// GET /api/profiles — Returns 12 random profiles not yet acted on
router.get("/", (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM profiles
    WHERE id NOT IN (SELECT profile_id FROM actions)
    ORDER BY RANDOM()
    LIMIT 12
  `).all();

  const profiles = rows.map((row) => ({
    id: row.id,
    name: row.name,
    age: row.age,
    city: row.city,
    title: row.title,
    bio: row.bio,
    tags: JSON.parse(row.tags),
    images: JSON.parse(row.images),
    currentPhotoIndex: 0,
  }));

  res.json(profiles);
});

module.exports = router;
