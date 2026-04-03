// ── games.js — Mail Mission Arcade ─────────────────────────────
let currentGame = null;

function initGame(name, canvas) {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
  const ctx = canvas.getContext('2d');
  if (name === 'goat')  currentGame = new GoatRunner(canvas, ctx);
  if (name === 'space') currentGame = new SpaceBlaster(canvas, ctx);
  if (name === 'pong')  currentGame = new Pong(canvas, ctx);
  if (name === 'snake') currentGame = new Snake(canvas, ctx);
  currentGame?.start();
}

function stopGame() {
  if (currentGame) { currentGame.destroy(); currentGame = null; }
}

const G = '#39ff14', W = '#c8f0c8', R = '#ff3c3c', A = '#ffb300';

// ════════════════════════════════════════════════════════════════
// 🐐  GOAT RUNNER
// ════════════════════════════════════════════════════════════════
class GoatRunner {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx;
    canvas.width = 600; canvas.height = 200;
    this._onKey   = e => { if (e.code === 'Space') { e.preventDefault(); this.jump(); } };
    this._onClick = () => this.jump();
    window.addEventListener('keydown', this._onKey);
    canvas.addEventListener('click', this._onClick);
    this.reset();
  }

  reset() {
    this.goatY = 138; this.vy = 0; this.ground = 138;
    this.obstacles = []; this.score = 0; this.speed = 4;
    this.dead = false; this.frame = 0; this.nextObs = 100;
  }

  jump() {
    if (this.dead) { this.reset(); return; }
    if (this.goatY >= this.ground - 1) this.vy = -13;
  }

  start() { this.raf = requestAnimationFrame(() => this.loop()); }

  loop() {
    if (!this.dead) {
      this.frame++; this.score++;
      this.speed = 4 + this.score / 600;
      this.vy += 0.65; this.goatY += this.vy;
      if (this.goatY >= this.ground) { this.goatY = this.ground; this.vy = 0; }

      if (--this.nextObs <= 0) {
        this.obstacles.push({ x: 600, w: 18 + Math.random()*14, h: 28 + Math.random()*22 });
        this.nextObs = 65 + Math.random()*70;
      }
      this.obstacles.forEach(o => o.x -= this.speed);
      this.obstacles = this.obstacles.filter(o => o.x > -40);

      for (const o of this.obstacles) {
        if (o.x < 78 && o.x + o.w > 48 && this.goatY > this.ground - o.h + 10) this.dead = true;
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { ctx: c, canvas: cv } = this;
    c.fillStyle = '#000'; c.fillRect(0,0,cv.width,cv.height);
    c.fillStyle = G; c.fillRect(0, this.ground+36, cv.width, 2);

    // Goat (flipped to face right)
    const goatBob = this.goatY >= this.ground && this.frame%10<5 ? 2 : 0;
    c.font = '34px serif';
    c.save();
    c.translate(44 + 34, this.goatY + 34 + goatBob);
    c.scale(-1, 1);
    c.fillText('🐐', -34, 0);
    c.restore();

    // Obstacles
    c.fillStyle = A;
    this.obstacles.forEach(o => c.fillRect(o.x, this.ground+36 - o.h, o.w, o.h));

    c.fillStyle = G; c.font = '12px "Press Start 2P",monospace';
    c.fillText(`SCORE: ${Math.floor(this.score/5)}`, 10, 22);

    if (this.dead) {
      c.fillStyle = R; c.font = '20px "Press Start 2P",monospace';
      c.textAlign = 'center';
      c.fillText('GAME OVER', cv.width/2, 78);
      c.fillStyle = W; c.font = '9px "Press Start 2P",monospace';
      c.fillText('CLICK OR SPACE TO RESTART', cv.width/2, 106);
      c.textAlign = 'left';
    } else if (this.frame < 120) {
      c.fillStyle = 'rgba(200,240,200,0.5)'; c.font = '9px "Press Start 2P",monospace';
      c.textAlign = 'center';
      c.fillText('SPACE / CLICK TO JUMP', cv.width/2, cv.height - 8);
      c.textAlign = 'left';
    }
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
    this._onKey   = e => { this.keys[e.code] = true;  if (e.code==='Space'){e.preventDefault();this.shoot();} };
    this._onKeyUp = e => { delete this.keys[e.code]; };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
    this.reset();
  }

  reset() {
    this.ship = { x:300, y:210, angle:-Math.PI/2, vx:0, vy:0 };
    this.bullets = []; this.asteroids = []; this.score = 0; this.lives = 3;
    this.dead = false; this.inv = 0; this.frame = 0; this.shootCooldown = 0;
    for (let i = 0; i < 5; i++) this.spawnAsteroid(true);
  }

  spawnAsteroid(init = false) {
    const W = this.canvas.width, H = this.canvas.height;
    let x, y;
    if (init) { x = Math.random()*W; y = Math.random()*H; }
    else {
      const side = Math.floor(Math.random()*4);
      [x,y] = side===0?[Math.random()*W,-30]:side===1?[W+30,Math.random()*H]:side===2?[Math.random()*W,H+30]:[-30,Math.random()*H];
    }
    const a = Math.random()*Math.PI*2, spd = 0.8+Math.random()*1.2, r = 24+Math.random()*20;
    const pts = Array.from({length:8},(_,i)=>{ const pa=(i/8)*Math.PI*2, pr=r*(0.65+Math.random()*0.5); return {x:Math.cos(pa)*pr,y:Math.sin(pa)*pr}; });
    this.asteroids.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r,pts,big:true});
  }

  shoot() {
    if (this.dead) { this.reset(); return; }
    if (this.shootCooldown > 0) return;
    const {ship:s} = this;
    this.bullets.push({x:s.x+Math.cos(s.angle)*22,y:s.y+Math.sin(s.angle)*22,vx:Math.cos(s.angle)*9,vy:Math.sin(s.angle)*9,life:65});
    this.shootCooldown = 10;
  }

  start() { this.raf = requestAnimationFrame(() => this.loop()); }

  loop() {
    if (!this.dead) {
      this.frame++; if (this.shootCooldown>0) this.shootCooldown--;
      const {ship:s,keys:k} = this;
      if (k.ArrowLeft)  s.angle -= 0.065;
      if (k.ArrowRight) s.angle += 0.065;
      if (k.ArrowUp) { s.vx += Math.cos(s.angle)*0.28; s.vy += Math.sin(s.angle)*0.28; }
      s.vx *= 0.98; s.vy *= 0.98;
      const W=this.canvas.width, H=this.canvas.height;
      s.x=(s.x+s.vx+W)%W; s.y=(s.y+s.vy+H)%H;

      this.bullets.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.life--;});
      this.bullets=this.bullets.filter(b=>b.life>0);
      this.asteroids.forEach(a=>{a.x=(a.x+a.vx+W)%W;a.y=(a.y+a.vy+H)%H;});

      // Bullet-asteroid collisions
      for (let bi=this.bullets.length-1;bi>=0;bi--) {
        for (let ai=this.asteroids.length-1;ai>=0;ai--) {
          const b=this.bullets[bi],a=this.asteroids[ai];
          if (Math.hypot(b.x-a.x,b.y-a.y)<a.r) {
            this.score += a.big?20:50;
            this.bullets.splice(bi,1);
            if (a.big) {
              for (let s2=0;s2<2;s2++) {
                const ang=Math.random()*Math.PI*2, r2=a.r*0.55;
                const pts=Array.from({length:6},(_,i)=>{const pa=(i/6)*Math.PI*2,pr=r2*(0.65+Math.random()*0.5);return{x:Math.cos(pa)*pr,y:Math.sin(pa)*pr};});
                this.asteroids.push({x:a.x,y:a.y,vx:Math.cos(ang)*1.8,vy:Math.sin(ang)*1.8,r:r2,pts,big:false});
              }
            }
            this.asteroids.splice(ai,1);
            break;
          }
        }
      }

      // Ship collision
      if (this.inv<=0) {
        for (const a of this.asteroids) {
          if (Math.hypot(s.x-a.x,s.y-a.y)<a.r+11) { this.lives--; this.inv=120; if(this.lives<=0)this.dead=true; break; }
        }
      } else this.inv--;

      if (this.asteroids.length===0) for (let i=0;i<5+Math.floor(this.score/200);i++) this.spawnAsteroid();
      if (this.frame%480===0) this.spawnAsteroid();
    }
    this.draw();
    this.raf = requestAnimationFrame(()=>this.loop());
  }

  draw() {
    const {ctx:c,canvas:cv,ship:s} = this;
    c.fillStyle='#000'; c.fillRect(0,0,cv.width,cv.height);
    // Stars
    c.fillStyle='rgba(200,240,200,0.25)';
    for(let i=0;i<50;i++) c.fillRect((i*137+50)%cv.width,(i*97+30)%cv.height,1,1);

    // Ship
    if (!this.dead&&(this.inv<=0||Math.floor(this.inv/8)%2===0)) {
      c.save(); c.translate(s.x,s.y); c.rotate(s.angle);
      c.strokeStyle=G; c.lineWidth=2; c.shadowColor=G; c.shadowBlur=8;
      c.beginPath(); c.moveTo(20,0); c.lineTo(-12,-10); c.lineTo(-8,0); c.lineTo(-12,10); c.closePath(); c.stroke();
      if(this.keys?.ArrowUp){c.fillStyle='rgba(255,179,0,0.7)';c.beginPath();c.moveTo(-8,0);c.lineTo(-14,-5);c.lineTo(-14,5);c.closePath();c.fill();}
      c.restore();
    }

    c.shadowBlur=0;
    // Bullets
    this.bullets.forEach(b=>{c.fillStyle=G;c.shadowColor=G;c.shadowBlur=6;c.beginPath();c.arc(b.x,b.y,3,0,Math.PI*2);c.fill();});
    c.shadowBlur=0;

    // Asteroids
    c.strokeStyle=A; c.lineWidth=1.5;
    this.asteroids.forEach(a=>{c.save();c.translate(a.x,a.y);c.beginPath();c.moveTo(a.pts[0].x,a.pts[0].y);a.pts.forEach(p=>c.lineTo(p.x,p.y));c.closePath();c.stroke();c.restore();});

    // HUD
    c.fillStyle=G; c.font='12px "Press Start 2P",monospace'; c.fillText(`SCORE: ${this.score}`,10,22);
    c.fillStyle=R; c.fillText('♥'.repeat(Math.max(0,this.lives)),cv.width-90,22);

    if(this.dead){
      c.fillStyle=R;c.font='22px "Press Start 2P",monospace';c.textAlign='center';
      c.fillText('GAME OVER',cv.width/2,cv.height/2-20);
      c.fillStyle=W;c.font='9px "Press Start 2P",monospace';
      c.fillText('SPACE TO RESTART',cv.width/2,cv.height/2+14);c.textAlign='left';
    }
    if(this.frame<200){c.fillStyle='rgba(200,240,200,0.4)';c.font='8px "Press Start 2P",monospace';c.textAlign='center';c.fillText('← → ROTATE  ↑ THRUST  SPACE SHOOT',cv.width/2,cv.height-10);c.textAlign='left';}
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown',this._onKey);
    window.removeEventListener('keyup',this._onKeyUp);
  }
}

// ════════════════════════════════════════════════════════════════
// 🏓  PONG VS AI
// ════════════════════════════════════════════════════════════════
class Pong {
  constructor(canvas, ctx) {
    this.canvas=canvas; this.ctx=ctx;
    canvas.width=600; canvas.height=380;
    this.keys={};
    this._onKey   = e=>{ this.keys[e.code]=true; if(e.code==='Space'&&this.over)this.reset(); };
    this._onKeyUp = e=>{ delete this.keys[e.code]; };
    window.addEventListener('keydown',this._onKey);
    window.addEventListener('keyup',this._onKeyUp);
    this.reset();
  }

  reset() {
    this.ph=70; this.pw=12;
    this.player={y:190-35,score:0}; this.ai={y:190-35,score:0};
    this.ball={x:300,y:190,vx:4*(Math.random()>.5?1:-1),vy:3*(Math.random()>.5?1:-1)};
    this.over=false; this.winner='';
  }

  start() { this.raf=requestAnimationFrame(()=>this.loop()); }

  loop() {
    if (!this.over) {
      const {keys:k,player:p,ai:a,ball:b,canvas:cv} = this;
      if(k.KeyW||k.ArrowUp)   p.y=Math.max(0,p.y-6);
      if(k.KeyS||k.ArrowDown) p.y=Math.min(cv.height-this.ph,p.y+6);

      const aiC=a.y+this.ph/2;
      if(aiC<b.y-8) a.y=Math.min(cv.height-this.ph,a.y+4.8);
      if(aiC>b.y+8) a.y=Math.max(0,a.y-4.8);

      b.x+=b.vx; b.y+=b.vy;
      if(b.y<=5||b.y>=cv.height-5) b.vy*=-1;

      // Player paddle (x=20)
      if(b.x<=34&&b.x>=20&&b.y>=p.y&&b.y<=p.y+this.ph){b.vx=Math.abs(b.vx)*1.04;b.vy+=(b.y-(p.y+this.ph/2))*0.12;}
      // AI paddle (x=cv.width-32)
      if(b.x>=cv.width-34&&b.x<=cv.width-20&&b.y>=a.y&&b.y<=a.y+this.ph){b.vx=-Math.abs(b.vx)*1.04;b.vy+=(b.y-(a.y+this.ph/2))*0.12;}

      b.vx=Math.max(-11,Math.min(11,b.vx)); b.vy=Math.max(-9,Math.min(9,b.vy));

      if(b.x<0)          {a.score++;   this.serve('player');}
      if(b.x>cv.width)   {p.score++;   this.serve('ai');}
      if(p.score>=7){this.over=true;this.winner='YOU WIN! 🎉';}
      if(a.score>=7){this.over=true;this.winner='AI WINS 🤖';}
    }
    this.draw();
    this.raf=requestAnimationFrame(()=>this.loop());
  }

  serve(from) {
    const cv=this.canvas;
    this.ball={x:cv.width/2,y:cv.height/2,vx:(from==='player'?-1:1)*4,vy:(Math.random()>.5?1:-1)*3};
  }

  draw() {
    const {ctx:c,canvas:cv,player:p,ai:a,ball:b}=this;
    c.fillStyle='#000'; c.fillRect(0,0,cv.width,cv.height);
    c.setLineDash([8,8]); c.strokeStyle='rgba(57,255,20,0.15)';
    c.beginPath(); c.moveTo(cv.width/2,0); c.lineTo(cv.width/2,cv.height); c.stroke(); c.setLineDash([]);

    c.fillStyle=G; c.shadowColor=G; c.shadowBlur=8; c.fillRect(20,p.y,this.pw,this.ph);
    c.fillStyle=R; c.shadowColor=R; c.shadowBlur=8; c.fillRect(cv.width-32,a.y,this.pw,this.ph);
    c.shadowBlur=0;

    c.fillStyle=W; c.shadowColor=W; c.shadowBlur=10;
    c.beginPath(); c.arc(b.x,b.y,6,0,Math.PI*2); c.fill(); c.shadowBlur=0;

    c.textAlign='center';
    c.fillStyle=G; c.font='28px "Press Start 2P",monospace'; c.fillText(p.score,cv.width/2-55,44);
    c.fillStyle=R; c.fillText(a.score,cv.width/2+55,44);
    c.fillStyle='rgba(200,240,200,0.35)'; c.font='7px "Press Start 2P",monospace';
    c.fillText('YOU',cv.width/2-55,58); c.fillText('AI',cv.width/2+55,58);

    if(this.over){
      c.fillStyle=this.winner.includes('YOU')?G:R; c.font='20px "Press Start 2P",monospace';
      c.fillText(this.winner,cv.width/2,cv.height/2-10);
      c.fillStyle=W; c.font='9px "Press Start 2P",monospace';
      c.fillText('SPACE TO PLAY AGAIN',cv.width/2,cv.height/2+20);
    }
    c.fillStyle='rgba(200,240,200,0.3)'; c.font='8px "Press Start 2P",monospace';
    c.fillText('W/S  OR  ↑/↓  TO MOVE',cv.width/2,cv.height-10);
    c.textAlign='left';
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown',this._onKey);
    window.removeEventListener('keyup',this._onKeyUp);
  }
}

// ════════════════════════════════════════════════════════════════
// 🐍  SNAKE
// ════════════════════════════════════════════════════════════════
class Snake {
  constructor(canvas, ctx) {
    this.canvas=canvas; this.ctx=ctx;
    this.cell=20; canvas.width=600; canvas.height=400;
    this.cols=canvas.width/this.cell; this.rows=canvas.height/this.cell;
    this._onKey=e=>{
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
      if(m[e.code]){e.preventDefault();const[dx,dy]=m[e.code];if(dx!==-this.dir[0]||dy!==-this.dir[1])this.nextDir=[dx,dy];}
      if(e.code==='Space'&&this.dead)this.reset();
    };
    window.addEventListener('keydown',this._onKey);
    this.reset();
  }

  reset() {
    this.snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    this.dir=[1,0]; this.nextDir=[1,0];
    this.food=this.randFood(); this.score=0;
    this.dead=false; this.tick=0; this.spd=8;
  }

  randFood() {
    let f;
    do{ f={x:Math.floor(Math.random()*this.cols),y:Math.floor(Math.random()*this.rows)}; }
    while(this.snake?.some(s=>s.x===f.x&&s.y===f.y));
    return f;
  }

  start() { this.raf=requestAnimationFrame(()=>this.loop()); }

  loop() {
    this.tick++;
    if(!this.dead&&this.tick%this.spd===0){
      this.dir=this.nextDir;
      const h={x:this.snake[0].x+this.dir[0],y:this.snake[0].y+this.dir[1]};
      if(h.x<0||h.x>=this.cols||h.y<0||h.y>=this.rows) this.dead=true;
      else if(this.snake.some(s=>s.x===h.x&&s.y===h.y)) this.dead=true;
      else {
        this.snake.unshift(h);
        if(h.x===this.food.x&&h.y===this.food.y){this.score++;this.food=this.randFood();if(this.score%5===0)this.spd=Math.max(4,this.spd-1);}
        else this.snake.pop();
      }
    }
    this.draw();
    this.raf=requestAnimationFrame(()=>this.loop());
  }

  draw() {
    const {ctx:c,canvas:cv,cell:cs}=this;
    c.fillStyle='#000'; c.fillRect(0,0,cv.width,cv.height);

    // Grid dots
    c.fillStyle='rgba(57,255,20,0.05)';
    for(let x=0;x<this.cols;x++) for(let y=0;y<this.rows;y++) c.fillRect(x*cs+cs/2,y*cs+cs/2,1,1);

    // Snake
    this.snake.forEach((s,i)=>{
      c.fillStyle=i===0?'#fff':G; c.shadowColor=i===0?'#fff':G; c.shadowBlur=i===0?12:4;
      c.fillRect(s.x*cs+1,s.y*cs+1,cs-2,cs-2);
    });
    c.shadowBlur=0;

    // Food
    c.fillStyle=R; c.shadowColor=R; c.shadowBlur=12;
    c.fillRect(this.food.x*cs+2,this.food.y*cs+2,cs-4,cs-4);
    c.shadowBlur=0;

    c.fillStyle=G; c.font='12px "Press Start 2P",monospace'; c.fillText(`SCORE: ${this.score}`,10,22);

    if(this.dead){
      c.fillStyle=R; c.font='22px "Press Start 2P",monospace'; c.textAlign='center';
      c.fillText('GAME OVER',cv.width/2,cv.height/2-20);
      c.fillStyle=W; c.font='9px "Press Start 2P",monospace';
      c.fillText(`SCORE: ${this.score}   —   SPACE TO RESTART`,cv.width/2,cv.height/2+16);
      c.textAlign='left';
    }
    if(this.tick<120){c.fillStyle='rgba(200,240,200,0.45)';c.font='9px "Press Start 2P",monospace';c.textAlign='center';c.fillText('ARROW KEYS TO MOVE',cv.width/2,cv.height-10);c.textAlign='left';}
  }

  destroy() { cancelAnimationFrame(this.raf); window.removeEventListener('keydown',this._onKey); }
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
