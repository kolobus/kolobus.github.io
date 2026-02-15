    /* ═══════════════════════════════════════
       Constants
       ═══════════════════════════════════════ */
    const COLS = 90;
    const ROWS = 45;

    const el = document.getElementById('game');

    /* ═══════════════════════════════════════
       Screen Fitting
       ═══════════════════════════════════════ */
    function fitScreen() {
      const scr = document.querySelector('.screen');
      if (!scr) return;

      const sw = scr.clientWidth - 20;
      const sh = scr.clientHeight - 12;
      const fw = sw / (COLS * 0.602);
      const fh = sh / (ROWS * 1.15);

      el.style.fontSize = Math.max(4, Math.floor(Math.min(fw, fh))) + 'px';
    }

    window.addEventListener('resize', fitScreen);
    setTimeout(fitScreen, 50);
    new ResizeObserver(fitScreen).observe(document.querySelector('.screen'));

    /* ═══════════════════════════════════════
       Sprites
       ═══════════════════════════════════════ */

    // Hero — round little guy
    const HERO_STAND  = [" (o) ", "/|#|\\", "  | ",  " d b"];
    const HERO_RUN    = [" (o) ", "\\|#|/", " |  ",  "d  b"];
    const HERO_CLIMB  = [" (o) ", "-|#|-", "  |  ",  " | | "];
    const HERO_JUMP   = ["\\(o)/", "  #  ", "  |  ",  " / \\"];
    const HERO_DEAD   = [" (x) ", "/|#|\\", "  |  ",  " V V"];

    // Kong — idle
    const KONG_IDLE = [
      "    .######.    ",
      "   ##''##''##   ",
      "  ##''####''##  ",
      "  #''#(OO)#''#  ",
      "   ##(~  ~)##   ",
      "   ##(~~~~)##   ",
      "  .##''##''##.  ",
      " /##''####''##\\ ",
      "|##''######''##|",
      " \\##''####''##/ ",
      "   ##''##''##   ",
      "   |##|  |##|   ",
      "   |##|  |##|   ",
      "  /###|  |###\\  ",
    ];

    // Kong — throwing
    const KONG_THROW = [
      "    .######.    ",
      "   ##''##''##   ",
      "  ##''####''##  ",
      "  #''#(OO)#''#  ",
      "   ##(>  <)##   ",
      "   ##(~~~~)##   ",
      "  .##''##''####.",
      " /##''####''####",
      "|##''########'' ",
      " \\##''####''##  ",
      "   ##''##''##   ",
      "   |##|  |##|   ",
      "   |##|  |##|   ",
      "  /###|  |###\\  ",
    ];

    // Barrel — 4 rotation frames
    const BARREL_FRAMES = [
      ["(####)", "(#///)", "(####)"],
      ["(####)", "(#---)", "(####)"],
      ["(####)", "(#\\\\\\)", "(####)"],
      ["(####)", "(#|||)", "(####)"],
    ];

    // Princess
    const PRINCESS = [" .vv. ", "( oo )", "( -- )", "/|##|\\", "/|##|\\", "  ||  ", " _/\\_ "];

    /* ═══════════════════════════════════════
       Level Layout
       ═══════════════════════════════════════ */
    const PLATFORMS = [
      { y: 42, x1: 0,  x2: 89 },  // ground
      { y: 35, x1: 0,  x2: 89 },
      { y: 28, x1: 0,  x2: 89 },
      { y: 21, x1: 0,  x2: 89 },
      { y: 14, x1: 0,  x2: 89 },
      { y: 8,  x1: 18, x2: 70 },  // top — Kong's platform
    ];

    const LADDERS = [
      // Ground → 2nd (2 paths)
      { x: 75, y1: 35, y2: 42 },
      { x: 45, y1: 35, y2: 42 },
      // 2nd → 3rd
      { x: 15, y1: 28, y2: 35 },
      { x: 65, y1: 28, y2: 35 },
      // 3rd → 4th
      { x: 25, y1: 21, y2: 28 },
      { x: 75, y1: 21, y2: 28 },
      // 4th → 5th
      { x: 15, y1: 14, y2: 21 },
      { x: 55, y1: 14, y2: 21 },
      // 5th → top
      { x: 40, y1: 8,  y2: 14 },
      { x: 60, y1: 8,  y2: 14 },
    ];

    const PRINCESS_POS = { x: 58, y: 1 };
    const KONG_POS     = { x: 22, y: 2 };

    /* ═══════════════════════════════════════
       Game State
       ═══════════════════════════════════════ */
    let hero, barrels, lives, gameState, tick, kongTimer, deathTimer;

    function resetGame() {
      hero = {
        x: 6, y: PLATFORMS[0].y - 1,
        vy: 0, dir: 1,
        climb: false, jump: false,
        frame: 0, dead: false
      };
      barrels = [];
      spawnInitialBarrels();
      lives = 3;
      gameState = 'title';
      tick = 0;
      kongTimer = 0;
      deathTimer = 0;
    }

    function spawnInitialBarrels() {
      [PLATFORMS[2], PLATFORMS[3], PLATFORMS[4]].forEach(plat => {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const px = plat.x1 + 10 + Math.floor(Math.random() * (plat.x2 - plat.x1 - 20));
          barrels.push({
            x: px, y: plat.y - 1,
            vx: (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random() * 0.5),
            vy: 0, f: Math.floor(Math.random() * 20),
            falling: false
          });
        }
      });
    }

    resetGame();

    /* ═══════════════════════════════════════
       Text Buffer
       ═══════════════════════════════════════ */
    let buf;

    function clearBuffer() {
      buf = [];
      for (let y = 0; y < ROWS; y++) {
        buf[y] = [];
        for (let x = 0; x < COLS; x++) buf[y][x] = ' ';
      }
    }

    function putString(str, x, y) {
      for (let i = 0; i < str.length; i++) {
        const cx = x + i;
        if (cx >= 0 && cx < COLS && y >= 0 && y < ROWS && str[i] !== ' ') {
          buf[y][cx] = str[i];
        }
      }
    }

    function putSprite(sprite, x, y) {
      for (let r = 0; r < sprite.length; r++) {
        putString(sprite[r], x, y + r);
      }
    }

    function flushBuffer() {
      el.textContent = buf.map(row => row.join('')).join('\n');
    }

    /* ═══════════════════════════════════════
       Physics Helpers
       ═══════════════════════════════════════ */
    function isOnSurface(x, y) {
      return PLATFORMS.some(p => y === p.y - 1 && x >= p.x1 && x <= p.x2);
    }

    function standingOn(x, y) {
      for (let d = 0; d < 3; d++) {
        if (isOnSurface(x + d, y)) return true;
      }
      return false;
    }

    function surfaceBelow(x, y) {
      let best = Infinity;
      for (const p of PLATFORMS) {
        if (p.y - 1 > y && x >= p.x1 && x <= p.x2 && p.y - 1 < best) {
          best = p.y - 1;
        }
      }
      return best < Infinity ? best : -1;
    }

    function atLadder(x, y) {
      return LADDERS.some(l =>
        y >= l.y1 && y <= l.y2 && x + 4 >= l.x && x <= l.x + 1
      );
    }

    function findCurrentLadder(x, y) {
      return LADDERS.find(l =>
        y >= l.y1 - 1 && y <= l.y2 + 1 && x + 4 >= l.x && x <= l.x + 1
      ) || null;
    }

    /* ═══════════════════════════════════════
       Input
       ═══════════════════════════════════════ */
    const keys = {};
    const BLOCKED_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (BLOCKED_KEYS.includes(e.code)) e.preventDefault();
      if (e.code === 'Enter' && gameState !== 'playing') {
        resetGame();
        gameState = 'playing';
      }
    });

    document.addEventListener('keyup', e => { keys[e.code] = false; });

    function pressed(primary, alt) {
      return keys[primary] || keys[alt];
    }

    /* ═══════════════════════════════════════
       Game Logic
       ═══════════════════════════════════════ */
    function killHero() {
      hero.dead = true;
      lives--;
      deathTimer = 50;
    }

    function updateHero() {
      const onGround = standingOn(hero.x, hero.y);
      const onLadder = atLadder(hero.x, hero.y);
      const ladBelow = atLadder(hero.x, hero.y + 1);

      if (hero.climb) {
        const curLad = findCurrentLadder(hero.x, hero.y);

        // Climb up
        if (pressed('ArrowUp', 'KeyW')) {
          if (curLad && hero.y - 1 >= curLad.y1 - 1) { hero.y--; hero.frame++; }
          if (curLad && hero.y <= curLad.y1 && standingOn(hero.x, curLad.y1 - 1)) {
            hero.y = curLad.y1 - 1;
            hero.climb = false;
          }
        }

        // Climb down
        if (pressed('ArrowDown', 'KeyS')) {
          if (curLad && hero.y < curLad.y2 - 2) { hero.y++; hero.frame++; }
        }

        // Auto-exit ladder when on platform and not pressing up/down
        if (standingOn(hero.x, hero.y) &&
            !pressed('ArrowUp', 'KeyW') &&
            !pressed('ArrowDown', 'KeyS')) {
          hero.climb = false;
        }

        // Walk off ladder onto platform
        if (pressed('ArrowLeft', 'KeyA') && standingOn(hero.x, hero.y)) {
          hero.x--; hero.climb = false; hero.dir = -1; hero.frame++;
        }
        if (pressed('ArrowRight', 'KeyD') && standingOn(hero.x, hero.y)) {
          hero.x++; hero.climb = false; hero.dir = 1; hero.frame++;
        }

        // Safety: detach if ladder lost
        if (!curLad && !standingOn(hero.x, hero.y)) hero.climb = false;

      } else {
        // Walk left/right — only on platform
        if (pressed('ArrowLeft', 'KeyA')) {
          const nx = hero.x - 1;
          if (nx >= 0 && standingOn(nx, hero.y)) { hero.x = nx; hero.dir = -1; hero.frame++; }
        }
        if (pressed('ArrowRight', 'KeyD')) {
          const nx = hero.x + 1;
          if (nx <= COLS - 4 && standingOn(nx, hero.y)) { hero.x = nx; hero.dir = 1; hero.frame++; }
        }

        // Enter ladder
        if (pressed('ArrowUp', 'KeyW') && onLadder)  { hero.climb = true; hero.y--; }
        if (pressed('ArrowDown', 'KeyS') && ladBelow) { hero.climb = true; hero.y++; }

        // Jump
        if (keys['Space'] && onGround && !hero.jump) { hero.vy = -2; hero.jump = true; }
      }

      // Gravity
      if (!hero.climb) {
        if (hero.jump || !onGround) {
          hero.vy += 0.35;
          hero.y += hero.vy;
          const ry = Math.round(hero.y);
          if (hero.vy > 0 && standingOn(hero.x, ry)) {
            hero.y = ry; hero.vy = 0; hero.jump = false;
          }
        }
      } else {
        hero.vy = 0;
      }

      // Bounds
      hero.x = Math.max(0, Math.min(COLS - 6, hero.x));
      if (hero.y > ROWS) { killHero(); return; }

      // Win condition — reach princess
      if (Math.abs(hero.x - PRINCESS_POS.x) < 6 && hero.y <= PRINCESS_POS.y + 7) {
        gameState = 'win';
      }
    }

    function updateBarrels() {
      // Kong throws a new barrel periodically
      if (kongTimer > 0) kongTimer--;
      if (tick % 60 === 0) {
        kongTimer = 25;
        const dir = Math.random() < 0.5 ? 1 : -1;
        barrels.push({
          x: KONG_POS.x + 14, y: 7,
          vx: dir * (1 + Math.random() * 0.5),
          vy: 0, f: 0, falling: false
        });
      }

      for (let i = barrels.length - 1; i >= 0; i--) {
        const b = barrels[i];
        b.f++;
        if (b.f % 3 !== 0) continue;

        if (b.falling) {
          // Fall vertically along ladder
          b.y++;
          if (standingOn(Math.round(b.x), Math.round(b.y))) {
            b.falling = false;
            b.vx = (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random() * 0.5);
          }
          if (b.y > ROWS) { barrels.splice(i, 1); continue; }

        } else {
          // Roll horizontally
          b.x += b.vx > 0 ? 1 : -1;

          if (!standingOn(Math.round(b.x), Math.round(b.y))) {
            const s = surfaceBelow(Math.round(b.x), Math.round(b.y));
            if (s < 0) { barrels.splice(i, 1); continue; }
            b.y = s;
          }

          // Bounce off edges
          if (b.x <= 1 || b.x >= COLS - 7) b.vx = -b.vx;

          // Random chance to fall down a ladder
          for (const l of LADDERS) {
            const bx = Math.round(b.x) + 1;
            if (bx >= l.x && bx <= l.x + 2 && Math.abs(Math.round(b.y) - l.y1) < 3) {
              if (Math.random() < 0.35) { b.x = l.x; b.falling = true; break; }
            }
          }
        }

        // Collision with hero
        if (Math.abs(b.x - hero.x) < 5 && Math.abs(Math.round(b.y) - Math.round(hero.y)) < 2) {
          killHero();
          return;
        }
      }
    }

    function update() {
      if (gameState !== 'playing') return;
      tick++;

      // Death cooldown
      if (hero.dead) {
        deathTimer--;
        if (deathTimer <= 0) {
          if (lives <= 0) { gameState = 'gameover'; return; }
          hero.dead = false;
          hero.x = 6;
          hero.y = PLATFORMS[0].y - 1;
          hero.vy = 0;
          hero.climb = false;
          hero.jump = false;
          barrels = [];
          spawnInitialBarrels();
        }
        return;
      }

      updateHero();
      updateBarrels();
    }

    /* ═══════════════════════════════════════
       Rendering
       ═══════════════════════════════════════ */
    function drawLevel() {
      // Ladders (behind platforms)
      for (const l of LADDERS) {
        for (let y = l.y1; y <= l.y2; y++) {
          if (y >= ROWS) continue;
          if (l.x - 1 >= 0)  buf[y][l.x - 1] = '|';
          buf[y][l.x] = 'H';
          buf[y][l.x + 1] = 'H';
          if (l.x + 2 < COLS) buf[y][l.x + 2] = '|';
        }
      }

      // Platforms (2 rows thick)
      for (const p of PLATFORMS) {
        for (let x = p.x1; x <= p.x2 && x < COLS; x++) {
          buf[p.y][x] = (x % 6 < 3) ? '#' : '%';
          if (p.y + 1 < ROWS) buf[p.y + 1][x] = (x % 6 < 3) ? '%' : '#';
        }
      }
    }

    function drawEntities() {
      // Kong
      putSprite(kongTimer > 0 ? KONG_THROW : KONG_IDLE, KONG_POS.x, KONG_POS.y);

      // Princess
      putSprite(PRINCESS, PRINCESS_POS.x, PRINCESS_POS.y);
      if (tick % 80 < 40) putString("HELP!", PRINCESS_POS.x + 1, PRINCESS_POS.y - 1);

      // Barrels
      for (const b of barrels) {
        const frame = BARREL_FRAMES[Math.floor(b.f / 4) % 4];
        putSprite(frame, Math.round(b.x), Math.round(b.y) - 2);
      }

      // Hero
      if (!hero.dead || Math.floor(tick / 6) % 2 === 0) {
        let sprite;
        if (hero.dead)        sprite = HERO_DEAD;
        else if (hero.climb)  sprite = HERO_CLIMB;
        else if (hero.jump)   sprite = HERO_JUMP;
        else                  sprite = (hero.frame % 8 < 4) ? HERO_STAND : HERO_RUN;

        putSprite(sprite, Math.round(hero.x), Math.round(hero.y) - sprite.length + 1);
      }
    }

    function drawHUD() {
      for (let i = 0; i < lives; i++) buf[0][2 + i * 2] = '*';

      putString("+------+", COLS - 9, 0);
      putString("| KONG |", COLS - 9, 1);
      putString("+------+", COLS - 9, 2);
    }

    function renderTitle() {
      putString("#  # #### #  # ####", 35, 10);
      putString("# #  #  # ## # #   ", 35, 11);
      putString("##   #  # # ## # ##", 35, 12);
      putString("# #  #  # #  # #  #", 35, 13);
      putString("#  # #### #  # ####", 35, 14);

      putSprite(KONG_IDLE, 37, 18);
      putSprite(HERO_STAND, 30, 34);
      putString("~>", 36, 35);
      putSprite(PRINCESS, 55, 33);

      if (tick % 40 < 20) putString("[ PRESS ENTER ]", 36, 38);
      putString("ARROWS / WASD    SPACE = JUMP", 28, 40);
      tick++;
    }

    function renderGameOver() {
      putString("G A M E   O V E R", 35, 16);
      putSprite(HERO_DEAD, 42, 20);
      if (tick % 40 < 20) putString("[ ENTER ]", 40, 32);
      tick++;
    }

    function renderWin() {
      putString("Y O U   W I N !", 36, 14);
      putSprite(HERO_STAND, 38, 20);
      putString("<3", 44, 21);
      putSprite(PRINCESS, 47, 19);
      if (tick % 40 < 20) putString("[ ENTER ]", 40, 32);
      tick++;
    }

    function render() {
      clearBuffer();

      switch (gameState) {
        case 'title':    renderTitle();    break;
        case 'gameover': renderGameOver(); break;
        case 'win':      renderWin();      break;
        case 'playing':
          drawLevel();
          drawEntities();
          drawHUD();
          break;
      }

      flushBuffer();
    }

    /* ═══════════════════════════════════════
       Main Loop
       ═══════════════════════════════════════ */
    let lastUpdate = 0;

    function gameLoop(timestamp) {
      if (timestamp - lastUpdate > 50) {
        lastUpdate = timestamp;
        update();
      }
      render();
      requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
