/*
  script.js
  ---------
  This is the "brain" of the game — written in 100% pure JavaScript.
  No libraries, no internet needed. It does three big jobs:

    1) MENUS   – show/hide the menu screens when buttons are clicked.
    2) WORLD   – draw a 3D view of the maze using "raycasting" (see Part 9).
    3) PLAY    – first-person movement, mouse look, jumping, ghosts chasing you.

  HOW CAN PLAIN JAVASCRIPT DRAW 3D?
  We use a trick called RAYCASTING — the same trick the very first 3D games
  (like Wolfenstein 3D, 1992) used. Imagine standing in a dark maze with a
  flashlight: for every thin column of the screen we shine one "ray" forward
  and ask "how far away is the wall in this direction?". Close walls are drawn
  TALL, far walls are drawn SHORT. Do that for 640 columns and your brain
  sees a 3D corridor. It's all just 2D rectangles drawn very cleverly!

  Read it top to bottom like a story — every part has a comment that
  explains WHAT it does and WHY.
*/

/* =====================================================================
   PART 1 — MENU NAVIGATION
   Real-world idea: like tapping between screens in a phone app.
   We show ONE screen at a time by adding/removing the "active" class.
   ===================================================================== */

// Grab every screen element once, so we can switch between them.
const screens = {
  main: document.getElementById("main-menu"),
  instructions: document.getElementById("instructions-menu"),
  rules: document.getElementById("rules-menu"),
  game: document.getElementById("game-screen"),
};

// Show one screen and hide all the others.
function showScreen(name) {
  for (const key in screens) {
    screens[key].classList.toggle("active", key === name);
  }
}

// Every menu button carries a "data-action" telling us what it should do.
document.addEventListener("click", (event) => {
  const action = event.target.dataset.action; // e.g. "start", "show-rules"
  if (!action) return;

  if (action === "start") {
    showScreen("game");
    startGame();
  } else if (action === "show-instructions") {
    showScreen("instructions");
  } else if (action === "show-rules") {
    showScreen("rules");
  } else if (action === "back-to-main") {
    showScreen("main");
  }
});

// The "Quit" button inside the game returns to the main menu.
document.getElementById("hud-quit").addEventListener("click", () => {
  stopGame();
  showScreen("main");
});

/* =====================================================================
   PART 2 — LEVEL MAPS
   Each level is drawn as a grid of letters, like a picture made of text.
   This makes it super easy to design new levels: just draw them!

   Legend (what each letter means):
     #  = wall            (you cannot walk through it)
     S  = start           (where the player begins)
     E  = exit door       (walk into it after all coins are collected)
     C  = coin            (collect all of them to open the door)
     G  = ghost           (a spooky enemy that hunts you — don't get caught!)
     P  = hurdle          (a low orange block — JUMP over it!)
     B  = barrier         (a red block that slides back and forth)
     (space) = open floor (safe to walk on)

   Difficulty grows every level: bigger mazes, more coins,
   and more (and faster!) ghosts.
   ===================================================================== */

const LEVELS = [
  // ----- Level 1: small maze, 3 coins, 1 slow ghost. Learn the ropes. -----
  [
    "#########",
    "#S  C   #",
    "# ### # #",
    "#   # C #",
    "### # ###",
    "#C  # G #",
    "# ##### #",
    "#      E#",
    "#########",
  ],

  // ----- Level 2: bigger, 4 coins, 2 ghosts. -----
  [
    "###########",
    "#S  C #  C#",
    "# ### # # #",
    "#   #   # #",
    "# # ### # #",
    "# #  G  # #",
    "# # ### # #",
    "#C#   #  G#",
    "# ### # ###",
    "#    C#  E#",
    "###########",
  ],

  // ----- Level 3: adds HURDLES (P) to jump and a moving BARRIER (B). -----
  [
    "#############",
    "#S   C    P #",
    "# ####### # #",
    "# #  G  # C #",
    "# # ### ### #",
    "# # B     # #",
    "# # ##### # #",
    "# C   P # C #",
    "# ##### # # #",
    "#     G   # #",
    "##### ##### #",
    "#    C    E #",
    "#############",
  ],

  // ----- Level 4: 3 ghosts, hurdles AND a barrier. Stay sharp! -----
  [
    "###############",
    "#S  C # P C   #",
    "# ### # ### ###",
    "# #   #   #  C#",
    "# # ##### ## ##",
    "# #  G #   B  #",
    "# #### # #### #",
    "#  C # #  G # #",
    "## # # #### # #",
    "#  # #    # # #",
    "# ## ## # # # #",
    "# #   C # C # #",
    "# # ##### ## ##",
    "#    G #    E #",
    "###############",
  ],

  // ----- Level 5: the final challenge. 4 fast ghosts in a big maze. -----
  [
    "#################",
    "#S  C #   C#   C#",
    "# ## ## ## # # ##",
    "# #  G   # #C#  #",
    "# # #### # # ## #",
    "# #    # #G     #",
    "# ## # # # # ####",
    "#  C # #   #   C#",
    "#### # ##### ## #",
    "#  # #  B  #  # #",
    "# ## ##### ## # #",
    "# #  G  #   # # #",
    "# # ### # # # # #",
    "# #C  # C # #G# #",
    "# ### ##### # # #",
    "#     #     #  E#",
    "#################",
  ],
];

// How fast ghosts move on each level (maze squares per frame).
// The player moves at 0.07, so even the fastest ghost can be outrun.
const GHOST_SPEEDS = [0.01, 0.025, 0.035, 0.042, 0.05];

// Classic ghost colors, used in order: red, pink, cyan, orange.
const GHOST_COLORS = ["#ff4444", "#ff9ff3", "#48dbfb", "#ffa94d"];

/* =====================================================================
   PART 3 — THE CANVAS AND THE SPRITE ART
   We draw everything ourselves onto a <canvas> (a blank drawing board).
   The coins, ghosts and barriers are small pictures ("sprites") that we
   paint ONCE onto hidden mini-canvases, then stamp into the 3D view.
   That's much faster than redrawing the shapes 60 times a second.
   ===================================================================== */

const W = 640; // how many columns (rays) we draw — the picture's width
let H = 400; // picture height; recalculated to match your window shape

let canvas, ctx; // the visible drawing board and its "pen"
let skyGradient, floorGradient; // pretty background colors, made once
const zBuffer = new Float64Array(W); // wall distance per column (see Part 9)

// Pre-drawn sprite pictures (filled in by makeSpriteArt below).
let coinArt, barrierArt;
const ghostArts = [];

// A helper: create a small hidden canvas and let a function draw on it.
function makeArt(drawFn) {
  const art = document.createElement("canvas");
  art.width = 64;
  art.height = 64;
  drawFn(art.getContext("2d"));
  return art;
}

// Draw all the sprite pictures once, at startup.
function makeSpriteArt() {
  // --- The coin: a shiny gold circle. ---
  coinArt = makeArt((a) => {
    a.fillStyle = "#ffd43b"; // gold face
    a.beginPath();
    a.arc(32, 32, 28, 0, Math.PI * 2);
    a.fill();
    a.strokeStyle = "#e8a800"; // darker gold rim
    a.lineWidth = 6;
    a.stroke();
    a.fillStyle = "#fff3bf"; // a little light sparkle
    a.beginPath();
    a.arc(22, 22, 7, 0, Math.PI * 2);
    a.fill();
  });

  // --- The barrier: a red warning block. ---
  barrierArt = makeArt((a) => {
    a.fillStyle = "#ff6b6b";
    a.fillRect(2, 2, 60, 60);
    a.strokeStyle = "#c92a2a"; // dark red border
    a.lineWidth = 8;
    a.strokeRect(4, 4, 56, 56);
    a.fillStyle = "#c92a2a"; // two danger stripes
    a.fillRect(12, 26, 40, 5);
    a.fillRect(12, 36, 40, 5);
  });

  // --- The ghosts: one picture per color, like Pac-Man's ghosts. ---
  for (const color of GHOST_COLORS) {
    ghostArts.push(
      makeArt((a) => {
        a.fillStyle = color;
        // Round head (a half circle) + body (a rectangle).
        a.beginPath();
        a.arc(32, 26, 24, Math.PI, 0);
        a.fill();
        a.fillRect(8, 26, 48, 26);
        // Wavy "skirt": four little bumps along the bottom edge.
        for (const bx of [14, 26, 38, 50]) {
          a.beginPath();
          a.arc(bx, 52, 6, 0, Math.PI);
          a.fill();
        }
        // Two big cartoon eyes so it looks silly, not scary.
        for (const ex of [22, 42]) {
          a.fillStyle = "#ffffff";
          a.beginPath();
          a.arc(ex, 26, 8, 0, Math.PI * 2);
          a.fill();
          a.fillStyle = "#2b3a67"; // dark blue pupils
          a.beginPath();
          a.arc(ex + 2, 27, 4, 0, Math.PI * 2);
          a.fill();
          a.fillStyle = color; // back to body color for the next eye
        }
      }),
    );
  }
}

// Prepare the canvas. Runs once at startup.
function setupCanvas() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  onWindowResize();
  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  // We always draw W columns wide; the height copies your window's shape
  // so the picture is never squashed. CSS then stretches it full-screen.
  H = Math.max(200, Math.round(W * (window.innerHeight / window.innerWidth)));
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false; // keep the retro look crisp, not blurry

  // Sky: light blue fading down. Floor: soft green fading away.
  skyGradient = ctx.createLinearGradient(0, 0, 0, H / 2);
  skyGradient.addColorStop(0, "#5bc8f5");
  skyGradient.addColorStop(1, "#cdf1ff");
  floorGradient = ctx.createLinearGradient(0, H / 2, 0, H);
  floorGradient.addColorStop(0, "#6fbf9a");
  floorGradient.addColorStop(1, "#9ad0c2");
}

/* =====================================================================
   PART 3.5 — SOUND EFFECTS
   Three .mp3 files in /sounds, loaded once and reused (no libraries).
   encodeURI turns the spaces in the filenames into %20 so the browser
   can find them.
   ===================================================================== */

const startMusic = new Audio(encodeURI("sounds/pacman Start Music.mp3"));
startMusic.volume = 0.4;

const failSound = new Audio(encodeURI("sounds/pacman fail.mp3"));
failSound.volume = 0.7;

const creditSound = new Audio(encodeURI("sounds/pacman Credit Sound.mp3"));
creditSound.volume = 0.7;

// Play a one-shot sound from the start, even if it's already playing.
function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {}); // browsers block audio before any click; ignore
}

/* =====================================================================
   PART 4 — GAME STATE
   These variables remember everything about the CURRENT level.
   One maze square = 1 unit of space. Walls are 1 unit tall.
   ===================================================================== */

let currentLevel = 0;
let mapGrid = null; // the current level's text map
let paused = false; // true while a message ("Level Complete!") shows
let animationId = null; // id of the game loop, so we can stop it

let coins = []; // coins still to collect: {x, z, phase}
let coinsTotal = 0;
let ghosts = []; // the enemies chasing the player
let barriers = []; // sliding blocks: {baseX, z, x, phase, ...}
let exitCell = null; // {col, row} of the door
let startCell = null; // {col, row} where the player begins

// The player. In first person you don't see yourself — you ARE the camera.
const player = {
  x: 0,
  z: 0, // position in the maze (in squares)
  angle: 0, // which way you face (radians) — the mouse turns this
  pitch: 0, // looking up/down — the mouse tilts this
  jumpY: 0, // how high your feet are above the floor
  vy: 0, // vertical speed (used while jumping)
  onGround: true,
};

// Which movement keys are currently held down.
const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  jump: false,
};

// Tuning numbers. Change these to make the game feel different.
const MOVE_SPEED = 0.04; // walking speed (squares per frame)
const PLAYER_RADIUS = 0.22; // how "wide" the player is, for wall bumping
const GRAVITY = 0.003; // pulls the player down while jumping
const JUMP_POWER = 0.05; // how hard a jump pushes up
const HURDLE_HEIGHT = 0.35; // hurdles block you unless you jump this high
const MOUSE_SENSITIVITY = 0.0025; // how much the view turns per pixel of mouse
const FOV = 0.66; // field of view — how wide the camera sees

/* =====================================================================
   PART 5 — BUILDING A LEVEL
   We read the text map letter by letter and note where everything is.
   (No 3D objects to create — the raycaster reads the map directly!)
   ===================================================================== */

// What letter is on this maze square? Out-of-bounds counts as a wall,
// so the player and the ghosts can never escape the maze.
function cellAt(col, row) {
  if (row < 0 || row >= mapGrid.length) return "#";
  if (col < 0 || col >= mapGrid[row].length) return "#";
  return mapGrid[row][col];
}

function buildLevel(levelIndex) {
  mapGrid = LEVELS[levelIndex];

  // Start fresh: empty out all the lists from the previous level.
  coins = [];
  ghosts = [];
  barriers = [];
  coinsTotal = 0;

  let ghostCount = 0; // used to give each ghost a different color

  for (let row = 0; row < mapGrid.length; row++) {
    for (let col = 0; col < mapGrid[row].length; col++) {
      const char = mapGrid[row][col];
      // "+ 0.5" puts things in the CENTER of their square, not the corner.
      const wx = col + 0.5;
      const wz = row + 0.5;

      if (char === "S") {
        startCell = { col, row };
      } else if (char === "E") {
        exitCell = { col, row };
      } else if (char === "C") {
        // "phase" gives each coin its own bobbing rhythm.
        coins.push({ x: wx, z: wz, phase: Math.random() * 6 });
        coinsTotal++;
      } else if (char === "G") {
        ghosts.push({
          col,
          row,
          targetCol: col,
          targetRow: row, // the square it's walking toward
          dirC: 0,
          dirR: 0, // current direction
          x: wx,
          z: wz,
          speed: GHOST_SPEEDS[levelIndex],
          art: ghostArts[ghostCount % ghostArts.length],
        });
        ghostCount++;
      } else if (char === "B") {
        barriers.push({
          baseX: wx,
          z: wz,
          x: wx,
          range: 1.2, // how far it slides (in squares)
          speed: 0.02, // how fast it slides
          phase: Math.random() * 6, // start at a random point in the motion
        });
      }
      // '#' walls and 'P' hurdles need no setup — the raycaster and the
      // collision check read them straight from the text map.
    }
  }

  respawnPlayer();
}

// Put the player at the start square, facing east (into the open maze).
function respawnPlayer() {
  player.x = startCell.col + 0.5;
  player.z = startCell.row + 0.5;
  player.angle = Math.PI / 2; // east — every level opens up to the right
  player.pitch = 0;
  player.jumpY = 0;
  player.vy = 0;
  player.onGround = true;
}

// The exit door is open once every coin has been collected.
function doorIsOpen() {
  return coins.length === 0;
}

/* =====================================================================
   PART 6 — GHOSTS 👻
   Ghost brain (very simple, like Pac-Man's):
     - A ghost always walks from one maze square to the next.
     - At each square it asks: "which direction gets me CLOSER to the player?"
     - It never turns around unless it hits a dead end.
     - Sometimes (25%) it picks a random direction, so it's not too cruel.
   ===================================================================== */

// Can a ghost walk on this square? Walls, hurdles, barriers and the door
// block it (ghosts can't jump, and they may not guard the exit!).
function ghostCanWalk(col, row) {
  const ch = cellAt(col, row);
  return ch !== "#" && ch !== "P" && ch !== "B" && ch !== "E";
}

// The ghost reached a square: decide which neighboring square to walk to next.
function chooseNextCell(g) {
  // Where is the player, in maze squares?
  const pCol = Math.floor(player.x);
  const pRow = Math.floor(player.z);

  // The four possible directions: right, left, down, up.
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  // Keep only directions that lead to a walkable square.
  let options = dirs.filter(([dc, dr]) => ghostCanWalk(g.col + dc, g.row + dr));
  if (options.length === 0) return; // completely boxed in: stand still

  // Don't turn around unless it's the only way out (classic Pac-Man rule —
  // it stops ghosts from jittering back and forth in a corridor).
  const forward = options.filter(
    ([dc, dr]) => !(dc === -g.dirC && dr === -g.dirR),
  );
  if (forward.length > 0) options = forward;

  let choice;
  if (Math.random() < 0.25) {
    // 25% of the time: wander randomly. This keeps the game fair and fun.
    choice = options[Math.floor(Math.random() * options.length)];
  } else {
    // Otherwise: pick the direction that gets closest to the player.
    let bestDist = Infinity;
    for (const [dc, dr] of options) {
      const distC = g.col + dc - pCol;
      const distR = g.row + dr - pRow;
      const dist = distC * distC + distR * distR; // squared distance (no sqrt needed)
      if (dist < bestDist) {
        bestDist = dist;
        choice = [dc, dr];
      }
    }
  }

  g.dirC = choice[0];
  g.dirR = choice[1];
  g.targetCol = g.col + g.dirC;
  g.targetRow = g.row + g.dirR;
}

// Called every frame: slide each ghost toward its target square,
// pick a new target when it arrives, and check if it caught the player.
function updateGhosts() {
  for (const g of ghosts) {
    const tx = g.targetCol + 0.5; // center of the target square
    const tz = g.targetRow + 0.5;
    const dx = tx - g.x;
    const dz = tz - g.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= g.speed) {
      // Arrived: snap to the square and choose the next one.
      g.x = tx;
      g.z = tz;
      g.col = g.targetCol;
      g.row = g.targetRow;
      chooseNextCell(g);
    } else {
      // Still traveling: take one small step toward the target.
      g.x += (dx / dist) * g.speed;
      g.z += (dz / dist) * g.speed;
    }

    // --- Did the ghost catch the player? ---
    const px = player.x - g.x;
    const pz = player.z - g.z;
    if (Math.sqrt(px * px + pz * pz) < 0.4) {
      onPlayerCaught();
      return; // stop checking; the game is ending
    }
  }
}

// The player was caught: game over, back to the main menu.
function onPlayerCaught() {
  paused = true; // freeze the world
  document.exitPointerLock(); // give the mouse back
  startMusic.pause();
  playSound(failSound);
  showMessage("👻 A ghost caught you! Game Over");
  setTimeout(() => {
    hideMessage();
    stopGame();
    showScreen("main");
    currentLevel = 0;
  }, 2500);
}

/* =====================================================================
   PART 7 — CONTROLS (keyboard + mouse)
   Real-world idea: like turning your head (mouse) while walking (keys).
   The mouse only steers while "pointer lock" is on — the browser feature
   that hides the cursor and reports raw mouse movement, exactly like
   every first-person game you've played.
   ===================================================================== */

function onKeyDown(e) {
  updateKey(e.code, true);
  // Stop the arrow keys and space from scrolling the page.
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
      e.code,
    )
  ) {
    e.preventDefault();
  }
}
function onKeyUp(e) {
  updateKey(e.code, false);
}

// Turn a physical key into one of our movement flags.
function updateKey(code, isDown) {
  if (code === "ArrowUp" || code === "KeyW") keys.forward = isDown;
  else if (code === "ArrowDown" || code === "KeyS") keys.back = isDown;
  else if (code === "ArrowLeft" || code === "KeyA") keys.left = isDown;
  else if (code === "ArrowRight" || code === "KeyD") keys.right = isDown;
  else if (code === "Space") keys.jump = isDown;
}

// Mouse look: runs whenever the mouse moves while pointer lock is active.
function onMouseLook(e) {
  if (document.pointerLockElement !== canvas) return; // mouse not captured

  // movementX/Y = how many pixels the mouse moved since the last event.
  player.angle += e.movementX * MOUSE_SENSITIVITY; // turn left/right
  player.pitch -= e.movementY * 0.0015; // look up/down

  // Clamp the pitch so you can't flip your head upside down.
  player.pitch = Math.max(-0.4, Math.min(0.4, player.pitch));
}

// Set up pointer lock: clicking the game captures the mouse; Esc releases it.
function setupPointerLock() {
  const hint = document.getElementById("lock-hint");

  canvas.addEventListener("click", () => {
    if (animationId) canvas.requestPointerLock();
  });

  // Show the "click to look around" hint whenever the mouse is NOT captured.
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    hint.classList.toggle("hidden", locked);
  });

  document.addEventListener("mousemove", onMouseLook);
}

/* =====================================================================
   PART 8 — MOVEMENT, PHYSICS AND COLLISIONS
   ===================================================================== */

// Is the player allowed to stand at position (x, z)?
// We check the four corners of the player's little "bubble" against the map.
function isBlocked(x, z) {
  for (const cx of [
    Math.floor(x - PLAYER_RADIUS),
    Math.floor(x + PLAYER_RADIUS),
  ]) {
    for (const cz of [
      Math.floor(z - PLAYER_RADIUS),
      Math.floor(z + PLAYER_RADIUS),
    ]) {
      const ch = cellAt(cx, cz);
      if (ch === "#") return true; // solid wall
      if (ch === "E" && !doorIsOpen()) return true; // locked door
      if (ch === "P" && player.jumpY < HURDLE_HEIGHT) return true; // hurdle: jump it!
    }
  }
  // Barriers slide around, so they get their own check (a box, not a map square).
  for (const b of barriers) {
    if (
      Math.abs(x - b.x) < 0.45 + PLAYER_RADIUS &&
      Math.abs(z - b.z) < 0.45 + PLAYER_RADIUS
    ) {
      return true;
    }
  }
  return false;
}

// Handle walking (relative to where you're LOOKING), jumping, and gravity.
function movePlayer() {
  // --- 1. Which way is the player trying to go? ---
  // f = forward/back (-1, 0, or 1), s = strafe right/left.
  const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  // "Forward" means "the way you are facing". We turn the facing angle
  // into world steps with sin/cos (school trigonometry doing real work!).
  const dirX = Math.sin(player.angle);
  const dirZ = -Math.cos(player.angle);
  const rightX = Math.cos(player.angle);
  const rightZ = Math.sin(player.angle);

  let dx = (f * dirX + s * rightX) * MOVE_SPEED;
  let dz = (f * dirZ + s * rightZ) * MOVE_SPEED;

  // Walking diagonally would be faster than walking straight —
  // scale it down so every direction is the same speed.
  if (f !== 0 && s !== 0) {
    dx *= 0.7071; // 1 / sqrt(2)
    dz *= 0.7071;
  }

  // Move one axis at a time and skip the move if it bumps a wall. Doing X
  // and Z separately lets the player slide smoothly along walls.
  if (!isBlocked(player.x + dx, player.z)) player.x += dx;
  if (!isBlocked(player.x, player.z + dz)) player.z += dz;

  // --- 2. Jumping: press Space while on the ground. ---
  if (keys.jump && player.onGround) {
    player.vy = JUMP_POWER;
    player.onGround = false;
  }

  // --- 3. Gravity: always pulls the player back down. ---
  if (!player.onGround) {
    player.vy -= GRAVITY;
    player.jumpY += player.vy;
    if (player.jumpY <= 0) {
      // landed
      player.jumpY = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // --- 4. Check if we touched coins or reached the open door. ---
  checkCoins();
  checkExit();
}

// Slide the moving barriers back and forth using a gentle sine wave.
function moveBarriers() {
  for (const b of barriers) {
    b.phase += b.speed;
    // Math.sin swings smoothly between -1 and 1, giving a nice back-and-forth.
    b.x = b.baseX + Math.sin(b.phase) * b.range;
  }
}

// If the player touches a coin, collect it.
function checkCoins() {
  for (let i = coins.length - 1; i >= 0; i--) {
    const dx = player.x - coins[i].x;
    const dz = player.z - coins[i].z;
    if (Math.sqrt(dx * dx + dz * dz) < 0.4) {
      coins.splice(i, 1); // remove the coin from the world
      playSound(creditSound);
      updateHud();
      // (When the LAST coin goes, doorIsOpen() becomes true — the door
      //  turns green on screen and starts letting the player through.)
    }
  }
}

// If the door is open and the player steps into its square: next level!
function checkExit() {
  if (!doorIsOpen()) return;
  if (
    Math.floor(player.x) === exitCell.col &&
    Math.floor(player.z) === exitCell.row
  ) {
    nextLevel();
  }
}

/* =====================================================================
   PART 9 — DRAWING THE 3D VIEW (the raycaster)
   For each of the W columns of the screen we shoot one ray into the maze
   and measure the distance to the wall it hits. Near wall = tall column,
   far wall = short column. That's the whole 3D illusion!
   ===================================================================== */

function render() {
  // Where the ground meets the sky. Looking up/down moves this line.
  const horizon = H * (0.5 + player.pitch);
  // Eye height: half a wall up, plus however high the player has jumped.
  const eye = 0.5 + player.jumpY;

  // --- Sky above the horizon, floor below it. ---
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, W, Math.max(0, horizon));
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, Math.max(0, horizon), W, H);

  // The camera's facing direction and its "plane" (how wide it sees).
  const dirX = Math.sin(player.angle);
  const dirZ = -Math.cos(player.angle);
  const planeX = Math.cos(player.angle) * FOV;
  const planeZ = Math.sin(player.angle) * FOV;

  // ---- Shoot one ray per screen column. ----
  for (let x = 0; x < W; x++) {
    // cameraX goes from -1 (left edge of the screen) to +1 (right edge).
    const cameraX = (2 * x) / W - 1;
    const rayX = dirX + planeX * cameraX;
    const rayZ = dirZ + planeZ * cameraX;

    // Which maze square are we standing in?
    let mapX = Math.floor(player.x);
    let mapZ = Math.floor(player.z);

    // DDA setup (DDA = a classic, fast way to visit every grid square a
    // line passes through — like tracing your finger across graph paper).
    const deltaX = Math.abs(1 / rayX); // Infinity is fine if rayX is 0
    const deltaZ = Math.abs(1 / rayZ);
    const stepX = rayX < 0 ? -1 : 1;
    const stepZ = rayZ < 0 ? -1 : 1;
    let sideDistX =
      rayX < 0 ? (player.x - mapX) * deltaX : (mapX + 1 - player.x) * deltaX;
    let sideDistZ =
      rayZ < 0 ? (player.z - mapZ) * deltaZ : (mapZ + 1 - player.z) * deltaZ;

    let side = 0; // 0 = the ray hit a north/south wall face, 1 = east/west
    let hitChar = "#"; // what the ray finally hit ('#' wall or 'E' door)
    const hurdleDists = []; // hurdles the ray passed THROUGH (we see over them)

    // Walk square by square until we hit something solid.
    for (;;) {
      if (sideDistX < sideDistZ) {
        sideDistX += deltaX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistZ += deltaZ;
        mapZ += stepZ;
        side = 1;
      }
      const ch = cellAt(mapX, mapZ);
      if (ch === "#" || ch === "E") {
        hitChar = ch;
        break; // walls and the door stop the ray
      }
      if (ch === "P") {
        // A hurdle: remember how far away it is, but keep going —
        // it's low, so the maze is visible continuing behind it.
        const d =
          side === 0
            ? (mapX - player.x + (1 - stepX) / 2) / rayX
            : (mapZ - player.z + (1 - stepZ) / 2) / rayZ;
        hurdleDists.push(d);
      }
    }

    // Perpendicular distance (not straight-line!) — this classic trick
    // prevents the "fish-eye lens" bending you'd get otherwise.
    const dist =
      side === 0
        ? (mapX - player.x + (1 - stepX) / 2) / rayX
        : (mapZ - player.z + (1 - stepZ) / 2) / rayZ;
    zBuffer[x] = dist; // sprites behind this wall must not be drawn here

    // Project the wall slice onto the screen: divide by distance —
    // twice as far away = half as tall. That's perspective!
    const bottom = horizon + (eye * H) / dist; // wall base (height 0)
    const top = horizon + ((eye - 1) * H) / dist; // wall top (height 1)

    // Pick the wall color. Faces pointing different ways get different
    // shades — that's what makes corners visible and the world look solid.
    /*
      WALL IMAGES (for later):
      To show a picture on the walls instead of a flat color, load an image
      once at startup:   const wallImg = new Image(); wallImg.src = 'wall.png';
      Then here, instead of fillRect, work out where on the wall this ray
      landed (0..1 across the square) and stamp a 1-pixel-wide strip of it:

        const wallX = side === 0 ? player.z + dist * rayZ : player.x + dist * rayX;
        const texX = Math.floor((wallX - Math.floor(wallX)) * wallImg.width);
        ctx.drawImage(wallImg, texX, 0, 1, wallImg.height, x, top, 1, bottom - top);
    */
    if (hitChar === "E") {
      // The exit door: red while locked, green once all coins are collected.
      ctx.fillStyle = doorIsOpen()
        ? side === 0
          ? "#51cf66"
          : "#3eb85a"
        : side === 0
          ? "#ff6b6b"
          : "#e35555";
    } else {
      ctx.fillStyle = side === 0 ? "#6c5ce7" : "#5a4bd1"; // purple placeholder
    }
    ctx.fillRect(x, top, 1, bottom - top);

    // Draw the hurdles this ray passed through — farthest first, so the
    // nearer ones paint over them correctly.
    for (let i = hurdleDists.length - 1; i >= 0; i--) {
      const hd = hurdleDists[i];
      const hBottom = horizon + (eye * H) / hd;
      const hTop = horizon + ((eye - HURDLE_HEIGHT) * H) / hd;
      ctx.fillStyle = "#ffa94d"; // orange block
      ctx.fillRect(x, hTop, 1, hBottom - hTop);
      if (hd < zBuffer[x]) zBuffer[x] = hd; // hurdles hide sprites behind them too
    }
  }

  drawSprites(horizon, eye, dirX, dirZ, planeX, planeZ);
  drawMinimap();
}

// Draw the coins, ghosts and barriers as "billboards": flat pictures that
// always face the camera, scaled by distance (far away = small).
function drawSprites(horizon, eye, dirX, dirZ, planeX, planeZ) {
  // Gather everything into one list, each with its picture and size.
  const sprites = [];
  for (const c of coins) {
    c.phase += 0.06; // makes the coin bob up and down invitingly
    sprites.push({
      x: c.x,
      z: c.z,
      w: 0.4,
      h: 0.4,
      art: coinArt,
      elevation: 0.3 + Math.sin(c.phase) * 0.08, // floats above the floor
    });
  }
  for (const g of ghosts) {
    sprites.push({ x: g.x, z: g.z, w: 0.7, h: 0.85, art: g.art, elevation: 0 });
  }
  for (const b of barriers) {
    sprites.push({
      x: b.x,
      z: b.z,
      w: 0.95,
      h: 1.0,
      art: barrierArt,
      elevation: 0,
    });
  }

  // This bit of math converts a world position into "camera space":
  // tY = how far IN FRONT of the camera, tX = how far to the SIDE.
  const invDet = 1 / (planeX * dirZ - dirX * planeZ);
  for (const s of sprites) {
    const relX = s.x - player.x;
    const relZ = s.z - player.z;
    s.tX = invDet * (dirZ * relX - dirX * relZ);
    s.tY = invDet * (-planeZ * relX + planeX * relZ);
  }

  // Sort far-to-near, so near sprites are painted over far ones.
  sprites.sort((a, b) => b.tY - a.tY);

  for (const s of sprites) {
    if (s.tY <= 0.05) continue; // behind the camera — invisible

    // Where on screen, and how big? Everything divides by tY (distance).
    const screenX = (W / 2) * (1 + s.tX / s.tY);
    const spriteH = (s.h * H) / s.tY;
    const spriteW = (s.w * H) / s.tY;
    const bottomY = horizon + ((eye - s.elevation) * H) / s.tY;
    const topY = bottomY - spriteH;

    const startX = Math.floor(screenX - spriteW / 2);
    const endX = Math.ceil(screenX + spriteW / 2);

    // Draw the picture one 1-pixel column at a time, skipping columns
    // where a wall is CLOSER than the sprite (so walls hide sprites).
    for (let sx = Math.max(0, startX); sx < Math.min(W, endX); sx++) {
      if (s.tY >= zBuffer[sx]) continue; // a wall is in front here
      const texX = Math.floor(((sx - startX) / (endX - startX)) * 64);
      ctx.drawImage(s.art, texX, 0, 1, 64, sx, topY, 1, spriteH);
    }
  }
}

// A little map in the corner so young players don't get lost.
// It shows the walls, the coins, the door, the ghosts, and you.
function drawMinimap() {
  const scale = 5; // pixels per maze square
  const mw = mapGrid[0].length * scale;
  const mh = mapGrid.length * scale;
  const ox = W - mw - 8; // top-right corner, with a small margin
  const oy = 34;

  // Dark see-through background so the map is readable over the 3D view.
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);

  for (let row = 0; row < mapGrid.length; row++) {
    for (let col = 0; col < mapGrid[row].length; col++) {
      const ch = mapGrid[row][col];
      if (ch === "#") ctx.fillStyle = "#6c5ce7";
      else if (ch === "P") ctx.fillStyle = "#ffa94d";
      else if (ch === "E") ctx.fillStyle = doorIsOpen() ? "#51cf66" : "#ff6b6b";
      else continue; // open floor stays dark
      ctx.fillRect(ox + col * scale, oy + row * scale, scale, scale);
    }
  }

  // Coins (gold dots), ghosts (red dots), and the player (white dot).
  ctx.fillStyle = "#ffd43b";
  for (const c of coins) {
    ctx.fillRect(ox + c.x * scale - 1, oy + c.z * scale - 1, 3, 3);
  }
  ctx.fillStyle = "#ff4444";
  for (const g of ghosts) {
    ctx.fillRect(ox + g.x * scale - 2, oy + g.z * scale - 2, 4, 4);
  }
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ox + player.x * scale, oy + player.z * scale, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/* =====================================================================
   PART 10 — THE GAME LOOP
   Runs about 60 times per second. Each run = one "frame":
   move everything, then draw the whole picture again.
   ===================================================================== */

function gameLoop() {
  animationId = requestAnimationFrame(gameLoop);

  // While a message is showing ("Level Complete!"), the world freezes.
  if (!paused) {
    movePlayer();
    moveBarriers();
    updateGhosts();
  }
  render();
}

/* =====================================================================
   PART 11 — LEVEL FLOW (start, next, win)
   Real-world idea: like unlocking new stages in a game.
   ===================================================================== */

// Load a level by number and refresh the on-screen info.
function loadLevel(index) {
  buildLevel(index);
  updateHud();
  playSound(startMusic);
}

// Advance to the next level, or show the win screen if there are no more.
function nextLevel() {
  paused = true; // freeze while the message shows
  currentLevel++;

  if (currentLevel >= LEVELS.length) {
    // The player beat the final level. Congratulate and return to menu.
    document.exitPointerLock();
    startMusic.pause();
    showMessage("🎉 You Win! You beat all 5 levels! 🎉");
    setTimeout(() => {
      hideMessage();
      stopGame();
      showScreen("main");
      currentLevel = 0;
    }, 2500);
    return;
  }

  showMessage("✅ Level Complete!");
  setTimeout(() => {
    hideMessage();
    loadLevel(currentLevel);
    paused = false;
  }, 1500);
}

/* =====================================================================
   PART 12 — HUD AND MESSAGES (the text on top of the game)
   ===================================================================== */

function updateHud() {
  document.getElementById("hud-level").textContent = currentLevel + 1; // humans count from 1
  document.getElementById("hud-coins").textContent = coinsTotal - coins.length;
  document.getElementById("hud-total").textContent = coinsTotal;
}

function showMessage(text) {
  document.getElementById("message-text").textContent = text;
  document.getElementById("game-message").classList.remove("hidden");
}
function hideMessage() {
  document.getElementById("game-message").classList.add("hidden");
}

/* =====================================================================
   PART 13 — START / STOP THE WHOLE GAME
   ===================================================================== */

function startGame() {
  currentLevel = 0;
  paused = false;

  // Prepare the drawing board and the sprite art the first time only.
  if (!canvas) {
    setupCanvas();
    makeSpriteArt();
    setupPointerLock();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  loadLevel(currentLevel);

  // Show the "click to look around" hint until the player clicks.
  document.getElementById("lock-hint").classList.remove("hidden");

  if (!animationId) gameLoop();
}

function stopGame() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  document.exitPointerLock(); // give the mouse back to the menus
  hideMessage();
  startMusic.pause();
}
