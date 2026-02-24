// app.js
// Plain global JS, no modules.

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

// Generate multiple photos per profile
function getPhotosForProfile() {
  const photoCount = 2 + Math.floor(Math.random() * 3); // 2-4 photos
  const photos = [];
  const usedSeeds = new Set();
  
  for (let i = 0; i < photoCount; i++) {
    let seed;
    do {
      seed = sample(UNSPLASH_SEEDS);
    } while (usedSeeds.has(seed) && usedSeeds.size < UNSPLASH_SEEDS.length);
    usedSeeds.add(seed);
    photos.push(imgFor(seed));
  }
  
  return photos;
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
      photos: getPhotosForProfile(),
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
let currentProfileIndex = 0;
let actionHistory = [];
let animating = false;

// Gesture state
let gestureState = {
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  isDragging: false,
  startTime: 0,
  activeCard: null,
  lastDragTime: 0
};

// Double-tap state
let lastTapTime = 0;
const DOUBLE_TAP_DELAY = 300;

function renderDeck() {
  deckEl.setAttribute("aria-busy", "true");
  deckEl.innerHTML = "";

  profiles.forEach((p, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.profileId = p.id;

    // Photo indicators (dots)
    if (p.photos.length > 1) {
      const indicators = document.createElement("div");
      indicators.className = "photo-indicators";
      p.photos.forEach((_, dotIdx) => {
        const dot = document.createElement("span");
        dot.className = `photo-dot${dotIdx === p.currentPhotoIndex ? ' active' : ''}`;
        indicators.appendChild(dot);
      });
      card.appendChild(indicators);
    }

    const img = document.createElement("img");
    img.className = "card__media";
    img.src = p.photos[p.currentPhotoIndex];
    img.alt = `${p.name} — profile photo ${p.currentPhotoIndex + 1}`;

    // Action overlays for visual feedback
    const likeOverlay = document.createElement("div");
    likeOverlay.className = "action-overlay action-overlay--like";
    likeOverlay.textContent = "LIKE";

    const nopeOverlay = document.createElement("div");
    nopeOverlay.className = "action-overlay action-overlay--nope";
    nopeOverlay.textContent = "NOPE";

    const superOverlay = document.createElement("div");
    superOverlay.className = "action-overlay action-overlay--super";
    superOverlay.textContent = "SUPER LIKE";

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

    card.appendChild(likeOverlay);
    card.appendChild(nopeOverlay);
    card.appendChild(superOverlay);
    card.appendChild(img);
    card.appendChild(body);

    deckEl.appendChild(card);
  });

  updateCardStack();
  attachGestureHandlers();
  deckEl.removeAttribute("aria-busy");
}

function resetDeck() {
  profiles = generateProfiles(12);
  currentProfileIndex = 0;
  actionHistory = [];
  animating = false;
  renderDeck();
}

// -------------------
// Utility functions
// -------------------
function getTopCard() {
  const cards = deckEl.querySelectorAll('.card');
  return cards[currentProfileIndex] || null;
}

function getCurrentProfile() {
  return profiles[currentProfileIndex] || null;
}

function getPointerPosition(e) {
  return {
    x: e.touches ? e.touches[0].clientX : e.clientX,
    y: e.touches ? e.touches[0].clientY : e.clientY
  };
}

function updateCardStack() {
  const cards = deckEl.querySelectorAll('.card');
  cards.forEach((card, idx) => {
    const relativeIdx = idx - currentProfileIndex;
    card.style.zIndex = cards.length - idx;
    
    if (relativeIdx < 0) {
      // Already swiped cards
      card.style.display = 'none';
    } else if (relativeIdx === 0) {
      // Top card - interactive
      card.style.pointerEvents = 'auto';
    } else {
      // Cards in stack - not interactive
      card.style.pointerEvents = 'none';
    }
  });
  
  // Check if deck is empty
  if (currentProfileIndex >= profiles.length) {
    showEndOfDeck();
  }
}

function showEndOfDeck() {
  deckEl.innerHTML = `
    <div class="end-of-deck">
      <div class="end-of-deck__icon">🎉</div>
      <h2>That's everyone!</h2>
      <p>You've seen all profiles.</p>
      <button class="ghost-btn" onclick="resetDeck()">Start Over</button>
    </div>
  `;
}

// -------------------
// Photo navigation (double-tap)
// -------------------
function nextPhoto(card) {
  const profile = getCurrentProfile();
  if (!profile || profile.photos.length <= 1) return;
  
  profile.currentPhotoIndex = (profile.currentPhotoIndex + 1) % profile.photos.length;
  
  // Update image
  const img = card.querySelector('.card__media');
  img.src = profile.photos[profile.currentPhotoIndex];
  img.alt = `${profile.name} — profile photo ${profile.currentPhotoIndex + 1}`;
  
  // Update indicators
  const dots = card.querySelectorAll('.photo-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === profile.currentPhotoIndex);
  });
}

// -------------------
// Gesture handling
// -------------------
function handleGestureStart(e) {
  const card = e.currentTarget;
  const pos = getPointerPosition(e);
  
  gestureState = {
    startX: pos.x,
    startY: pos.y,
    currentX: pos.x,
    currentY: pos.y,
    isDragging: false,
    startTime: Date.now(),
    activeCard: card
  };
  
  card.style.transition = 'none';
}

function handleGestureMove(e) {
  if (!gestureState.activeCard) return;
  
  const pos = getPointerPosition(e);
  gestureState.currentX = pos.x;
  gestureState.currentY = pos.y;
  
  const deltaX = pos.x - gestureState.startX;
  const deltaY = pos.y - gestureState.startY;
  
  // Only start dragging if moved beyond threshold
  if (!gestureState.isDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
    gestureState.isDragging = true;
  }
  
  if (gestureState.isDragging) {
    e.preventDefault();
    
    const card = gestureState.activeCard;
    const rotation = deltaX * 0.03;
    
    card.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
    
    // Show appropriate overlay based on drag direction
    const likeOverlay = card.querySelector('.action-overlay--like');
    const nopeOverlay = card.querySelector('.action-overlay--nope');
    const superOverlay = card.querySelector('.action-overlay--super');
    
    // Determine gesture intent
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    if (isHorizontal) {
      if (deltaX > 50) {
        // Like intent
        likeOverlay.style.opacity = Math.min(deltaX / 120, 1);
        nopeOverlay.style.opacity = 0;
        superOverlay.style.opacity = 0;
      } else if (deltaX < -50) {
        // Nope intent
        nopeOverlay.style.opacity = Math.min(Math.abs(deltaX) / 120, 1);
        likeOverlay.style.opacity = 0;
        superOverlay.style.opacity = 0;
      } else {
        likeOverlay.style.opacity = 0;
        nopeOverlay.style.opacity = 0;
        superOverlay.style.opacity = 0;
      }
    } else if (deltaY < -50) {
      // Super like intent
      superOverlay.style.opacity = Math.min(Math.abs(deltaY) / 120, 1);
      likeOverlay.style.opacity = 0;
      nopeOverlay.style.opacity = 0;
    } else {
      likeOverlay.style.opacity = 0;
      nopeOverlay.style.opacity = 0;
      superOverlay.style.opacity = 0;
    }
  }
}

function handleGestureEnd(e) {
  if (!gestureState.activeCard) return;
  
  const card = gestureState.activeCard;
  const deltaX = gestureState.currentX - gestureState.startX;
  const deltaY = gestureState.currentY - gestureState.startY;
  const timeDelta = Date.now() - gestureState.startTime;
  const velocity = Math.abs(deltaX) / timeDelta;
  
  // Adjust threshold based on velocity
  const threshold = velocity > 0.5 ? 75 : 120;
  
  // Track if we were dragging to prevent immediate click events
  const wasDragging = gestureState.isDragging;
  
  if (gestureState.isDragging) {
    // Determine if swipe was successful
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    
    if (isHorizontal && Math.abs(deltaX) > threshold) {
      // Horizontal swipe
      if (deltaX > 0) {
        handleLike();
      } else {
        handleNope();
      }
    } else if (!isHorizontal && deltaY < -threshold) {
      // Upward swipe
      handleSuperLike();
    } else {
      // Snap back - gesture cancelled
      resetCardPosition(card);
    }
  }
  
  gestureState = {
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    startTime: 0,
    activeCard: null,
    lastDragTime: wasDragging ? Date.now() : gestureState.lastDragTime
  };
}

function resetCardPosition(card) {
  card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  card.style.transform = '';
  
  // Hide overlays
  const overlays = card.querySelectorAll('.action-overlay');
  overlays.forEach(overlay => {
    overlay.style.opacity = 0;
  });
}

function attachGestureHandlers() {
  const topCard = getTopCard();
  if (!topCard) return;
  
  // Touch events
  topCard.addEventListener('touchstart', handleGestureStart, { passive: false });
  topCard.addEventListener('touchmove', handleGestureMove, { passive: false });
  topCard.addEventListener('touchend', handleGestureEnd);
  
  // Mouse events
  topCard.addEventListener('mousedown', handleGestureStart);
  
  // Mouse move and up on document to handle dragging outside card
  const handleDocumentMouseMove = (e) => {
    if (gestureState.activeCard === topCard) {
      handleGestureMove(e);
    }
  };
  
  const handleDocumentMouseUp = (e) => {
    if (gestureState.activeCard === topCard) {
      handleGestureEnd(e);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }
  };
  
  topCard.addEventListener('mousedown', () => {
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  });
  
  // Double-tap for photo navigation
  topCard.addEventListener('click', (e) => {
    const now = Date.now();
    
    // Ignore clicks that immediately follow a drag (within 250ms)
    if (now - gestureState.lastDragTime < 250) return;
    
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      // Double tap detected
      e.preventDefault();
      nextPhoto(topCard);
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  });
}

// -------------------
// Action functions
// -------------------
function animateCardExit(card, direction) {
  return new Promise((resolve) => {
    card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    card.classList.add(`card--exit-${direction}`);
    
    setTimeout(() => {
      card.style.display = 'none';
      resolve();
    }, 400);
  });
}

function handleLike() {
  if (animating) return;
  
  const card = getTopCard();
  const profile = getCurrentProfile();
  if (!card || !profile) return;
  
  animating = true;
  console.log('LIKE:', profile.name);
  actionHistory.push({ type: 'like', profile, timestamp: Date.now() });
  
  animateCardExit(card, 'right').then(() => {
    currentProfileIndex++;
    updateCardStack();
    attachGestureHandlers();
    animating = false;
  });
}

function handleNope() {
  if (animating) return;
  
  const card = getTopCard();
  const profile = getCurrentProfile();
  if (!card || !profile) return;
  
  animating = true;
  console.log('NOPE:', profile.name);
  actionHistory.push({ type: 'nope', profile, timestamp: Date.now() });
  
  animateCardExit(card, 'left').then(() => {
    currentProfileIndex++;
    updateCardStack();
    attachGestureHandlers();
    animating = false;
  });
}

function handleSuperLike() {
  if (animating) return;
  
  const card = getTopCard();
  const profile = getCurrentProfile();
  if (!card || !profile) return;
  
  animating = true;
  console.log('SUPER LIKE:', profile.name);
  actionHistory.push({ type: 'superlike', profile, timestamp: Date.now() });
  
  animateCardExit(card, 'up').then(() => {
    currentProfileIndex++;
    updateCardStack();
    attachGestureHandlers();
    animating = false;
  });
}

// -------------------
// Button controls
// -------------------
likeBtn.addEventListener("click", () => {
  if (getCurrentProfile()) handleLike();
});

nopeBtn.addEventListener("click", () => {
  if (getCurrentProfile()) handleNope();
});

superLikeBtn.addEventListener("click", () => {
  if (getCurrentProfile()) handleSuperLike();
});

shuffleBtn.addEventListener("click", resetDeck);

// -------------------
// Keyboard support (accessibility)
// -------------------
document.addEventListener('keydown', (e) => {
  // Ignore repeated keydown events when key is held
  if (e.repeat) return;
  if (!getCurrentProfile()) return;
  
  switch(e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      handleNope();
      break;
    case 'ArrowRight':
      e.preventDefault();
      handleLike();
      break;
    case 'ArrowUp':
      e.preventDefault();
      handleSuperLike();
      break;
    case ' ':
      e.preventDefault();
      const topCard = getTopCard();
      if (topCard) nextPhoto(topCard);
      break;
  }
});

// Boot
resetDeck();
