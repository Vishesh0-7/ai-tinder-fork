const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "tinder.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// -------------------
// Schema
// -------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    city TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT NOT NULL,
    tags TEXT NOT NULL,
    images TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('like', 'nope', 'super')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// -------------------
// Data arrays (same as frontend app.js)
// -------------------
const TAGS = [
  "Coffee", "Hiking", "Movies", "Live Music", "Board Games", "Cats", "Dogs", "Traveler",
  "Foodie", "Tech", "Art", "Runner", "Climbing", "Books", "Yoga", "Photography"
];

const FIRST_NAMES = [
  "Alex", "Sam", "Jordan", "Taylor", "Casey", "Avery", "Riley", "Morgan", "Quinn", "Cameron",
  "Jamie", "Drew", "Parker", "Reese", "Emerson", "Rowan", "Shawn", "Harper", "Skyler", "Devon"
];

const CITIES = [
  "Brooklyn", "Manhattan", "Queens", "Jersey City", "Hoboken", "Astoria",
  "Williamsburg", "Bushwick", "Harlem", "Lower East Side"
];

const JOBS = [
  "Product Designer", "Software Engineer", "Data Analyst", "Barista", "Teacher",
  "Photographer", "Architect", "Chef", "Nurse", "Marketing Manager", "UX Researcher"
];

const BIOS = [
  "Weekend hikes and weekday lattes.",
  "Dog parent. Amateur chef. Karaoke enthusiast.",
  "Trying every taco in the city — for science.",
  "Bookstore browser and movie quote machine.",
  "Gym sometimes, Netflix always.",
  "Looking for the best slice in town.",
  "Will beat you at Mario Kart.",
  "Currently planning the next trip."
];

const UNSPLASH_SEEDS = [
  "1515462277126-2b47b9fa09e6",
  "1520975916090-3105956dac38",
  "1519340241574-2cec6aef0c01",
  "1554151228-14d9def656e4",
  "1548142813-c348350df52b",
  "1517841905240-472988babdf9",
  "1535713875002-d1d0cf377fde",
  "1545996124-0501ebae84d0",
  "1524504388940-b1c1722653e1",
  "1531123897727-8f129e1688ce",
];

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTags() {
  return Array.from(new Set(Array.from({ length: 4 }, () => sample(TAGS))));
}

function imgFor(seed) {
  return `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;
}

function pickImages() {
  const count = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...UNSPLASH_SEEDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(imgFor);
}

// -------------------
// Seed database with profiles
// -------------------
function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM profiles").get().cnt;
  if (count > 0) {
    console.log(`Database already has ${count} profiles, skipping seed.`);
    return;
  }

  console.log("Seeding database with 50 profiles...");

  const insert = db.prepare(`
    INSERT INTO profiles (id, name, age, city, title, bio, tags, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedMany = db.transaction(() => {
    for (let i = 0; i < 50; i++) {
      insert.run(
        `p_${i}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        sample(FIRST_NAMES),
        18 + Math.floor(Math.random() * 22),
        sample(CITIES),
        sample(JOBS),
        sample(BIOS),
        JSON.stringify(pickTags()),
        JSON.stringify(pickImages())
      );
    }
  });

  seedMany();
  console.log("Seeded 50 profiles.");
}

module.exports = { db, seedIfEmpty };
