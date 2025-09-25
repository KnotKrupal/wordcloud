const { WORD_BANK } = window;

if (!Array.isArray(WORD_BANK) || WORD_BANK.length === 0) {
  throw new Error("WORD_BANK is missing or empty. Ensure words.js is loaded before script.js.");
}

const hero = document.querySelector(".hero");
const wordField = document.getElementById("word-cloud");
const refreshButton = document.querySelector(".hero__refresh");

const CONFIG = {
  wordCount: 70,
  minFont: 14,
  maxFont: 28,
  padding: 60,
  repelRadius: 170,
  repelForce: 0.9,
  drift: 0.12,
  friction: 0.92,
  logoSafeRadius: 150,
  inactivityDelay: 6500,
  orbitSpeedMin: 0.0007,
  orbitSpeedMax: 0.0016,
  wordSpacing: 16,
};

let fieldWidth = wordField.clientWidth || window.innerWidth;
let fieldHeight = wordField.clientHeight || window.innerHeight;
let words = [];
let lastFrameTime = performance.now();
let inactivityTimer = null;
let orbiting = false;
let scrollScale = 1;
let scrollOpacity = 1;

const pointer = {
  x: fieldWidth / 2,
  y: fieldHeight / 2,
  active: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getFieldCenter() {
  return { x: fieldWidth / 2, y: fieldHeight / 2 };
}

function registerActivity() {
  if (orbiting) {
    stopOrbit();
  }
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  inactivityTimer = setTimeout(startOrbit, CONFIG.inactivityDelay);
}

function startOrbit() {
  orbiting = true;
  const center = getFieldCenter();
  words.forEach((word, index) => {
    word.orbiting = true;
    word.angle = Math.atan2(word.y - center.y, word.x - center.x);
    const baselineRadius = Math.max(
      CONFIG.logoSafeRadius + 60,
      Math.hypot(word.x - center.x, word.y - center.y)
    );
    word.orbitRadius = baselineRadius + (index % 5) * 16 + Math.random() * 18;
    word.orbitSpeed = randomBetween(CONFIG.orbitSpeedMin, CONFIG.orbitSpeedMax);
  });
}

function stopOrbit() {
  orbiting = false;
  words.forEach((word) => {
    word.orbiting = false;
    word.vx = 0;
    word.vy = 0;
  });
}

function rectanglesIntersect(x, y, width, height, other) {
  const spacing = CONFIG.wordSpacing;
  const overlapX =
    Math.abs(other.x - x) < (other.width + width) / 2 + spacing;
  const overlapY =
    Math.abs(other.y - y) < (other.height + height) / 2 + spacing;
  return overlapX && overlapY;
}

function findPosition(width, height) {
  const { x: centerX, y: centerY } = getFieldCenter();
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const minX = CONFIG.padding + halfWidth;
  const maxX = fieldWidth - CONFIG.padding - halfWidth;
  const minY = CONFIG.padding + halfHeight;
  const maxY = fieldHeight - CONFIG.padding - halfHeight;

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const x = randomBetween(minX, maxX);
    const y = randomBetween(minY, maxY);

    if (
      Math.hypot(x - centerX, y - centerY) <
      CONFIG.logoSafeRadius + Math.max(halfWidth, halfHeight)
    ) {
      continue;
    }

    const intersects = words.some((existing) =>
      rectanglesIntersect(x, y, width, height, existing)
    );

    if (!intersects) {
      return { x, y };
    }
  }

  return {
    x: randomBetween(minX, maxX),
    y: randomBetween(minY, maxY),
  };
}

function createWords() {
  words.forEach((word) => word.el.remove());
  words = [];

  const selection = shuffle(WORD_BANK).slice(0, CONFIG.wordCount);
  const { x: centerX, y: centerY } = getFieldCenter();

  selection.forEach((text) => {
    const fontSize = randomBetween(CONFIG.minFont, CONFIG.maxFont);
    const el = document.createElement("span");
    el.className = "word";
    el.textContent = text;
    el.style.fontSize = `${fontSize}px`;
    el.style.opacity = "0";
    wordField.appendChild(el);

    const rect = el.getBoundingClientRect();
    const { width, height } = rect;
    const position = findPosition(width, height);

    const word = {
      el,
      x: position.x,
      y: position.y,
      width,
      height,
      vx: randomBetween(-0.5, 0.5),
      vy: randomBetween(-0.5, 0.5),
      baseFont: fontSize,
      scale: 1,
      opacity: 1,
      orbiting: false,
      orbitRadius: Math.hypot(position.x - centerX, position.y - centerY),
      orbitSpeed: randomBetween(CONFIG.orbitSpeedMin, CONFIG.orbitSpeedMax),
      angle: randomBetween(0, Math.PI * 2),
      wobbleOffset: Math.random() * Math.PI * 2,
    };

    el.style.left = `${word.x}px`;
    el.style.top = `${word.y}px`;
    el.style.opacity = "1";
    el.addEventListener("mouseenter", registerActivity);
    el.addEventListener("pointerdown", registerActivity);
    el.addEventListener("touchstart", registerActivity, { passive: true });

    words.push(word);
  });

  registerActivity();
}

function updatePointer(event) {
  const rect = wordField.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.active = true;
}

function handleMouseMove(event) {
  updatePointer(event);
  registerActivity();
}

function handleMouseLeave() {
  pointer.active = false;
}

function applyScrollEffect() {
  const heroHeight = hero.offsetHeight || window.innerHeight;
  const progress = clamp(window.scrollY / heroHeight, 0, 1.2);
  scrollScale = clamp(1 - progress * 0.55, 0.25, 1);
  scrollOpacity = clamp(1 - progress * 0.7, 0.1, 1);
  if (orbiting) {
    stopOrbit();
  }
  registerActivity();
}

function handleResize() {
  const previousWidth = fieldWidth;
  const previousHeight = fieldHeight;
  fieldWidth = wordField.clientWidth || window.innerWidth;
  fieldHeight = wordField.clientHeight || window.innerHeight;
  const scaleX = fieldWidth / previousWidth;
  const scaleY = fieldHeight / previousHeight;

  words.forEach((word) => {
    word.x *= scaleX;
    word.y *= scaleY;
  });
}

function applyRepulsion(word, dt) {
  if (!pointer.active) {
    return;
  }
  const dx = word.x - pointer.x;
  const dy = word.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance > CONFIG.repelRadius) {
    return;
  }
  const force = ((CONFIG.repelRadius - distance) / CONFIG.repelRadius) * CONFIG.repelForce;
  const normalX = dx / distance;
  const normalY = dy / distance;
  word.vx += normalX * force * dt;
  word.vy += normalY * force * dt;
}

function constrainWord(word) {
  const halfWidth = word.width / 2;
  const halfHeight = word.height / 2;
  const minX = CONFIG.padding + halfWidth;
  const maxX = fieldWidth - CONFIG.padding - halfWidth;
  const minY = CONFIG.padding + halfHeight;
  const maxY = fieldHeight - CONFIG.padding - halfHeight;

  if (word.x < minX) {
    word.x = minX;
    word.vx *= -0.4;
  } else if (word.x > maxX) {
    word.x = maxX;
    word.vx *= -0.4;
  }

  if (word.y < minY) {
    word.y = minY;
    word.vy *= -0.4;
  } else if (word.y > maxY) {
    word.y = maxY;
    word.vy *= -0.4;
  }
}

function renderWord(word) {
  const driftScale = word.orbiting ? 1 : 1 + Math.sin(performance.now() / 1200 + word.wobbleOffset) * 0.03;
  const scale = clamp(word.scale * driftScale * scrollScale, 0.15, 1.6);
  word.el.style.left = `${word.x}px`;
  word.el.style.top = `${word.y}px`;
  word.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  word.el.style.opacity = (scrollOpacity * word.opacity).toFixed(3);
}

function tick(timestamp) {
  const delta = timestamp - lastFrameTime;
  const dt = clamp(delta / 16.6667, 0.2, 3);
  const center = getFieldCenter();

  words.forEach((word) => {
    if (word.orbiting) {
      word.angle += word.orbitSpeed * dt;
      const wobble = Math.sin(timestamp / 1400 + word.wobbleOffset) * 10;
      word.x = center.x + Math.cos(word.angle) * (word.orbitRadius + wobble);
      word.y = center.y + Math.sin(word.angle) * (word.orbitRadius + wobble);
    } else {
      applyRepulsion(word, dt);
      word.vx += (Math.random() - 0.5) * CONFIG.drift * dt;
      word.vy += (Math.random() - 0.5) * CONFIG.drift * dt;
      word.vx *= CONFIG.friction;
      word.vy *= CONFIG.friction;
      word.x += word.vx * dt;
      word.y += word.vy * dt;
      constrainWord(word);
    }
    renderWord(word);
  });

  lastFrameTime = timestamp;
  requestAnimationFrame(tick);
}

function init() {
  createWords();
  applyScrollEffect();
  requestAnimationFrame((time) => {
    lastFrameTime = time;
    requestAnimationFrame(tick);
  });
  registerActivity();
}

hero.addEventListener("mousemove", handleMouseMove);
hero.addEventListener("mouseleave", handleMouseLeave);
refreshButton.addEventListener("click", () => {
  createWords();
  registerActivity();
});
window.addEventListener("scroll", applyScrollEffect, { passive: true });
window.addEventListener("resize", handleResize);
window.addEventListener("touchmove", (event) => {
  if (event.touches.length > 0) {
    updatePointer(event.touches[0]);
    registerActivity();
  }
});
window.addEventListener("touchend", () => {
  pointer.active = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  } else {
    registerActivity();
  }
});

init();
