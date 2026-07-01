const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const swapBtn = document.getElementById("swapBtn");
const panel = document.getElementById("gamePanel");
const resultText = document.getElementById("resultText");
const restartBtn = document.getElementById("restartBtn");

const ballTypes = [
  { id: "ball1", src: "assets/balls/ball3_0_1.png", color: "#34495e" },
  { id: "ball2", src: "assets/balls/ball3_0_2.png", color: "#6f5f99" },
  { id: "ball3", src: "assets/balls/ball3_0_3.png", color: "#f0b184" },
  { id: "ball4", src: "assets/balls/ball3_0_4.png", color: "#b88b45" },
  { id: "ball5", src: "assets/balls/ball3_0_5.png", color: "#c45b42" },
  { id: "ball6", src: "assets/balls/ball3_0_6.png", color: "#9a83e6" },
  { id: "ball7", src: "assets/balls/ball3_0_7.png", color: "#7f96c8" },
  { id: "ball8", src: "assets/balls/ball3_0_8.png", color: "#e7a061" },
  { id: "ball9", src: "assets/balls/ball3_0_9.png", color: "#e96b7d" },
  { id: "ball10", src: "assets/balls/ball3_0_10.png", color: "#efc84b" },
  { id: "ball11", src: "assets/balls/ball3_0_11.png", color: "#9b78a8" }
];
const ballImages = new Map();
let width = 0;
let height = 0;
let path = [];
let pathLength = 0;
let beads = [];
let bullets = [];
let particles = [];
let beadRadius = 14;
let spacing = 30;
let speed = 20;
let score = 0;
let gameState = "playing";
let lastTime = 0;
let chainPull = null;

const cannon = {
  x: 0,
  y: 0,
  angle: -Math.PI / 2,
  current: randomBallType(),
  next: randomBallType()
};

function loadBallImages() {
  for (const type of ballTypes) {
    const image = new Image();
    image.src = type.src;
    ballImages.set(type.id, image);
  }
}

function randomBallType() {
  return ballTypes[Math.floor(Math.random() * ballTypes.length)].id;
}

function getBallType(id) {
  return ballTypes.find(type => type.id === id) || ballTypes[0];
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  beadRadius = Math.max(10, Math.min(17, width * 0.034));
  spacing = beadRadius * 2.08;
  speed = Math.max(16, Math.min(26, height * 0.025));
  cannon.x = width / 2;
  cannon.y = height - Math.max(54, height * 0.09);
  buildPath();
}

function buildPath() {
  const points = [
    { x: 0.1, y: 0.14 },
    { x: 0.88, y: 0.14 },
    { x: 0.88, y: 0.32 },
    { x: 0.14, y: 0.32 },
    { x: 0.14, y: 0.5 },
    { x: 0.8, y: 0.5 },
    { x: 0.8, y: 0.69 },
    { x: 0.48, y: 0.69 }
  ].map(point => ({ x: point.x * width, y: point.y * height }));

  path = [];
  pathLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    path.push({ a, b, start: pathLength, len });
    pathLength += len;
  }
}

function init() {
  beads = [];
  bullets = [];
  particles = [];
  chainPull = null;
  score = 0;
  gameState = "playing";
  cannon.current = randomBallType();
  cannon.next = randomBallType();
  panel.classList.add("hidden");

  for (let i = 0; i < 30; i++) {
    beads.push({
      color: randomBallType(),
      distance: -i * spacing,
      radius: beadRadius
    });
  }
  updateScore();
}

function pointAtDistance(distance) {
  const d = Math.max(0, Math.min(pathLength, distance));
  for (const segment of path) {
    if (d <= segment.start + segment.len) {
      const t = (d - segment.start) / segment.len;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t
      };
    }
  }
  return path[path.length - 1].b;
}

function update(dt) {
  if (gameState !== "playing") {
    updateParticles(dt);
    return;
  }
  updateBeads(dt);
  updateBullets(dt);
  updateParticles(dt);
  checkWinLose();
}

function updateBeads(dt) {
  normalizeBeads();
  if (!beads.length) return;

  if (updateChainPull(dt)) return;

  const contacts = [];
  const tail = beads.length - 1;
  beads[tail].distance += speed * dt;

  for (let i = tail - 1; i >= 0; i--) {
    const gap = beads[i].distance - beads[i + 1].distance;
    if (gap <= spacing) {
      beads[i].distance = beads[i + 1].distance + spacing;
      contacts.push(i);
    }
  }

  normalizeBeads();

  for (const index of contacts) {
    if (beads[index] && beads[index + 1] && beads[index].color === beads[index + 1].color) {
      resolveMatches(index, 2);
      break;
    }
  }
}

function updateChainPull(dt) {
  if (!chainPull) return false;

  const { frontIndex, backIndex, chainLevel } = chainPull;
  const front = beads[frontIndex];
  const back = beads[backIndex];

  if (!front || !back || front.color !== back.color) {
    chainPull = null;
    return false;
  }

  const targetDistance = back.distance + spacing;
  const gap = front.distance - targetDistance;

  if (gap <= 0.5) {
    front.distance = targetDistance;
    normalizeBeads();
    chainPull = null;
    resolveMatches(frontIndex, chainLevel);
    return true;
  }

  const pullSpeed = speed * 4.5;
  const shift = Math.min(gap, pullSpeed * dt);
  for (let i = 0; i <= frontIndex; i++) {
    beads[i].distance -= shift;
  }

  return true;
}

function normalizeBeads() {
  beads.sort((a, b) => b.distance - a.distance);
  for (let i = 1; i < beads.length; i++) {
    beads[i].distance = Math.min(beads[i].distance, beads[i - 1].distance - spacing);
  }
}

function shoot() {
  if (gameState !== "playing") return;
  const power = Math.max(width, height) * 0.72;
  bullets.push({
    x: cannon.x,
    y: cannon.y,
    vx: Math.cos(cannon.angle) * power,
    vy: Math.sin(cannon.angle) * power,
    color: cannon.current,
    radius: beadRadius,
    active: true
  });
  cannon.current = cannon.next;
  cannon.next = randomBallType();
}

function swapBall() {
  [cannon.current, cannon.next] = [cannon.next, cannon.current];
}

function updateBullets(dt) {
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    if (bullet.x < -80 || bullet.x > width + 80 || bullet.y < -80 || bullet.y > height + 80) {
      bullet.active = false;
      continue;
    }

    const hitIndex = findHitBead(bullet);
    if (hitIndex >= 0) {
      insertBullet(bullet, hitIndex);
      bullet.active = false;
    }
  }
  bullets = bullets.filter(bullet => bullet.active);
}

function findHitBead(bullet) {
  for (let i = 0; i < beads.length; i++) {
    if (beads[i].distance < 0) continue;
    const point = pointAtDistance(beads[i].distance);
    const distance = Math.hypot(bullet.x - point.x, bullet.y - point.y);
    if (distance < bullet.radius + beads[i].radius) return i;
  }
  return -1;
}

function insertBullet(bullet, hitIndex) {
  const target = beads[hitIndex];
  const insertIndex = hitIndex + 1;
  beads.splice(insertIndex, 0, {
    color: bullet.color,
    distance: target.distance - spacing,
    radius: beadRadius
  });
  normalizeBeads();
  resolveMatches(insertIndex, 1);
}

function resolveMatches(index, chainLevel) {
  if (!beads[index]) return;
  const color = beads[index].color;
  let left = index;
  let right = index;

  while (left > 0 && beads[left - 1].color === color) left--;
  while (right < beads.length - 1 && beads[right + 1].color === color) right++;

  const count = right - left + 1;
  if (count < 3) return;

  const center = Math.floor((left + right) / 2);
  const centerPoint = pointAtDistance(beads[center].distance);
  let removeLeft = left;
  let removeRight = right;

  if (count >= 4) {
    const range = beadRadius * 4.4;
    for (let i = 0; i < beads.length; i++) {
      const point = pointAtDistance(beads[i].distance);
      if (Math.hypot(point.x - centerPoint.x, point.y - centerPoint.y) < range) {
        removeLeft = Math.min(removeLeft, i);
        removeRight = Math.max(removeRight, i);
      }
    }
  }

  const removed = removeRight - removeLeft + 1;
  createParticles(centerPoint.x, centerPoint.y, color, count >= 4 ? 30 : 18);
  beads.splice(removeLeft, removed);
  score += removed * 10 * chainLevel;
  updateScore();
  normalizeBeads();
  startChainPull(removeLeft, chainLevel + 1);

  if (!chainPull) {
    setTimeout(() => {
      const nextIndex = Math.max(0, removeLeft - 1);
      if (gameState === "playing" && beads[nextIndex]) resolveMatches(nextIndex, chainLevel + 1);
    }, 130);
  }
}

function startChainPull(gapIndex, chainLevel) {
  const frontIndex = gapIndex - 1;
  const backIndex = gapIndex;

  if (
    frontIndex >= 0 &&
    backIndex < beads.length &&
    beads[frontIndex].color === beads[backIndex].color &&
    beads[frontIndex].distance - beads[backIndex].distance > spacing + 0.5
  ) {
    chainPull = { frontIndex, backIndex, chainLevel };
  } else {
    chainPull = null;
  }
}

function createParticles(x, y, color, count) {
  const particleColor = getBallType(color).color;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const burst = 70 + Math.random() * 170;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * burst,
      vy: Math.sin(angle) * burst,
      size: 2 + Math.random() * 3,
      life: 0.48,
      maxLife: 0.48,
      color: particleColor
    });
  }
}

function updateParticles(dt) {
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 220 * dt;
    particle.life -= dt;
  }
  particles = particles.filter(particle => particle.life > 0);
}

function checkWinLose() {
  if (beads.some(bead => bead.distance >= pathLength)) endGame(false);
  if (beads.length === 0) endGame(true);
}

function endGame(win) {
  gameState = win ? "win" : "lose";
  resultText.textContent = win ? "通关成功" : "闯关失败";
  panel.classList.remove("hidden");
}

function updateScore() {
  scoreEl.textContent = score;
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  drawPath();
  drawBeads();
  drawBullets();
  drawCannon();
  drawParticles();
}

function drawPath() {
  if (!path.length) return;
  ctx.lineWidth = beadRadius * 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#d2bd83";
  ctx.beginPath();
  ctx.moveTo(path[0].a.x, path[0].a.y);
  for (const segment of path) ctx.lineTo(segment.b.x, segment.b.y);
  ctx.stroke();

  ctx.lineWidth = beadRadius * 0.38;
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.stroke();

  const end = path[path.length - 1].b;
  ctx.fillStyle = "#3b302a";
  ctx.beginPath();
  ctx.arc(end.x, end.y, beadRadius * 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawBeads() {
  for (const bead of beads) {
    if (bead.distance < 0) continue;
    const point = pointAtDistance(bead.distance);
    drawBall(point.x, point.y, bead.radius, bead.color);
  }
}

function drawBullets() {
  for (const bullet of bullets) drawBall(bullet.x, bullet.y, bullet.radius, bullet.color);
}

function drawCannon() {
  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.rotate(cannon.angle);
  ctx.fillStyle = "#56514a";
  ctx.fillRect(0, -7, beadRadius * 3.2, 14);
  ctx.restore();

  drawBall(cannon.x, cannon.y, beadRadius * 1.14, cannon.current);
  drawBall(cannon.x + beadRadius * 3.2, cannon.y + beadRadius * 2.1, beadRadius * 0.76, cannon.next);
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBall(x, y, radius, ballId) {
  const type = getBallType(ballId);
  const image = ballImages.get(ballId);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();

  if (image && image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = type.color;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(46,34,25,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function aimAt(x, y) {
  cannon.angle = Math.atan2(y - cannon.y, x - cannon.x);
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener("pointermove", event => {
  aimAt(event.clientX, event.clientY);
});

canvas.addEventListener("pointerdown", event => {
  aimAt(event.clientX, event.clientY);
  shoot();
});

swapBtn.addEventListener("pointerdown", event => {
  event.stopPropagation();
  swapBall();
});

restartBtn.addEventListener("click", init);
window.addEventListener("resize", resize);

loadBallImages();
resize();
init();
requestAnimationFrame(loop);
