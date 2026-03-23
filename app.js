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

// Action tracking
let actionHistory = [];
let isAnimating = false;
const API_BASE = window.location.origin + "/api";

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

// Fetch profiles from API with fallback to local generation
async function fetchProfiles() {
  try {
    const res = await fetch(`${API_BASE}/profiles`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map(p => ({ ...p, currentPhotoIndex: p.currentPhotoIndex || 0 }));
  } catch (err) {
    console.warn("API unavailable, using local generation:", err.message);
    return generateProfiles(12);
  }
}

function renderDeck() {
  deckEl.setAttribute("aria-busy", "true");
  deckEl.innerHTML = "";

  if (profiles.length === 0) {
    deckEl.innerHTML = `<div class="deck__empty">
      <p>No more profiles!</p>
      <button class="ghost-btn" onclick="resetDeck()">Shuffle New Deck</button>
    </div>`;
    deckEl.removeAttribute("aria-busy");
    return;
  }

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
  if (isAnimating) return;
  const topCard = deckEl.querySelector(".card:first-child");
  if (!topCard) return;

  isAnimating = true;
  activeCard = null;
  deckEl.setAttribute("aria-busy", "true");

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

  // Record action locally
  const profile = profiles[0];
  actionHistory.push({ profile, action, timestamp: Date.now() });

  // POST action to backend (fire-and-forget)
  fetch(`${API_BASE}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId: profile.id, action })
  }).catch(err => console.warn("Failed to record action:", err.message));

  // Remove card after animation
  setTimeout(() => {
    profiles.shift();
    renderDeck();
    isAnimating = false;
    deckEl.setAttribute("aria-busy", "false");
    console.log(`${action.toUpperCase()}: Card dismissed. ${profiles.length} remaining.`);
  }, 300);
}

async function resetDeck() {
  profiles = await fetchProfiles();
  actionHistory = [];
  renderDeck();
}

// -------------------
// Button controls
// -------------------
likeBtn.addEventListener("click", () => {
  if (profiles.length > 0 && !isAnimating) {
    dismissCard("like");
  }
});

nopeBtn.addEventListener("click", () => {
  if (profiles.length > 0 && !isAnimating) {
    dismissCard("nope");
  }
});

superLikeBtn.addEventListener("click", () => {
  if (profiles.length > 0 && !isAnimating) {
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

// -------------------
// Push Notifications
// -------------------
const pushState = {
  supported: false,
  permission: Notification.permission || "default",
  subscription: null,
  registration: null,
};

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function renderPushBanner() {
  // Remove existing banner if any
  const existing = document.getElementById("pushBanner");
  if (existing) existing.remove();

  if (!pushState.supported) {
    // Push not supported — show info banner
    const banner = document.createElement("div");
    banner.id = "pushBanner";
    banner.className = "push-banner push-banner--unsupported";
    banner.innerHTML = `<span>Push notifications are not supported in this browser.</span>`;
    document.querySelector(".app__header").after(banner);
    return;
  }

  if (pushState.permission === "granted" && pushState.subscription) {
    // Already subscribed — no banner needed
    return;
  }

  if (pushState.permission === "denied") {
    const banner = document.createElement("div");
    banner.id = "pushBanner";
    banner.className = "push-banner push-banner--denied";
    banner.innerHTML = `<span>Notifications blocked. Enable them in your browser settings to get match alerts.</span>`;
    document.querySelector(".app__header").after(banner);
    return;
  }

  // Default — show opt-in banner
  const banner = document.createElement("div");
  banner.id = "pushBanner";
  banner.className = "push-banner";
  banner.innerHTML = `
    <span>Get notified about new matches and messages!</span>
    <button class="push-banner__btn" id="enablePushBtn">Enable Notifications</button>
    <button class="push-banner__dismiss" id="dismissPushBtn" aria-label="Dismiss">&times;</button>
  `;
  document.querySelector(".app__header").after(banner);

  document.getElementById("enablePushBtn").addEventListener("click", requestPushPermission);
  document.getElementById("dismissPushBtn").addEventListener("click", () => {
    banner.remove();
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[Push] Service worker registered:", registration.scope);
    pushState.registration = registration;
    return registration;
  } catch (err) {
    console.error("[Push] Service worker registration failed:", err);
    return null;
  }
}

async function subscribeToPush(registration) {
  try {
    // Fetch the VAPID public key from the server
    const res = await fetch(`${API_BASE}/push/vapid-public-key`);
    if (!res.ok) throw new Error(`Failed to fetch VAPID key: ${res.status}`);
    const { publicKey } = await res.json();

    // Convert URL-safe base64 to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Send subscription to the server
    await fetch(`${API_BASE}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    pushState.subscription = subscription;
    console.log("[Push] Subscribed successfully");
    return subscription;
  } catch (err) {
    console.error("[Push] Subscription failed:", err);
    return null;
  }
}

async function requestPushPermission() {
  if (!pushState.supported) return;

  const permission = await Notification.requestPermission();
  pushState.permission = permission;

  if (permission === "granted") {
    const registration = pushState.registration || (await registerServiceWorker());
    if (registration) {
      await subscribeToPush(registration);
    }
  }

  renderPushBanner();
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function initPush() {
  pushState.supported = isPushSupported();

  if (pushState.supported) {
    const registration = await registerServiceWorker();
    if (registration) {
      // Check for existing subscription
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        pushState.subscription = existing;
        pushState.permission = "granted";
      }
    }
  }

  renderPushBanner();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    __test__: {
      fetchProfiles,
      renderDeck,
      initSwipeEvents,
      getEventPos,
      onDragStart,
      onDragMove,
      onDragEnd,
      cyclePhoto,
      dismissCard,
      resetDeck,
      isPushSupported,
      renderPushBanner,
      registerServiceWorker,
      subscribeToPush,
      requestPushPermission,
      urlBase64ToUint8Array,
      initPush,
      generateProfiles,
      createStampEl,
      getState: () => ({
        profiles,
        isDragging,
        startX,
        startY,
        currentX,
        currentY,
        activeCard,
        actionHistory,
        isAnimating,
        pushState,
      }),
      setProfilesForTest: (nextProfiles) => {
        profiles = nextProfiles;
      },
      setAnimatingForTest: (value) => {
        isAnimating = value;
      },
      resetTapStateForTest: () => {
        lastTapTime = 0;
      },
    },
  };
}

// Boot
if (!(typeof window !== "undefined" && window.__AI_TINDER_DISABLE_AUTO_BOOT__)) {
  resetDeck();
  initPush();
}
