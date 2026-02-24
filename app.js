// app.js
// Plain global JS, no modules.

// -------------------
// Swipe configuration
// -------------------
const SWIPE_THRESHOLD = 100;      // px to trigger swipe action
const SWIPE_UP_THRESHOLD = 80;    // px to trigger super like
const ROTATION_FACTOR = 0.15;     // rotation based on drag distance

// -------------------
// Data generator
// -------------------
const TAGS = [
  "Coffee","Hiking","Movies","Live Music","Board Games","Cats","Dogs","Traveler",
  "Foodie","Tech","Art","Runner","Climbing","Books","Yoga","Photography"
];
const FIRST_NAMES = [
  "Alex","Sam","Jordan","Taylor","Casey","Avery","Riley","Morgan","Quinn","Cameron",
  "Jamie","Drew","Parker","Reese","Emerson","Rowan","Shawn","Harper","Skyler","Devon"
];
const CITIES = [
  "Brooklyn","Manhattan","Queens","Jersey City","Hoboken","Astoria",
  "Williamsburg","Bushwick","Harlem","Lower East Side"
];
const JOBS = [
  "Product Designer","Software Engineer","Data Analyst","Barista","Teacher",
  "Photographer","Architect","Chef","Nurse","Marketing Manager","UX Researcher"
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

function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickTags() { return Array.from(new Set(Array.from({length:4}, ()=>sample(TAGS)))); }
function imgFor(seed) {
  return `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=80`;
}

// Pick 2-4 unique random images for a profile
function pickImages() {
  const count = 2 + Math.floor(Math.random() * 3); // 2-4 images
  const shuffled = [...UNSPLASH_SEEDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(imgFor);
}

function generateProfiles(count = 12) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    profiles.push({
      id: `p_${i}_${Date.now().toString(36)}`,
      name: sample(FIRST_NAMES),
      age: 18 + Math.floor(Math.random() * 22),
      city: sample(CITIES),
      title: sample(JOBS),
      bio: sample(BIOS),
      tags: pickTags(),
      images: pickImages(),
      currentPhotoIndex: 0,
    });
  }
  return profiles;
}

// -------------------
// UI rendering
// -------------------
const deckEl = document.getElementById("deck");
const shuffleBtn = document.getElementById("shuffleBtn");
const likeBtn = document.getElementById("likeBtn");
const nopeBtn = document.getElementById("nopeBtn");
const superLikeBtn = document.getElementById("superLikeBtn");

let profiles = [];
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let activeCard = null;

// Double-tap detection
let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;
const DOUBLE_TAP_DELAY = 300; // ms
const TAP_THRESHOLD = 10; // px - max movement to count as tap

function createStampEl(type) {
  const stamp = document.createElement("div");
  stamp.className = `card__stamp card__stamp--${type}`;
  stamp.textContent = type === "like" ? "LIKE" : type === "nope" ? "NOPE" : "SUPER";
  return stamp;
}

function renderDeck() {
  deckEl.setAttribute("aria-busy", "true");
  deckEl.innerHTML = "";

  profiles.forEach((p, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = p.id;
    card.dataset.index = idx;

    // Add stamp elements (hidden by default)
    card.appendChild(createStampEl("like"));
    card.appendChild(createStampEl("nope"));
    card.appendChild(createStampEl("super"));

    // Photo indicator dots
    if (p.images.length > 1) {
      const indicators = document.createElement("div");
      indicators.className = "photo-indicators";
      p.images.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.className = `photo-dot${i === p.currentPhotoIndex ? " photo-dot--active" : ""}`;
        indicators.appendChild(dot);
      });
      card.appendChild(indicators);
    }

    const img = document.createElement("img");
    img.className = "card__media";
    img.src = p.images[p.currentPhotoIndex];
    img.alt = `${p.name} — profile photo ${p.currentPhotoIndex + 1} of ${p.images.length}`;
    img.draggable = false;

    const body = document.createElement("div");
    body.className = "card__body";

    const titleRow = document.createElement("div");
    titleRow.className = "title-row";
    titleRow.innerHTML = `
      <h2 class="card__title">${p.name}</h2>
      <span class="card__age">${p.age}</span>
    `;

    const meta = document.createElement("div");
    meta.className = "card__meta";
    meta.textContent = `${p.title} • ${p.city}`;

    const chips = document.createElement("div");
    chips.className = "card__chips";
    p.tags.forEach((t) => {
      const c = document.createElement("span");
      c.className = "chip";
      c.textContent = t;
      chips.appendChild(c);
    });

    body.appendChild(titleRow);
    body.appendChild(meta);
    body.appendChild(chips);

    card.appendChild(img);
    card.appendChild(body);

    deckEl.appendChild(card);

    // Add swipe events only to the top card
    if (idx === 0) {
      initSwipeEvents(card);
    }
  });

  deckEl.removeAttribute("aria-busy");
}

// -------------------
// Swipe logic
// -------------------
function initSwipeEvents(card) {
  // Add card-specific start events
  card.addEventListener("mousedown", onDragStart);
  card.addEventListener("touchstart", onDragStart, { passive: false });
}

function getEventPos(e) {
  if (e.touches && e.touches[0]) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function onDragStart(e) {
  if (profiles.length === 0) return;
  
  activeCard = deckEl.querySelector(".card:first-child");
  if (!activeCard) return;

  // Prevent default to stop text selection and image dragging
  e.preventDefault();

  isDragging = true;
  activeCard.classList.add("card--dragging");

  const pos = getEventPos(e);
  startX = pos.x;
  startY = pos.y;
  currentX = 0;
  currentY = 0;
}

function onDragMove(e) {
  if (!isDragging || !activeCard) return;

  const pos = getEventPos(e);
  currentX = pos.x - startX;
  currentY = pos.y - startY;

  // Apply transform
  const rotation = currentX * ROTATION_FACTOR;
  activeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;

  // Update stamp visibility
  const likeStamp = activeCard.querySelector(".card__stamp--like");
  const nopeStamp = activeCard.querySelector(".card__stamp--nope");
  const superStamp = activeCard.querySelector(".card__stamp--super");

  // Reset stamps
  likeStamp.style.opacity = 0;
  nopeStamp.style.opacity = 0;
  superStamp.style.opacity = 0;

  // Show appropriate stamp based on drag direction
  if (currentY < -SWIPE_UP_THRESHOLD && Math.abs(currentX) < SWIPE_THRESHOLD) {
    superStamp.style.opacity = Math.min(1, Math.abs(currentY) / 100);
  } else if (currentX > 50) {
    likeStamp.style.opacity = Math.min(1, currentX / SWIPE_THRESHOLD);
  } else if (currentX < -50) {
    nopeStamp.style.opacity = Math.min(1, Math.abs(currentX) / SWIPE_THRESHOLD);
  }

  // Prevent scrolling on touch devices
  if (e.cancelable) e.preventDefault();
}

function onDragEnd() {
  if (!isDragging || !activeCard) return;
  isDragging = false;

  activeCard.classList.remove("card--dragging");

  // Check if this was a tap (minimal movement)
  const isTap = Math.abs(currentX) < TAP_THRESHOLD && Math.abs(currentY) < TAP_THRESHOLD;

  // Determine action based on swipe distance
  if (currentY < -SWIPE_UP_THRESHOLD && Math.abs(currentX) < SWIPE_THRESHOLD) {
    // Super like (swipe up)
    dismissCard("super");
  } else if (currentX > SWIPE_THRESHOLD) {
    // Like (swipe right)
    dismissCard("like");
  } else if (currentX < -SWIPE_THRESHOLD) {
    // Nope (swipe left)
    dismissCard("nope");
  } else {
    // Reset position
    activeCard.style.transform = "";
    const stamps = activeCard.querySelectorAll(".card__stamp");
    stamps.forEach(s => s.style.opacity = 0);

    // Handle tap/double-tap
    if (isTap) {
      const now = Date.now();
      if (now - lastTapTime < DOUBLE_TAP_DELAY) {
        // Double tap detected - cycle to next photo
        cyclePhoto();
        lastTapTime = 0; // Reset to prevent triple-tap
      } else {
        lastTapTime = now;
      }
    }
  }
  
  activeCard = null;
}

// -------------------
// Photo cycling (double-tap)
// -------------------
function cyclePhoto() {
  if (profiles.length === 0) return;
  
  const profile = profiles[0];
  if (profile.images.length <= 1) return;

  // Cycle to next photo
  profile.currentPhotoIndex = (profile.currentPhotoIndex + 1) % profile.images.length;

  // Update the image
  const topCard = deckEl.querySelector(".card:first-child");
  if (!topCard) return;

  const img = topCard.querySelector(".card__media");
  if (img) {
    img.style.opacity = 0;
    setTimeout(() => {
      img.src = profile.images[profile.currentPhotoIndex];
      img.alt = `${profile.name} — photo ${profile.currentPhotoIndex + 1} of ${profile.images.length}`;
      img.style.opacity = 1;
    }, 150);
  }

  // Update indicators
  const dots = topCard.querySelectorAll(".photo-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("photo-dot--active", i === profile.currentPhotoIndex);
  });

  console.log(`Photo ${profile.currentPhotoIndex + 1}/${profile.images.length}`);
}

function dismissCard(action) {
  const topCard = deckEl.querySelector(".card:first-child");
  if (!topCard) return;

  // Reset active card reference
  activeCard = null;

  // Add dismiss animation class
  topCard.classList.add(`card--${action}`);

  // Show the stamp
  const stamp = topCard.querySelector(`.card__stamp--${action}`);
  if (stamp) stamp.style.opacity = 1;

  // Set exit transform based on action
  let exitX = 0, exitY = 0, rotation = 0;
  switch (action) {
    case "like":
      exitX = window.innerWidth;
      rotation = 30;
      break;
    case "nope":
      exitX = -window.innerWidth;
      rotation = -30;
      break;
    case "super":
      exitY = -window.innerHeight;
      break;
  }

  topCard.style.transform = `translate(${exitX}px, ${exitY}px) rotate(${rotation}deg)`;
  topCard.style.opacity = 0;

  // Remove card after animation
  setTimeout(() => {
    profiles.shift();
    renderDeck();
    console.log(`${action.toUpperCase()}: Card dismissed. ${profiles.length} remaining.`);
  }, 300);
}

function resetDeck() {
  profiles = generateProfiles(12);
  renderDeck();
}

// -------------------
// Button controls
// -------------------
likeBtn.addEventListener("click", () => {
  if (profiles.length > 0) {
    dismissCard("like");
  }
});

nopeBtn.addEventListener("click", () => {
  if (profiles.length > 0) {
    dismissCard("nope");
  }
});

superLikeBtn.addEventListener("click", () => {
  if (profiles.length > 0) {
    dismissCard("super");
  }
});

shuffleBtn.addEventListener("click", resetDeck);

// -------------------
// Document-level drag listeners (only added once)
// -------------------
document.addEventListener("mousemove", onDragMove);
document.addEventListener("mouseup", onDragEnd);
document.addEventListener("mouseleave", onDragEnd);
document.addEventListener("touchmove", onDragMove, { passive: false });
document.addEventListener("touchend", onDragEnd);
document.addEventListener("touchcancel", onDragEnd);

// Boot
resetDeck();
