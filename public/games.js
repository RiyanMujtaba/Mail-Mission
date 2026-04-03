// ── games.js — Mail Mission Arcade ─────────────────────────────
let currentGame = null;

const G = '#39ff14', W = '#c8f0c8', R = '#ff3c3c', A = '#ffb300';

// ── Persistent high score helpers ────────────────────────────────
const getHS  = k       => parseInt(localStorage.getItem(k) || '0', 10);
const saveHS = (k, v)  => { if (v > getHS(k)) localStorage.setItem(k, v); };
const today  = ()      => new Date().toISOString().slice(0, 10);

function initGame(name, canvas) {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  const ctx = canvas.getContext('2d');
  if (name === 'goat')  currentGame = new GoatRunner(canvas, ctx);
  if (name === 'space') currentGame = new SpaceBlaster(canvas, ctx);
  if (name === 'pong')  currentGame = new Pong(canvas, ctx);
  if (name === 'snake') currentGame = new Snake(canvas, ctx);
  currentGame?.start();
  setupPad(name);
}

function stopGame() {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  const pad = document.getElementById('game-controls');
  if (pad) pad.innerHTML = '';
}

// ── Mobile virtual gamepad ──────────────────────────────────────
function setupPad(name) {
  const pad = document.getElementById('game-controls');
  if (!pad) return;
  pad.innerHTML = '';

  if (name === 'goat') {
    pad.innerHTML = `<button class="pb pb-wide" data-a="jump">▲  JUMP</button>`;
  }
  if (name === 'space') {
    pad.innerHTML = `
      <div class="pb-row">
        <button class="pb" data-a="left">◀</button>
        <button class="pb" data-a="thrust">▲ THRUST</button>
        <button class="pb" data-a="right">▶</button>
      </div>
      <button class="pb pb-wide pb-shoot" data-a="shoot">🔥 SHOOT</button>`;
  }
  if (name === 'pong') {
    pad.innerHTML = `
      <div class="pb-row">
        <button class="pb pb-tall" data-a="up">▲  UP</button>
        <button class="pb pb-tall" data-a="serve">SERVE</button>
        <button class="pb pb-tall" data-a="down">▼  DOWN</button>
      </div>`;
  }
  if (name === 'snake') {
    pad.innerHTML = `
      <div class="pb-dpad">
        <button class="pb dpad-up"  data-a="up">▲</button>
        <button class="pb dpad-lft" data-a="left">◀</button>
        <div class="dpad-mid"></div>
        <button class="pb dpad-rgt" data-a="right">▶</button>
        <button class="pb dpad-dn"  data-a="down">▼</button>
      </div>`;
  }

  pad.querySelectorAll('.pb').forEach(btn => {
    const a = btn.dataset.a;
    const press   = e => { e.preventDefault(); padPress(a); };
    const release = e => { e.preventDefault(); padRelease(a); };
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown',   press);
    btn.addEventListener('mouseup',     release);
    btn.addEventListener('mouseleave',  release);
  });
}

function padPress(a) {
  const g = currentGame;
  if (!g) return;
  if (a === 'jump')   { g.jump?.(); return; }
  if (a === 'shoot')  { g.keys.ShootHeld = true; g.shoot?.(); return; }
  if (a === 'serve')  { g.keys.Space = true; g.spaceAction?.(); return; }
  if (a === 'thrust') { g.keys.ArrowUp    = true; return; }
  if (a === 'left')   { g.keys.ArrowLeft  = true; g.touchDir?.('ArrowLeft');  return; }
  if (a === 'right')  { g.keys.ArrowRight = true; g.touchDir?.('ArrowRight'); return; }
  if (a === 'up')     { g.keys.ArrowUp    = true; g.touchDir?.('ArrowUp');    return; }
  if (a === 'down')   { g.keys.ArrowDown  = true; g.touchDir?.('ArrowDown');  return; }
}
function padRelease(a) {
  const g = currentGame;
  if (!g) return;
  const map = { shoot:'ShootHeld', thrust:'ArrowUp', left:'ArrowLeft', right:'ArrowRight',
                up:'ArrowUp', down:'ArrowDown', serve:'Space' };
  if (map[a]) delete g.keys[map[a]];
}

// ── Phase / milestone announcement helper ────────────────────────
function mkAnnounce(text, color = R) { return { text, color, t: 180 }; }

// ════════════════════════════════════════════════════════════════
// 🐐  GOAT RUNNER
// ════════════════════════════════════════════════════════════════
class GoatRunner {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx;
    canvas.width = 600; canvas.height = 200;
    this.keys = {};
    this._onKey   = e => { if (e.code === 'Space') { e.preventDefault(); this.jump(); } };
    this._onClick = () => this.jump();
    window.addEventListener('keydown', this._onKey);
    canvas.addEventListener('click', this._onClick);
    this.reset();
  }

  reset() {
    this.goatY = 138; this.vy = 0; this.ground = 138;
    this.obstacles = []; this.chickens = []; this.score = 0; this.speed = 4;
    this.dead = false; this.won = false; this.frame = 0; this.nextObs = 90;
    this.nextChicken = 999; this.phase = 1; this.announce = null;
    this.winScore = 700 + Math.floor(Math.random() * 500);
    this._hsSaved = false;
  }

  get displayScore() { return Math.floor(this.score / 5); }

  jump() {
    if (this.dead || this.won) { this.reset(); return; }
    if (this.goatY >= this.ground - 1) this.vy = -13;
  }

  start() { this.raf = requestAnimationFrame(() => this.loop()); }

  loop() {
    if (!this.dead && !this.won) {
      this.frame++; this.score++;
      const ds = this.displayScore;

      // Check win
      if (ds >= this.winScore) { this.won = true; }

      // Phase progression
      const newPhase = ds < 300 ? 1 : ds < 600 ? 2 : 3;
      if (newPhase !== this.phase) {
        this.phase = newPhase;
        const msgs = ['', '', '⚡ PHASE 2 — IT\'S GETTING REAL', '🔥 PHASE 3 — FULL SEND'];
        this.announce = mkAnnounce(msgs[this.phase] || 'PHASE UP!', this.phase === 3 ? R : A);
        // Trigger first chicken quickly when entering phase 2+
        if (this.phase >= 2) this.nextChicken = 35;
      }

      this.speed = 4 + this.score / 600 + (this.phase - 1) * 0.8;
      this.vy += 0.65; this.goatY += this.vy;
      if (this.goatY >= this.ground) { this.goatY = this.ground; this.vy = 0; }

      // Spawn obstacles
      if (--this.nextObs <= 0) {
        const extraH = this.phase === 2 ? 14 : this.phase === 3 ? 26 : 0;
        this.obstacles.push({ x: 600, w: 16 + Math.random()*14, h: 28 + Math.random()*22 + extraH });
        if (this.phase === 3 && Math.random() < 0.35) {
          this.obstacles.push({ x: 660, w: 13 + Math.random()*10, h: 24 + Math.random()*18 + extraH * 0.7 });
        }
        const gapBase = this.phase === 1 ? 70 : this.phase === 2 ? 58 : 48;
        this.nextObs = gapBase + Math.random() * 55;
      }

      // Spawn chickens in phase 2+
      if (this.phase >= 2 && --this.nextChicken <= 0) {
        // y 80-105: safe on ground, dangerous mid-jump — just like dino pterodactyls
        const flyY = 80 + Math.random() * 25;
        this.chickens.push({ x: 615, y: flyY, flap: 0 });
        this.nextChicken = 75 + Math.random() * 85; // more frequent
      }

      this.obstacles.forEach(o => o.x -= this.speed);
      this.obstacles = this.obstacles.filter(o => o.x > -40);

      this.chickens.forEach(ch => { ch.x -= this.speed * 0.9; ch.flap++; });
      this.chickens = this.chickens.filter(ch => ch.x > -50);

      // Obstacle collision — tight inner-body hitbox only
      const goatLeft = 57, goatRight = 67;   // narrow: core torso only
      const goatBottom = this.goatY + 18;    // don't count legs/head fringe
      const obsBaseline = this.ground + 36;
      for (const o of this.obstacles) {
        if (o.x < goatRight && o.x + o.w > goatLeft && goatBottom > obsBaseline - o.h) {
          this.dead = true; break;
        }
      }

      // Chicken collision (similarly tight)
      if (!this.dead) {
        const goatTop = this.goatY + 6;
        for (const ch of this.chickens) {
          // Chicken body is roughly the middle 22px wide, 14px tall of the emoji
          if (ch.x + 5 < goatRight && ch.x + 23 > goatLeft &&
              goatTop < ch.y + 18 && goatBottom > ch.y + 6) {
            this.dead = true; break;
          }
        }
      }

      // Save high score on death or win
      if ((this.dead || this.won) && !this._hsSaved) {
        saveHS('mm_goat_hs', this.displayScore);
        this._hsSaved = true;
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { ctx: c, canvas: cv } = this;
    const bgColor  = this.phase === 3 ? '#0a0010' : '#000';
    const gndColor = this.phase === 2 ? '#2a1500' : this.phase === 3 ? '#1a0020' : '#001a00';
    c.fillStyle = bgColor; c.fillRect(0, 0, cv.width, cv.height);

    // Stars in phase 3
    if (this.phase >= 3) {
      c.fillStyle = 'rgba(200,240,200,0.3)';
      for (let i = 0; i < 20; i++) c.fillRect((i * 83 + 17) % cv.width, (i * 59) % (this.ground - 10), 1, 1);
    }

    // Ground
    c.fillStyle = gndColor; c.fillRect(0, this.ground + 36, cv.width, cv.height);
    c.fillStyle = G; c.fillRect(0, this.ground + 36, cv.width, 2);

    // Chickens (phase 2+)
    this.chickens.forEach(ch => {
      c.font = '28px serif';
      const flapOff = Math.floor(ch.flap / 7) % 2 === 0 ? 0 : -4;
      c.fillText('🐔', ch.x, ch.y + 24 + flapOff);
    });

    // Goat
    const goatBob = this.goatY >= this.ground && this.frame % 10 < 5 ? 2 : 0;
    c.font = '34px serif';
    c.save();
    c.translate(44 + 34, this.goatY + 34 + goatBob);
    c.scale(-1, 1);
    c.fillText('🐐', -34, 0);
    c.restore();

    // Obstacles
    const obsColor = this.phase === 3 ? '#cc44ff' : A;
    c.fillStyle = obsColor;
    this.obstacles.forEach(o => c.fillRect(o.x, this.ground + 36 - o.h, o.w, o.h));

    // HUD
    c.fillStyle = G; c.font = '12px "Press Start 2P",monospace';
    c.fillText(`SCORE: ${this.displayScore}`, 10, 22);
    const goatHS = getHS('mm_goat_hs');
    if (goatHS > 0) {
      c.fillStyle = 'rgba(200,240,200,0.45)'; c.font = '7px "Press Start 2P",monospace';
      c.fillText(`BEST: ${goatHS}`, 10, 36);
    }
    if (this.phase > 1) {
      c.fillStyle = this.phase === 3 ? '#cc44ff' : A;
      c.font = '8px "Press Start 2P",monospace';
      c.fillText(`PHASE ${this.phase}`, cv.width - 78, 22);
    }

    if (this.won) {
      c.fillStyle = G; c.font = '18px "Press Start 2P",monospace'; c.textAlign = 'center';
      c.fillText('YOU WIN! 🎉', cv.width / 2, 60);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText(`FINAL SCORE: ${this.displayScore}`, cv.width / 2, 86);
      c.fillStyle = A;
      c.fillText('THE GOAT IS RETIRED 🐐', cv.width / 2, 108);
      c.fillStyle = 'rgba(200,240,200,0.6)';
      c.fillText('TAP OR SPACE TO RUN AGAIN', cv.width / 2, 132);
      c.textAlign = 'left';
    } else if (this.dead) {
      c.fillStyle = R; c.font = '20px "Press Start 2P",monospace'; c.textAlign = 'center';
      c.fillText('GAME OVER', cv.width / 2, 66);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText(`SCORE: ${this.displayScore}`, cv.width / 2, 88);
      const hs = getHS('mm_goat_hs');
      c.fillStyle = this.displayScore >= hs ? A : 'rgba(200,240,200,0.5)';
      c.fillText(this.displayScore >= hs ? `NEW BEST: ${hs}! 🏆` : `BEST: ${hs}`, cv.width / 2, 106);
      c.fillStyle = 'rgba(200,240,200,0.6)';
      c.fillText('TAP OR SPACE TO RESTART', cv.width / 2, 124);
      c.textAlign = 'left';
    } else if (this.frame < 120) {
      c.fillStyle = 'rgba(200,240,200,0.5)'; c.font = '9px "Press Start 2P",monospace';
      c.textAlign = 'center';
      c.fillText('SPACE / TAP TO JUMP', cv.width / 2, cv.height - 8);
      c.textAlign = 'left';
    }

    this._drawAnnounce(c, cv);
  }

  _drawAnnounce(c, cv) {
    if (!this.announce || this.announce.t <= 0) return;
    const alpha = Math.min(1, this.announce.t / 40) * Math.min(1, this.announce.t / 40);
    c.globalAlpha = alpha;
    c.fillStyle = this.announce.color;
    c.font = '11px "Press Start 2P",monospace';
    c.textAlign = 'center';
    c.fillText(this.announce.text, cv.width / 2, cv.height / 2 - 10);
    c.textAlign = 'left';
    c.globalAlpha = 1;
    this.announce.t--;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKey);
    this.canvas.removeEventListener('click', this._onClick);
  }
}

// ════════════════════════════════════════════════════════════════
// 🚀  SPACE BLASTER
// ════════════════════════════════════════════════════════════════
class SpaceBlaster {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx;
    canvas.width = 600; canvas.height = 420;
    this.keys = {};
    this._onKey   = e => { this.keys[e.code] = true;  if (e.code === 'Space') { e.preventDefault(); this.shoot(); } };
    this._onKeyUp = e => { delete this.keys[e.code]; };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup',   this._onKeyUp);
    this._initBackground();
    this.reset();
  }

  _initBackground() {
    const W = 600, H = 420;
    this.stars = Array.from({ length: 90 }, (_, i) => ({
      x:  (i * 137 + 50)  % W,
      y:  (i * 97  + 30)  % H,
      r:  i % 7 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1,
      br: 0.15 + (i % 5) * 0.07,
      tw: (i * 0.8) % (Math.PI * 2)
    }));
    this.planets = [
      { x: 68,  y: 320, r: 32, col: '#b05020', hi: '#e08050', rings: true,  ringAngle: -0.3 },
      { x: 530, y: 80,  r: 20, col: '#2050a0', hi: '#5090e0', rings: false },
      { x: 290, y: 390, r: 13, col: '#803020', hi: '#c06040', rings: false },
    ];
  }

  reset() {
    this.ship = { x: 300, y: 210, angle: -Math.PI / 2, vx: 0, vy: 0 };
    this.bullets = []; this.asteroids = []; this.score = 0; this.lives = 3;
    this.dead = false; this.won = false; this.inv = 0; this.frame = 0; this.shootCooldown = 0;
    this.wave = 1; this.announce = null;
    // Random win score — different every session
    this.winScore = 900 + Math.floor(Math.random() * 700);
    for (let i = 0; i < 4; i++) this.spawnAsteroid(true); // start with 4 (easier)
  }

  get speedMult() { return this.wave === 1 ? 1 : this.wave === 2 ? 1.2 : 1.5; } // slower waves

  spawnAsteroid(init = false) {
    const W = this.canvas.width, H = this.canvas.height;
    let x, y;
    if (init) { x = Math.random() * W; y = Math.random() * H; }
    else {
      const side = Math.floor(Math.random() * 4);
      [x, y] = side === 0 ? [Math.random() * W, -30]
              : side === 1 ? [W + 30, Math.random() * H]
              : side === 2 ? [Math.random() * W, H + 30]
              :              [-30, Math.random() * H];
    }
    const a = Math.random() * Math.PI * 2;
    const spd = (0.6 + Math.random() * 0.9) * this.speedMult; // slower base speed
    const r = 24 + Math.random() * 20;
    const pts = Array.from({ length: 8 }, (_, i) => {
      const pa = (i / 8) * Math.PI * 2, pr = r * (0.65 + Math.random() * 0.5);
      return { x: Math.cos(pa) * pr, y: Math.sin(pa) * pr };
    });
    this.asteroids.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r, pts, big: true, hp: this.wave >= 3 ? 2 : 1 });
  }

  shoot() {
    if (this.dead || this.won) { this.reset(); return; }
    if (this.shootCooldown > 0) return;
    const { ship: s } = this;
    this.bullets.push({ x: s.x + Math.cos(s.angle) * 22, y: s.y + Math.sin(s.angle) * 22,
                        vx: Math.cos(s.angle) * 9, vy: Math.sin(s.angle) * 9, life: 65 });
    this.shootCooldown = 10;
  }

  start() { this.raf = requestAnimationFrame(() => this.loop()); }

  loop() {
    if (!this.dead && !this.won) {
      this.frame++;
      if (this.shootCooldown > 0) this.shootCooldown--;
      if (this.keys.ShootHeld) this.shoot();

      // Check win
      if (this.score >= this.winScore) {
        this.won = true;
        saveHS('mm_space_hs', this.score);
      }

      // Wave progression
      const newWave = this.score < 350 ? 1 : this.score < 700 ? 2 : 3;
      if (newWave !== this.wave) {
        this.wave = newWave;
        const msgs = ['', '', '⚡ WAVE 2 — ASTEROIDS FASTER', '🔥 WAVE 3 — MAXIMUM CHAOS'];
        this.announce = mkAnnounce(msgs[this.wave] || 'WAVE UP!');
      }

      const { ship: s, keys: k } = this;
      if (k.ArrowLeft)  s.angle -= 0.065;
      if (k.ArrowRight) s.angle += 0.065;
      if (k.ArrowUp)    { s.vx += Math.cos(s.angle) * 0.28; s.vy += Math.sin(s.angle) * 0.28; }
      s.vx *= 0.98; s.vy *= 0.98;
      const W = this.canvas.width, H = this.canvas.height;
      s.x = (s.x + s.vx + W) % W; s.y = (s.y + s.vy + H) % H;

      this.bullets.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
      this.bullets = this.bullets.filter(b => b.life > 0);
      this.asteroids.forEach(a => { a.x = (a.x + a.vx + W) % W; a.y = (a.y + a.vy + H) % H; });

      // Bullet-asteroid collisions
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        for (let ai = this.asteroids.length - 1; ai >= 0; ai--) {
          const b = this.bullets[bi], a = this.asteroids[ai];
          if (Math.hypot(b.x - a.x, b.y - a.y) < a.r) {
            a.hp--;
            this.bullets.splice(bi, 1);
            if (a.hp <= 0) {
              this.score += a.big ? 20 : 50;
              if (a.big) {
                for (let s2 = 0; s2 < 2; s2++) {
                  const ang = Math.random() * Math.PI * 2, r2 = a.r * 0.55;
                  const pts = Array.from({ length: 6 }, (_, i) => {
                    const pa = (i / 6) * Math.PI * 2, pr = r2 * (0.65 + Math.random() * 0.5);
                    return { x: Math.cos(pa) * pr, y: Math.sin(pa) * pr };
                  });
                  this.asteroids.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 1.5 * this.speedMult,
                                        vy: Math.sin(ang) * 1.5 * this.speedMult, r: r2, pts, big: false, hp: 1 });
                }
              }
              this.asteroids.splice(ai, 1);
            }
            break;
          }
        }
      }

      // Ship collision — 180 invincibility frames (easier)
      if (this.inv <= 0) {
        for (const a of this.asteroids) {
          if (Math.hypot(s.x - a.x, s.y - a.y) < a.r + 10) {
            this.lives--; this.inv = 180;
            if (this.lives <= 0) {
              this.dead = true;
              saveHS('mm_space_hs', this.score);
            }
            break;
          }
        }
      } else this.inv--;

      if (this.asteroids.length === 0) for (let i = 0; i < 4 + Math.floor(this.score / 250); i++) this.spawnAsteroid();
      if (this.frame % 600 === 0) this.spawnAsteroid(); // less frequent bonus spawns
    }
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { ctx: c, canvas: cv, ship: s } = this;
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);

    this.planets.forEach(p => {
      c.save();
      if (p.rings) {
        c.strokeStyle = p.col + '88'; c.lineWidth = 5;
        c.beginPath(); c.ellipse(p.x, p.y + p.r * 0.15, p.r * 1.9, p.r * 0.45, p.ringAngle, Math.PI * 0.15, Math.PI * 0.85);
        c.stroke();
      }
      const grad = c.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
      grad.addColorStop(0, p.hi); grad.addColorStop(1, p.col);
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fillStyle = grad; c.fill();
      if (p.rings) {
        c.strokeStyle = p.col + 'aa'; c.lineWidth = 4;
        c.beginPath(); c.ellipse(p.x, p.y + p.r * 0.15, p.r * 1.9, p.r * 0.45, p.ringAngle, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      }
      c.restore();
    });

    this.stars.forEach(st => {
      const twinkle = st.br + Math.sin(this.frame * 0.05 + st.tw) * 0.08;
      c.fillStyle = `rgba(200,240,200,${twinkle})`;
      c.beginPath(); c.arc(st.x, st.y, st.r, 0, Math.PI * 2); c.fill();
    });

    if (!this.dead && !this.won && (this.inv <= 0 || Math.floor(this.inv / 8) % 2 === 0)) {
      c.save(); c.translate(s.x, s.y); c.rotate(s.angle);
      c.strokeStyle = G; c.lineWidth = 2; c.shadowColor = G; c.shadowBlur = 8;
      c.beginPath(); c.moveTo(20, 0); c.lineTo(-12, -10); c.lineTo(-8, 0); c.lineTo(-12, 10); c.closePath(); c.stroke();
      if (this.keys?.ArrowUp) { c.fillStyle = 'rgba(255,179,0,0.8)'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-16, -5); c.lineTo(-16, 5); c.closePath(); c.fill(); }
      c.restore();
    }

    c.shadowBlur = 0;
    this.bullets.forEach(b => { c.fillStyle = G; c.shadowColor = G; c.shadowBlur = 6; c.beginPath(); c.arc(b.x, b.y, 3, 0, Math.PI * 2); c.fill(); });
    c.shadowBlur = 0;

    const astColor = this.wave === 3 ? '#ff8844' : A;
    c.strokeStyle = astColor; c.lineWidth = 1.5;
    this.asteroids.forEach(a => {
      c.save(); c.translate(a.x, a.y);
      c.beginPath(); c.moveTo(a.pts[0].x, a.pts[0].y);
      a.pts.forEach(p => c.lineTo(p.x, p.y)); c.closePath(); c.stroke();
      if (this.wave >= 3 && a.big && a.hp > 1) {
        c.fillStyle = R; c.font = '8px "Press Start 2P",monospace'; c.textAlign = 'center';
        c.fillText('!!', 0, -a.r - 4); c.textAlign = 'left';
      }
      c.restore();
    });

    c.fillStyle = G; c.font = '12px "Press Start 2P",monospace'; c.fillText(`SCORE: ${this.score}`, 10, 22);
    const spaceHS = getHS('mm_space_hs');
    if (spaceHS > 0) { c.fillStyle = 'rgba(200,240,200,0.4)'; c.font = '7px "Press Start 2P",monospace'; c.fillText(`BEST: ${spaceHS}`, 10, 36); }
    c.fillStyle = R; c.font = '12px "Press Start 2P",monospace'; c.fillText('♥'.repeat(Math.max(0, this.lives)), cv.width - 90, 22);
    if (this.wave > 1) { c.fillStyle = A; c.font = '8px "Press Start 2P",monospace'; c.fillText(`WAVE ${this.wave}`, cv.width / 2 - 30, 22); }

    if (this.won) {
      c.fillStyle = G; c.font = '18px "Press Start 2P",monospace'; c.textAlign = 'center';
      c.fillText('SECTOR CLEARED! 🚀', cv.width / 2, cv.height / 2 - 28);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText(`FINAL SCORE: ${this.score}`, cv.width / 2, cv.height / 2 + 2);
      c.fillStyle = A;
      c.fillText('YOU ARE THE LAST PILOT STANDING', cv.width / 2, cv.height / 2 + 24);
      c.fillStyle = 'rgba(200,240,200,0.6)';
      c.fillText('SPACE TO PLAY AGAIN', cv.width / 2, cv.height / 2 + 48);
      c.textAlign = 'left';
    } else if (this.dead) {
      c.fillStyle = R; c.font = '22px "Press Start 2P",monospace'; c.textAlign = 'center';
      c.fillText('GAME OVER', cv.width / 2, cv.height / 2 - 24);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText(`SCORE: ${this.score}`, cv.width / 2, cv.height / 2 + 2);
      const shs = getHS('mm_space_hs');
      c.fillStyle = this.score >= shs ? A : 'rgba(200,240,200,0.5)';
      c.fillText(this.score >= shs ? `NEW BEST: ${shs}! 🏆` : `BEST: ${shs}`, cv.width / 2, cv.height / 2 + 20);
      c.fillStyle = 'rgba(200,240,200,0.6)'; c.font = '8px "Press Start 2P",monospace';
      c.fillText('TAP SHOOT TO RESTART', cv.width / 2, cv.height / 2 + 38);
      c.textAlign = 'left';
    }
    if (this.frame < 200) {
      c.fillStyle = 'rgba(200,240,200,0.4)'; c.font = '8px "Press Start 2P",monospace';
      c.textAlign = 'center'; c.fillText('← → ROTATE  ↑ THRUST  SPACE SHOOT', cv.width / 2, cv.height - 10); c.textAlign = 'left';
    }
    this._drawAnnounce(c, cv);
  }

  _drawAnnounce(c, cv) {
    if (!this.announce || this.announce.t <= 0) return;
    const alpha = Math.min(1, this.announce.t / 40);
    c.globalAlpha = alpha;
    c.fillStyle = this.announce.color || R;
    c.font = '13px "Press Start 2P",monospace'; c.textAlign = 'center';
    c.fillText(this.announce.text, cv.width / 2, cv.height / 2);
    c.textAlign = 'left'; c.globalAlpha = 1;
    this.announce.t--;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

// ════════════════════════════════════════════════════════════════
// 🏓  PONG VS AI  (Table Tennis rules)
// ════════════════════════════════════════════════════════════════
class Pong {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx;
    canvas.width = 600; canvas.height = 380;
    this.keys = {};
    this._lastUp = 0; this._lastDown = 0; this._boostUp = 0; this._boostDown = 0;
    this._onKey = e => {
      const gameCodes = ['KeyW','KeyS','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
      if (gameCodes.includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      const now = performance.now();
      // Double-tap detection for speed boost
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (now - this._lastUp < 220) this._boostUp = 25;
        this._lastUp = now;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (now - this._lastDown < 220) this._boostDown = 25;
        this._lastDown = now;
      }
      if (e.code === 'Space') this.spaceAction();
    };
    this._onKeyUp = e => { delete this.keys[e.code]; };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup',   this._onKeyUp);
    this._loadPongStats();
    this.reset();
  }

  _loadPongStats() {
    const t = today();
    const dp  = JSON.parse(localStorage.getItem('mm_pong_day_p')  || '{}');
    const dai = JSON.parse(localStorage.getItem('mm_pong_day_ai') || '{}');
    this.stats = {
      lifeP:  getHS('mm_pong_life_p'),
      lifeAI: getHS('mm_pong_life_ai'),
      dayP:   dp.date  === t ? dp.wins  : 0,
      dayAI:  dai.date === t ? dai.wins : 0,
      today:  t
    };
  }

  _savePongStats(winner) {
    const s = this.stats;
    if (winner === 'player') { s.lifeP++; s.dayP++; }
    else                     { s.lifeAI++; s.dayAI++; }
    localStorage.setItem('mm_pong_life_p',  s.lifeP);
    localStorage.setItem('mm_pong_life_ai', s.lifeAI);
    localStorage.setItem('mm_pong_day_p',   JSON.stringify({ date: s.today, wins: s.dayP }));
    localStorage.setItem('mm_pong_day_ai',  JSON.stringify({ date: s.today, wins: s.dayAI }));
  }

  reset() {
    this.ph = 70; this.pw = 12;
    this.player = { y: 190 - 35, score: 0 };
    this.ai     = { y: 190 - 35, score: 0 };
    this.over = false; this.winner = ''; this.announce = null;
    this.serveCount = 0;        // total points played
    this.serving = Math.random() > 0.5 ? 'player' : 'ai'; // random first serve
    this.waitServe = true;      // ball not in play yet
    this.aiServeDelay = 80;     // AI waits before auto-serving
    this.ball = { x: 0, y: 0, vx: 0, vy: 0 };
    this.spinUsed = false;
    this.playerVy = 0;
    this._loadPongStats();
    this._placeBallOnServer();
  }

  _placeBallOnServer() {
    const cv = this.canvas;
    if (this.serving === 'player') {
      this.ball = { x: 20 + this.pw + 8, y: this.player.y + this.ph / 2, vx: 0, vy: 0 };
    } else {
      this.ball = { x: cv.width - 20 - this.pw - 8, y: this.ai.y + this.ph / 2, vx: 0, vy: 0 };
      this.aiServeDelay = 80;
    }
  }

  // Called on every serve change / point score
  _pointScored(scorer) {
    this[scorer].score++;
    this.serveCount++;
    // Switch serve every 2 points (last 2 points of game: every point)
    const max = Math.max(this.player.score, this.ai.score);
    const isDeuce = max >= 9; // at 9-9 or higher, serve every point
    if (isDeuce || this.serveCount % 2 === 0) {
      this.serving = this.serving === 'player' ? 'ai' : 'player';
    }
    if (this.player.score >= 10) {
      this.over = true; this.winner = 'YOU WIN! 🎉';
      this._savePongStats('player'); return;
    }
    if (this.ai.score >= 10) {
      this.over = true; this.winner = 'AI WINS 🤖';
      this._savePongStats('ai'); return;
    }
    this.waitServe = true;
    this._placeBallOnServer();
  }

  spaceAction() {
    if (this.over) { this.reset(); return; }
    if (this.waitServe && this.serving === 'player') {
      // Launch serve: angle based on where ball is on paddle
      const rel = (this.ball.y - (this.player.y + this.ph / 2)) / (this.ph / 2); // -1 to 1
      this.ball.vx = 5 + Math.random() * 0.5;
      this.ball.vy = rel * 4;
      this.waitServe = false;
      this.spinUsed = false;
    } else if (!this.waitServe && this.ball.vx < 0 && this.ball.x < 200 && !this.spinUsed) {
      // Mid-rally spin: add topspin/backspin based on recent player movement
      this.ball.vy += this.playerVy * 0.55 + (Math.random() - 0.5) * 1.5;
      this.ball.vy = Math.max(-10, Math.min(10, this.ball.vy));
      this.spinUsed = true;
      this.announce = mkAnnounce('SPIN! 🌀', A);
    }
  }

  get aiSpeed() {
    const total = this.player.score + this.ai.score;
    // Much easier AI speeds
    return total >= 8 ? 4.2 : total >= 5 ? 3.5 : total >= 2 ? 3.0 : 2.5;
  }

  start() { this.raf = requestAnimationFrame(() => this.loop()); }

  loop() {
    if (!this.over) {
      const { keys: k, player: p, ai: a, ball: b, canvas: cv } = this;

      // Double-tap boost countdown
      if (this._boostUp   > 0) this._boostUp--;
      if (this._boostDown > 0) this._boostDown--;

      const pSpd = 6;
      const prevY = p.y;
      if (k.KeyW || k.ArrowUp)   p.y = Math.max(0, p.y - (this._boostUp   > 0 ? 13 : pSpd));
      if (k.KeyS || k.ArrowDown) p.y = Math.min(cv.height - this.ph, p.y + (this._boostDown > 0 ? 13 : pSpd));
      this.playerVy = p.y - prevY;

      if (this.waitServe) {
        // Ball follows server paddle
        if (this.serving === 'player') {
          b.y = p.y + this.ph / 2;
          b.x = 20 + this.pw + 8;
        } else {
          b.y = a.y + this.ph / 2;
          b.x = cv.width - 20 - this.pw - 8;
          // AI auto-aims toward center ±random, then serves
          const aiC = a.y + this.ph / 2;
          if (aiC < cv.height / 2 - 20) a.y = Math.min(cv.height - this.ph, a.y + 2.5);
          if (aiC > cv.height / 2 + 20) a.y = Math.max(0, a.y - 2.5);
          if (--this.aiServeDelay <= 0) {
            const rel = (b.y - (a.y + this.ph / 2)) / (this.ph / 2);
            b.vx = -(4.5 + Math.random() * 0.5);
            b.vy = rel * 3.5 + (Math.random() - 0.5) * 2;
            this.waitServe = false;
            this.spinUsed = false;
          }
        }
      } else {
        // Normal AI tracking (with error margin — easier)
        const aiC = a.y + this.ph / 2;
        const err = (Math.random() - 0.5) * 14; // prediction error makes AI miss sometimes
        if (aiC < b.y - 10 + err) a.y = Math.min(cv.height - this.ph, a.y + this.aiSpeed);
        if (aiC > b.y + 10 + err) a.y = Math.max(0, a.y - this.aiSpeed);

        b.x += b.vx; b.y += b.vy;
        if (b.y <= 5 || b.y >= cv.height - 5) b.vy *= -1;

        // Player paddle hit
        if (b.x <= 34 && b.x >= 20 && b.y >= p.y && b.y <= p.y + this.ph) {
          b.vx = Math.abs(b.vx) * 1.04;
          b.vy += (b.y - (p.y + this.ph / 2)) * 0.12;
          this.spinUsed = false; // reset spin for next approach
        }
        // AI paddle hit
        if (b.x >= cv.width - 34 && b.x <= cv.width - 20 && b.y >= a.y && b.y <= a.y + this.ph) {
          b.vx = -Math.abs(b.vx) * 1.04;
          b.vy += (b.y - (a.y + this.ph / 2)) * 0.12;
        }

        b.vx = Math.max(-12, Math.min(12, b.vx));
        b.vy = Math.max(-10, Math.min(10, b.vy));

        if (b.x < 0)        { this._pointScored('ai'); }
        if (b.x > cv.width) { this._pointScored('player'); }
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { ctx: c, canvas: cv, player: p, ai: a, ball: b } = this;
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.setLineDash([8, 8]); c.strokeStyle = 'rgba(57,255,20,0.15)';
    c.beginPath(); c.moveTo(cv.width / 2, 0); c.lineTo(cv.width / 2, cv.height); c.stroke(); c.setLineDash([]);

    // Serve indicator arrow for player
    if (this.waitServe && this.serving === 'player') {
      c.strokeStyle = 'rgba(57,255,20,0.4)'; c.lineWidth = 1.5;
      c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + 60, b.y); c.stroke();
      c.setLineDash([]); c.lineWidth = 1;
    }

    c.fillStyle = G; c.shadowColor = G; c.shadowBlur = 8; c.fillRect(20, p.y, this.pw, this.ph);
    c.fillStyle = R; c.shadowColor = R; c.shadowBlur = 8; c.fillRect(cv.width - 32, a.y, this.pw, this.ph);
    c.shadowBlur = 0;

    // Ball — pulse when waiting to serve
    const ballR = (this.waitServe && Math.floor(this.frame / 15) % 2 === 0) ? 8 : 6;
    c.fillStyle = W; c.shadowColor = W; c.shadowBlur = 10;
    c.beginPath(); c.arc(b.x, b.y, ballR, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;

    // Scores
    c.textAlign = 'center';
    c.fillStyle = G; c.font = '28px "Press Start 2P",monospace'; c.fillText(p.score, cv.width / 2 - 55, 44);
    c.fillStyle = R; c.fillText(a.score, cv.width / 2 + 55, 44);
    c.fillStyle = 'rgba(200,240,200,0.35)'; c.font = '7px "Press Start 2P",monospace';
    c.fillText('YOU', cv.width / 2 - 55, 58); c.fillText('AI', cv.width / 2 + 55, 58);

    // Serve label
    if (!this.over) {
      const serveLabel = this.serving === 'player' ? '◀ YOUR SERVE' : 'AI SERVE ▶';
      const serveCol   = this.serving === 'player' ? G : R;
      c.fillStyle = serveCol; c.font = '7px "Press Start 2P",monospace';
      c.fillText(serveLabel, cv.width / 2, 72);
      if (this.waitServe && this.serving === 'player') {
        c.fillStyle = 'rgba(200,240,200,0.7)';
        c.fillText('MOVE PADDLE TO AIM  ·  SPACE TO SERVE', cv.width / 2, cv.height - 26);
      }
      c.fillStyle = 'rgba(200,240,200,0.3)';
      c.fillText('W/S or ↑/↓ to move  ·  double-tap = BOOST  ·  SPACE near ball = SPIN', cv.width / 2, cv.height - 10);
    }

    if (this.over) {
      c.fillStyle = this.winner.includes('YOU') ? G : R; c.font = '20px "Press Start 2P",monospace';
      c.fillText(this.winner, cv.width / 2, cv.height / 2 - 10);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText('SPACE TO PLAY AGAIN', cv.width / 2, cv.height / 2 + 20);
    }

    // ── Stats panel (bottom left) ──
    if (this.stats) {
      const s = this.stats;
      c.textAlign = 'left';
      c.font = '6px "Press Start 2P",monospace';
      c.fillStyle = 'rgba(200,240,200,0.25)';
      c.fillText('TODAY', 8, cv.height - 42);
      c.fillStyle = G;   c.fillText(`YOU: ${s.dayP}`, 8, cv.height - 30);
      c.fillStyle = R;   c.fillText(` AI: ${s.dayAI}`, 8, cv.height - 18);
      c.fillStyle = 'rgba(200,240,200,0.25)';
      c.fillText('ALL TIME', cv.width - 68, cv.height - 42);
      c.fillStyle = G;   c.fillText(`YOU: ${s.lifeP}`,  cv.width - 68, cv.height - 30);
      c.fillStyle = R;   c.fillText(` AI: ${s.lifeAI}`, cv.width - 68, cv.height - 18);
    }

    c.textAlign = 'left';
    this.frame = (this.frame || 0) + 1;
    this._drawAnnounce(c, cv);
  }

  _drawAnnounce(c, cv) {
    if (!this.announce || this.announce.t <= 0) return;
    const alpha = Math.min(1, this.announce.t / 40);
    c.globalAlpha = alpha;
    c.fillStyle = this.announce.color || R;
    c.font = '11px "Press Start 2P",monospace'; c.textAlign = 'center';
    c.fillText(this.announce.text, cv.width / 2, cv.height / 2 - 30);
    c.textAlign = 'left'; c.globalAlpha = 1;
    this.announce.t--;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

// ════════════════════════════════════════════════════════════════
// 🐍  SNAKE
// ════════════════════════════════════════════════════════════════
class Snake {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx;
    this.cell = 20; canvas.width = 600; canvas.height = 400;
    this.cols = canvas.width / this.cell; this.rows = canvas.height / this.cell;
    this.keys = {};
    this._onKey = e => {
      const m = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] };
      if (m[e.code]) { e.preventDefault(); const [dx,dy] = m[e.code]; if (dx !== -this.dir[0] || dy !== -this.dir[1]) this.nextDir = [dx,dy]; }
      if (e.code === 'Space' && this.dead) this.reset();
    };
    window.addEventListener('keydown', this._onKey);
    this.reset();
  }

  touchDir(code) {
    const m = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
    if (m[code]) { const [dx,dy] = m[code]; if (dx !== -this.dir[0] || dy !== -this.dir[1]) this.nextDir = [dx,dy]; }
  }

  reset() {
    this.snake = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    this.dir = [1,0]; this.nextDir = [1,0];
    this.food = this.randFood(); this.bonus = null;
    this.walls = []; this.score = 0;
    this.dead = false; this.tick = 0; this.spd = 8;
    this.milestone = 0; this.announce = null;
  }

  randFood() {
    let f;
    do { f = { x: Math.floor(Math.random() * this.cols), y: Math.floor(Math.random() * this.rows) }; }
    while (this.snake?.some(s => s.x === f.x && s.y === f.y) || this.walls?.some(w => w.x === f.x && w.y === f.y));
    return f;
  }

  addWalls(n) {
    for (let i = 0; i < n; i++) {
      let w, tries = 0;
      do { w = { x: Math.floor(Math.random() * this.cols), y: Math.floor(Math.random() * this.rows) }; tries++; }
      while (tries < 50 && (this.snake.some(s => s.x === w.x && s.y === w.y) || this.walls.some(ww => ww.x === w.x && ww.y === w.y)));
      this.walls.push(w);
    }
  }

  start() { this.raf = requestAnimationFrame(() => this.loop()); }

  loop() {
    this.tick++;
    if (!this.dead && this.tick % this.spd === 0) {
      this.dir = this.nextDir;
      const h = { x: this.snake[0].x + this.dir[0], y: this.snake[0].y + this.dir[1] };
      if (h.x < 0 || h.x >= this.cols || h.y < 0 || h.y >= this.rows) { this.dead = true; saveHS('mm_snake_hs', this.score); }
      else if (this.snake.some(s => s.x === h.x && s.y === h.y)) { this.dead = true; saveHS('mm_snake_hs', this.score); }
      else if (this.walls.some(w => w.x === h.x && w.y === h.y)) { this.dead = true; saveHS('mm_snake_hs', this.score); }
      else {
        this.snake.unshift(h);
        if (h.x === this.food.x && h.y === this.food.y) {
          this.score++;
          this.food = this.randFood();
          if (this.score % 5 === 0) this.spd = Math.max(3, this.spd - 1);
          if (this.score === 15 && this.milestone < 1) {
            this.milestone = 1; this.addWalls(4);
            this.announce = mkAnnounce('⚠ WALLS APPEAR!', A);
          }
          if (this.score === 25 && this.milestone < 2) {
            this.milestone = 2; this.addWalls(5);
            this.announce = mkAnnounce('🔥 MORE WALLS!', R);
          }
        } else this.snake.pop();
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { ctx: c, canvas: cv, cell: cs } = this;
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(57,255,20,0.05)';
    for (let x = 0; x < this.cols; x++) for (let y = 0; y < this.rows; y++) c.fillRect(x * cs + cs/2, y * cs + cs/2, 1, 1);
    c.fillStyle = '#444'; c.shadowColor = '#888'; c.shadowBlur = 4;
    this.walls.forEach(w => c.fillRect(w.x * cs + 1, w.y * cs + 1, cs - 2, cs - 2));
    c.shadowBlur = 0;
    this.snake.forEach((s, i) => {
      c.fillStyle = i === 0 ? '#fff' : G; c.shadowColor = i === 0 ? '#fff' : G; c.shadowBlur = i === 0 ? 12 : 4;
      c.fillRect(s.x * cs + 1, s.y * cs + 1, cs - 2, cs - 2);
    });
    c.shadowBlur = 0;
    c.fillStyle = R; c.shadowColor = R; c.shadowBlur = 12;
    c.fillRect(this.food.x * cs + 2, this.food.y * cs + 2, cs - 4, cs - 4);
    c.shadowBlur = 0;
    c.fillStyle = G; c.font = '12px "Press Start 2P",monospace';
    c.fillText(`SCORE: ${this.score}`, 10, 22);
    const snakeHS = getHS('mm_snake_hs');
    if (snakeHS > 0) { c.fillStyle = 'rgba(200,240,200,0.4)'; c.font = '7px "Press Start 2P",monospace'; c.fillText(`BEST: ${snakeHS}`, 10, 36); }
    if (this.dead) {
      c.fillStyle = R; c.font = '22px "Press Start 2P",monospace'; c.textAlign = 'center';
      c.fillText('GAME OVER', cv.width / 2, cv.height / 2 - 24);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText(`SCORE: ${this.score}`, cv.width / 2, cv.height / 2 + 0);
      c.fillStyle = this.score >= snakeHS ? A : 'rgba(200,240,200,0.5)';
      c.fillText(this.score >= snakeHS ? `NEW BEST: ${snakeHS}! 🏆` : `BEST: ${snakeHS}`, cv.width / 2, cv.height / 2 + 18);
      c.fillStyle = 'rgba(200,240,200,0.6)'; c.font = '8px "Press Start 2P",monospace';
      c.fillText('TAP TO RESTART', cv.width / 2, cv.height / 2 + 36);
      c.textAlign = 'left';
    }
    if (this.tick < 120) {
      c.fillStyle = 'rgba(200,240,200,0.45)'; c.font = '9px "Press Start 2P",monospace';
      c.textAlign = 'center'; c.fillText('ARROW KEYS / D-PAD TO MOVE', cv.width / 2, cv.height - 10); c.textAlign = 'left';
    }
    this._drawAnnounce(c, cv);
  }

  _drawAnnounce(c, cv) {
    if (!this.announce || this.announce.t <= 0) return;
    const alpha = Math.min(1, this.announce.t / 40);
    c.globalAlpha = alpha;
    c.fillStyle = this.announce.color || R;
    c.font = '13px "Press Start 2P",monospace'; c.textAlign = 'center';
    c.fillText(this.announce.text, cv.width / 2, cv.height / 2 - 10);
    c.textAlign = 'left'; c.globalAlpha = 1;
    this.announce.t--;
  }

  destroy() { cancelAnimationFrame(this.raf); window.removeEventListener('keydown', this._onKey); }
}

// ── Wire up game cards ──────────────────────────────────────────
const GAME_NAMES = { goat:'🐐 GOAT RUNNER', space:'🚀 SPACE BLASTER', pong:'🏓 PONG VS AI', snake:'🐍 SNAKE' };

document.querySelectorAll('.btn-play-game').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.game;
    document.getElementById('games-grid-view').classList.add('hidden');
    document.getElementById('game-viewport').classList.remove('hidden');
    document.getElementById('game-viewport-title').textContent = GAME_NAMES[name];
    initGame(name, document.getElementById('game-canvas'));
  });
});

document.getElementById('btn-back-game')?.addEventListener('click', () => {
  stopGame();
  document.getElementById('game-viewport').classList.add('hidden');
  document.getElementById('games-grid-view').classList.remove('hidden');
});
