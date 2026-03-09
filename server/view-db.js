const { db } = require("./db");

const profileCount = db.prepare("SELECT COUNT(*) as cnt FROM profiles").get().cnt;
const actionCount = db.prepare("SELECT COUNT(*) as cnt FROM actions").get().cnt;

console.log("=== Database Summary ===");
console.log("Profiles:", profileCount);
console.log("Actions:", actionCount);

if (actionCount > 0) {
  console.log("\n=== Action History ===");
  const actions = db.prepare(`
    SELECT a.action, a.created_at, p.name, p.age, p.city
    FROM actions a JOIN profiles p ON a.profile_id = p.id
    ORDER BY a.created_at DESC
  `).all();
  actions.forEach(a => {
    console.log("  " + a.action.toUpperCase().padEnd(6) + " | " + a.name + ", " + a.age + " (" + a.city + ") | " + a.created_at);
  });
} else {
  console.log("\nNo actions recorded yet. Start swiping!");
}

console.log("\n=== Sample Profiles (first 5) ===");
const samples = db.prepare("SELECT id, name, age, city, title FROM profiles LIMIT 5").all();
samples.forEach(p => {
  console.log("  " + p.name + ", " + p.age + " | " + p.title + " | " + p.city + " | " + p.id);
});
