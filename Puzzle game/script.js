//world variables
const deg = Math.PI / 180;

function Player(x, y, z, rx, ry){
	this.x = x;
	this.y = y;
	this.z = z;
	this.rx = rx;
	this.ry = ry;
	this.vy = 0;
	this.grounded = true;
}

//the maze rows below form a zigzag corridor: each row spans most of the width with a gap on
//alternating ends, forcing the player to snake left-right-left-right to reach the picture's cell
const map = [
	[0,0,-1000,0,0,0,2000,200,"#3B3226"],//front wall (pattern applied per level)
	[0,0,1000,0,0,0,2000,200,"#3B3226"],//back wall (pattern applied per level)
	[1000,0,0,0,90,0,2000,200,"#3B3226"],//right wall (pattern applied per level)
	[-1000,0,0,0,90,0,2000,200,"#3B3226"],//left wall (pattern applied per level)
	[0,100,0,90,0,0,2000,2000,"#EAD9B4"],//ground
	[140,0,700,0,0,0,1720,200,"#3B3226"],//maze row 1, gap on the left
	[-140,0,350,0,0,0,1720,200,"#3B3226"],//maze row 2, gap on the right
	[140,0,0,0,0,0,1720,200,"#3B3226"],//maze row 3, gap on the left
	[-140,0,-350,0,0,0,1720,200,"#3B3226"],//maze row 4, gap on the right (opens onto the picture's cell)
];

//near-edge starting point for each level; the picture itself never moves
const SPAWN_POINTS = [
	{ x: -900, z: 900 },
	{ x: 900, z: 900 },
	{ x: -900, z: 750 },
	{ x: 900, z: 750 }
];

//one wall texture per level, cycled onto all four walls when the level changes
const patternFiles = [
	"patterns/Abstract Textured Surface.png",
	"patterns/Abstract Wavy Pattern.png",
	"patterns/Textured Olive Surface.png",
	"patterns/Vintage Paper Texture.png"
];

//one photo per level, shown rotating in the room and used as the puzzle image
const levelArt = [
	{ picture: "pictures/horizontal_01.jpg", orientation: "horizontal" },
	{ picture: "pictures/vertical_01.jpg", orientation: "vertical" },
	{ picture: "pictures/horizontal_02.jpg", orientation: "horizontal" },
	{ picture: "pictures/vertical_03.jpg", orientation: "vertical" }
];

//frame graphics only come in two shapes; box/inner numbers are eyeballed against the source art (frames/*.png), scaled to a medium size, so the photo lines up inside the opening
const FRAME = {
	horizontal: { file: "frames/horizontal_frame.png", w: 345, h: 229, innerW: 269, innerH: 165 },
	vertical: { file: "frames/vertical_frame.png", w: 255, h: 255, innerW: 132, innerH: 161 }
};

//"forward" (w) walks toward decreasing z from spawn, so the picture sits on that side, reachable without turning around first
const PICTURE_POS = { x: 0, y: -90, z: -500 };
const PICTURE_INTERACT_RADIUS = 260;

let currentLevel = 0;
let pictureRotation = 0;
let puzzleOpen = false;
let puzzleTiles = [];
let puzzleSize = 2;

//variables for movement
let PressLeft = 0;
let PressRight = 0;
let PressForward = 0;
let PressBack = 0;
let MouseX = 0;
let MouseY = 0;
let lock = false;
let gameStarted = false;
let sprinting = false;

//gravity / jump / collision tuning
const GRAVITY = 2;
const JUMP_STRENGTH = 18;
const FLOOR_Y = 0;
const PLAYER_RADIUS = 30;
const WALL_THICKNESS = 20;
const SPRINT_MULTIPLIER = 1.6;

const container = document.getElementById("container");

//sound effects (music/, CC0 via Kenney.nl - see music/CREDITS.txt)
function loadSound(src, volume){
	const audio = new Audio(src);
	audio.volume = volume;
	return audio;
}

const footstepSounds = [
	loadSound("music/footstep1.ogg", 0.5),
	loadSound("music/footstep2.ogg", 0.5),
	loadSound("music/footstep3.ogg", 0.5),
	loadSound("music/footstep4.ogg", 0.5)
];
const jumpSound = loadSound("music/jump.ogg", 0.7);
const wallBumpSound = loadSound("music/wall_bump.ogg", 0.6);
const buttonClickSound = loadSound("music/button_click.ogg", 0.6);
const tileMoveSound = loadSound("music/tile_move.ogg", 0.6);
const pictureFoundSound = loadSound("music/picture_found.ogg", 0.7);
const puzzleSolvedSound = loadSound("music/puzzle_solved.ogg", 0.7);
const winFanfareSound = loadSound("music/win_fanfare.ogg", 0.8);

//plays a footstep sound at a walk/sprint cadence while grounded and moving; round-robins the 4 clips for variety
const FOOTSTEP_INTERVAL_WALK = 350;
const FOOTSTEP_INTERVAL_SPRINT = 220;
let footstepTimer = 0;
let footstepIndex = 0;

function updateFootsteps(elapsedMs){
	const moving = (PressForward !== 0 || PressBack !== 0 || PressLeft !== 0 || PressRight !== 0);
	if (!moving || !pawn.grounded){
		footstepTimer = 0;
		return;
	}
	footstepTimer += elapsedMs;
	const interval = sprinting ? FOOTSTEP_INTERVAL_SPRINT : FOOTSTEP_INTERVAL_WALK;
	if (footstepTimer >= interval){
		footstepTimer = 0;
		footstepSounds[footstepIndex].currentTime = 0;
		footstepSounds[footstepIndex].play();
		footstepIndex = (footstepIndex + 1) % footstepSounds.length;
	}
}

//uses event.code (not event.key) so holding Shift for sprint doesn't change the letter case and miss these checks
document.addEventListener("keydown", (event) => {
	if (!gameStarted) return;
	if (event.code === "KeyA"){
		PressLeft = 1;
	}
	if (event.code === "KeyD"){
		PressRight = 1;
	}
	if (event.code === "KeyW"){
		PressForward = 5;
	}
	if (event.code === "KeyS"){
		PressBack = 1;
	}
	if (event.code === "Space"){
		if (pawn.grounded){
			pawn.vy = -JUMP_STRENGTH;
			pawn.grounded = false;
			jumpSound.currentTime = 0;
			jumpSound.play();
		}
	}
	if (event.code === "ShiftLeft"){
		sprinting = true;
	}
});

//if the key is released
document.addEventListener("keyup", (event) => {
	if (event.code === "KeyA"){
		PressLeft = 0;
	}
	if (event.code === "KeyD"){
		PressRight = 0;
	}
	if (event.code === "KeyW"){
		PressForward = 0;
	}
	if (event.code === "KeyS"){
		PressBack = 0;
	}
	if (event.code === "ShiftLeft"){
		sprinting = false;
	}
});

//if the mouse is pressed
container.onclick = function(){
	if (gameStarted && !puzzleOpen) container.requestPointerLock();
};

//locked mouse listener
document.addEventListener("pointerlockchange", () => {
	lock = !lock;
});

//mouse movement listener
document.addEventListener("mousemove", (event) => {
	MouseX = event.movementX;
	MouseY = event.movementY;
});

const pawn = new Player(0, 0, 0, 0, 0);
const world = document.getElementById("world");

//translated UI text, keyed by data-i18n attribute values in index.html
const translations = {
	en: {
		setupTitle: "Before we begin",
		mainTitle: "Picture Quest",
		startGame: "Start game",
		instructionsBtn: "Instructions",
		controlsTitle: "Controls",
		controlsBody: "w - Go Forward<br>s - Go Back<br>a - Go Left<br>d - Go Right<br>Space - Jump<br>Left Shift - Run<br>You can use an English keyboard only!!!",
		rulesBtn: "Rules",
		backToMenu: "Back",
		rulesTitle: "How to win",
		rulesBody: "Each room is a maze. Search it for the rotating picture and walk up to it to open its puzzle. Solve the puzzle to move to the next room. Solve all the puzzles to win the game!",
		nameLabel: "Your name",
		ageLabel: "Your age",
		setupNotice: "Your name is only used to say hi in the game — it isn't saved or sent anywhere.",
		continueBtn: "Continue",
		nameRequired: "Please enter your name.",
		ageInvalid: "Please enter an age between 3 and 12.",
		puzzleTitle: "Piece it back together",
		winTitle: "You solved every puzzle!",
		winBody: "Great job, explorer. Every picture is back in one piece."
	},
	lv: {
		setupTitle: "Pirms sākam",
		mainTitle: "Attēlu meklējumi",
		startGame: "Sākt spēli",
		instructionsBtn: "Instrukcijas",
		controlsTitle: "Vadība",
		controlsBody: "w - Iet uz priekšu<br>s - Iet atpakaļ<br>a - Iet pa kreisi<br>d - Iet pa labi<br>Space - Lēkt<br>Kreisais Shift - Skriet<br>Vari izmantot tikai angļu tastatūru!!!",
		rulesBtn: "Noteikumi",
		backToMenu: "Atpakaļ",
		rulesTitle: "Kā uzvarēt",
		rulesBody: "Katra istaba ir labirints. Atrodi tajā rotējošu attēlu un pieej tam klāt, lai atvērtu tā puzli. Atrisini puzli, lai dotos uz nākamo istabu. Atrisini visus puzļus, lai uzvarētu spēlē!",
		nameLabel: "Tavs vārds",
		ageLabel: "Tavs vecums",
		setupNotice: "Tavs vārds tiek izmantots tikai spēles laikā — tas netiek saglabāts vai sūtīts nekur.",
		continueBtn: "Turpināt",
		nameRequired: "Lūdzu, ievadi savu vārdu.",
		ageInvalid: "Lūdzu, ievadi vecumu no 3 līdz 12 gadiem.",
		puzzleTitle: "Salīdzini attēlu no jauna",
		winTitle: "Tu atrisināji visus puzļus!",
		winBody: "Lieliski padarīts! Katrs attēls ir salikts kopā."
	}
};

let currentLanguage = "en";

function applyLanguage(lang){
	currentLanguage = lang;
	document.documentElement.lang = lang;
	const dict = translations[lang];
	document.querySelectorAll("[data-i18n]").forEach((el) => {
		const key = el.dataset.i18n;
		if (dict[key] !== undefined) el.innerHTML = dict[key];
	});
	document.getElementById("langEn").classList.toggle("active", lang === "en");
	document.getElementById("langLv").classList.toggle("active", lang === "lv");
}

//player session state, set once on the setup screen and used to scale puzzle difficulty
let playerName = "";
let playerAge = 0;
let baseGridSize = 2;
let highDifficulty = false;

function computeDifficulty(age){
	if (age <= 6){
		baseGridSize = 2;
		highDifficulty = false;
	} else if (age <= 9){
		baseGridSize = 3;
		highDifficulty = false;
	} else {
		baseGridSize = 4;
		highDifficulty = true;
	}
}

function showMenu(id){
	["menu0", "menu1", "menu2", "menu3"].forEach((m) => {
		document.getElementById(m).style.display = (m === id) ? "flex" : "none";
	});
}

document.getElementById("langEn").onclick = (event) => {
	event.stopPropagation();
	applyLanguage("en");
};

document.getElementById("langLv").onclick = (event) => {
	event.stopPropagation();
	applyLanguage("lv");
};

document.getElementById("buttonContinue").onclick = (event) => {
	event.stopPropagation();
	const name = document.getElementById("playerName").value.trim();
	const age = Number.parseInt(document.getElementById("playerAge").value, 10);
	const errorEl = document.getElementById("setupError");
	if (name.length === 0){
		errorEl.textContent = translations[currentLanguage].nameRequired;
		return;
	}
	if (Number.isNaN(age) || age < 3 || age > 12){
		errorEl.textContent = translations[currentLanguage].ageInvalid;
		return;
	}
	errorEl.textContent = "";
	playerName = name;
	playerAge = age;
	computeDifficulty(age);
	showMenu("menu1");
};

document.getElementById("button1").onclick = (event) => {
	event.stopPropagation();
	showMenu(null);
	gameStarted = true;
	spawnPlayerAt(currentLevel);
	container.requestPointerLock();
};

document.getElementById("button2").onclick = (event) => {
	event.stopPropagation();
	showMenu("menu2");
};

document.getElementById("button3").onclick = (event) => {
	event.stopPropagation();
	showMenu("menu1");
};

document.getElementById("button4").onclick = (event) => {
	event.stopPropagation();
	showMenu("menu3");
};

document.getElementById("button5").onclick = (event) => {
	event.stopPropagation();
	showMenu("menu1");
};

document.getElementById("buttonWinMenu").onclick = (event) => {
	event.stopPropagation();
	document.getElementById("menuWin").style.display = "none";
	currentLevel = 0;
	setLevelWalls(currentLevel);
	applyLevelArt(currentLevel);
	showMenu("menu1");
};

applyLanguage("en");

//shared click sound for every button, added alongside each element's own onclick rather than replacing it
document.querySelectorAll(".button, .navButton, .langButton").forEach((el) => {
	el.addEventListener("click", () => {
		buttonClickSound.currentTime = 0;
		buttonClickSound.play();
	});
});

//keeps the player (treated as a circle) from walking through axis-aligned walls (rx=0 entries in the map)
//uses closest-point-on-rectangle so corners where two walls meet are handled correctly; also reports
//whether the player was pushed out of any wall this call, so a bump sound can play on first contact
let wallTouching = false;

function collideWalls(x, z){
	wallTouching = false;
	for (const w of map){
		if (w[3] !== 0) continue; //skip ground/ceiling planes, only vertical walls block movement
		const facingX = (((w[4] % 180) + 180) % 180) === 90;
		const half = w[6] / 2;
		let xmin, xmax, zmin, zmax;
		if (facingX){
			xmin = w[0] - WALL_THICKNESS; xmax = w[0] + WALL_THICKNESS;
			zmin = w[2] - half; zmax = w[2] + half;
		} else {
			xmin = w[0] - half; xmax = w[0] + half;
			zmin = w[2] - WALL_THICKNESS; zmax = w[2] + WALL_THICKNESS;
		}
		const closestX = Math.min(Math.max(x, xmin), xmax);
		const closestZ = Math.min(Math.max(z, zmin), zmax);
		const awayX = x - closestX;
		const awayZ = z - closestZ;
		const distSq = awayX * awayX + awayZ * awayZ;
		if (distSq < PLAYER_RADIUS * PLAYER_RADIUS){
			const dist = Math.sqrt(distSq);
			if (dist === 0) continue; //player exactly on the wall's centerline; extremely rare, skip rather than divide by zero
			const push = PLAYER_RADIUS - dist;
			x += (awayX / dist) * push;
			z += (awayZ / dist) * push;
			wallTouching = true;
		}
	}
	return [x, z];
}

function update(){
	if (!gameStarted || puzzleOpen) return;

	//count movement
	const speed = sprinting ? SPRINT_MULTIPLIER : 1;
	const dx = ((PressRight - PressLeft) * Math.cos(pawn.ry * deg) - (PressForward - PressBack) * Math.sin(pawn.ry * deg)) * speed;
	const dz = (-(PressRight - PressLeft) * Math.sin(pawn.ry * deg) - (PressForward - PressBack) * Math.cos(pawn.ry * deg)) * speed;
	const drx = MouseY * 0.5;
	const dry = -MouseX * 0.5;
	MouseX = MouseY = 0;

	//gravity: accelerate downward until landing back on the floor
	pawn.vy += GRAVITY;
	pawn.y += pawn.vy;
	if (pawn.y >= FLOOR_Y){
		pawn.y = FLOOR_Y;
		pawn.vy = 0;
		pawn.grounded = true;
	}

	//add horizontal movement, blocked by walls
	const wasTouchingWall = wallTouching;
	[pawn.x, pawn.z] = collideWalls(pawn.x + dx, pawn.z + dz);
	if (wallTouching && !wasTouchingWall){
		wallBumpSound.currentTime = 0;
		wallBumpSound.play();
	}
	if (lock) {
		pawn.rx += drx;
		pawn.ry += dry;
	}

	updateFootsteps(10); //Repeat() ticks every 10ms

	//change coordinates of the world
	world.style.transform = "translateZ(600px)" +
		"rotateX(" + (-pawn.rx) + "deg)" +
		"rotateY(" + (-pawn.ry) + "deg)" + "translate3d(" + (-pawn.x) + "px," + (-pawn.y) + "px," + (-pawn.z) + "px)";
}

//function to transform array to the rectangles
function CreateNewWorld(){
	CreateSquares(map, "wall");
}

function CreateSquares(squares, string){
	for (const [i, sq] of squares.entries()){
		//create rectangle and styles
		const newElement = document.createElement("div");
		newElement.className = string + " square";
		newElement.id = string + i;
		newElement.style.width = sq[6] + "px";
		newElement.style.height = sq[7] + "px";
		newElement.style.background = sq[8];
		newElement.style.backgroundImage = "url(" + sq[8] + ")";
		newElement.style.opacity = sq[9];
		newElement.style.transform =
			"translate3d(" + (600 - sq[6] / 2 + sq[0]) + "px," +
			(400 - sq[7] / 2 + sq[1]) + "px," +
			sq[2] + "px)" +
			"rotateX(" + sq[3] + "deg)" +
			"rotateY(" + sq[4] + "deg)" +
			"rotateZ(" + sq[5] + "deg)";

		//insert rectangle into the world
		world.append(newElement);
	}
}

//swaps the texture on every vertical wall (boundary + maze rows) to the given level's pattern; ground keeps its plain color
function setLevelWalls(levelIndex){
	const patternUrl = patternFiles[levelIndex];
	map.forEach((entry, i) => {
		if (entry[3] !== 0) return; //skip the ground plane
		const wallEl = document.getElementById("wall" + i);
		wallEl.style.background = "";
		wallEl.style.backgroundImage = "url(\"" + patternUrl + "\")";
		wallEl.style.backgroundSize = "480px 480px"; //tile the texture instead of stretching one crop over the whole wall
		wallEl.style.backgroundRepeat = "repeat";
	});
}

function spawnPlayerAt(levelIndex){
	const spawn = SPAWN_POINTS[levelIndex];
	pawn.x = spawn.x; pawn.y = 0; pawn.z = spawn.z; pawn.rx = 0; pawn.ry = 0;
}

//builds the rotating framed photo in the middle of the room: a photo layer behind a frame
//graphic layer. The frame PNGs have a plain white background rather than transparency, so
//the frame layer uses mix-blend-mode:multiply — white areas become invisible over the photo,
//while the dark/gold border pixels darken the photo underneath, reading as an overlaid frame.
function createPictureFrame(){
	const wrap = document.createElement("div");
	wrap.id = "levelArt";
	wrap.className = "square levelArtWrap";
	world.append(wrap);

	const photo = document.createElement("div");
	photo.id = "levelArtPhoto";
	photo.className = "levelArtPhoto";
	wrap.append(photo);

	const frame = document.createElement("div");
	frame.id = "levelArtFrame";
	frame.className = "levelArtFrame";
	wrap.append(frame);

	applyLevelArt(0);
}

function applyLevelArt(levelIndex){
	const art = levelArt[levelIndex];
	const dims = FRAME[art.orientation];
	const wrap = document.getElementById("levelArt");
	const photo = document.getElementById("levelArtPhoto");
	const frame = document.getElementById("levelArtFrame");

	wrap.style.width = dims.w + "px";
	wrap.style.height = dims.h + "px";
	photo.style.width = dims.innerW + "px";
	photo.style.height = dims.innerH + "px";
	photo.style.left = ((dims.w - dims.innerW) / 2) + "px";
	photo.style.top = ((dims.h - dims.innerH) / 2) + "px";
	photo.style.backgroundImage = "url(\"" + art.picture + "\")";
	frame.style.backgroundImage = "url(\"" + dims.file + "\")";

	pictureRotation = 0;
	updatePictureTransform();
}

function updatePictureTransform(){
	const wrap = document.getElementById("levelArt");
	const w = Number.parseFloat(wrap.style.width);
	const h = Number.parseFloat(wrap.style.height);
	wrap.style.transform =
		"translate3d(" + (600 - w / 2 + PICTURE_POS.x) + "px," +
		(400 - h / 2 + PICTURE_POS.y) + "px," +
		PICTURE_POS.z + "px)" +
		"rotateY(" + pictureRotation + "deg)";
}

//opens the puzzle once the player walks within range of the room's picture
function checkPictureInteract(){
	if (!gameStarted || puzzleOpen) return;
	const dx = pawn.x - PICTURE_POS.x;
	const dy = pawn.y - PICTURE_POS.y;
	const dz = pawn.z - PICTURE_POS.z;
	const distSq = dx * dx + dy * dy + dz * dz;
	if (distSq < PICTURE_INTERACT_RADIUS * PICTURE_INTERACT_RADIUS){
		openPuzzle();
	}
}

function openPuzzle(){
	puzzleOpen = true;
	document.exitPointerLock();
	buildPuzzle(currentLevel);
	document.getElementById("puzzleOverlay").style.display = "flex";
	pictureFoundSound.currentTime = 0;
	pictureFoundSound.play();
}

function closePuzzle(){
	puzzleOpen = false;
	document.getElementById("puzzleOverlay").style.display = "none";
}

//builds a solvable shuffled sliding-tile puzzle sized by baseGridSize (set from the player's age in computeDifficulty)
function buildPuzzle(levelIndex){
	puzzleSize = baseGridSize;
	const total = puzzleSize * puzzleSize;
	puzzleTiles = Array.from({ length: total }, (_, i) => i); //solved order; the last index is the blank tile
	shufflePuzzle();
	renderPuzzle(levelIndex);
}

function puzzleNeighbors(index){
	const row = Math.floor(index / puzzleSize);
	const col = index % puzzleSize;
	const result = [];
	if (row > 0) result.push(index - puzzleSize);
	if (row < puzzleSize - 1) result.push(index + puzzleSize);
	if (col > 0) result.push(index - 1);
	if (col < puzzleSize - 1) result.push(index + 1);
	return result;
}

//shuffles by making random legal slides from the solved state, which always leaves a solvable puzzle
function shufflePuzzle(){
	let blankIndex = puzzleTiles.length - 1;
	const moves = 150 + puzzleSize * 40;
	for (let m = 0; m < moves; m++){
		const neighbors = puzzleNeighbors(blankIndex);
		const swapWith = neighbors[Math.floor(Math.random() * neighbors.length)];
		[puzzleTiles[blankIndex], puzzleTiles[swapWith]] = [puzzleTiles[swapWith], puzzleTiles[blankIndex]];
		blankIndex = swapWith;
	}
}

function renderPuzzle(levelIndex){
	const grid = document.getElementById("puzzleGrid");
	grid.style.gridTemplateColumns = "repeat(" + puzzleSize + ", 1fr)";
	grid.innerHTML = "";
	const picture = levelArt[levelIndex].picture;
	const total = puzzleTiles.length;

	puzzleTiles.forEach((tileValue, position) => {
		const tileEl = document.createElement("div");
		if (tileValue === total - 1){
			tileEl.className = "puzzleTile puzzleBlank";
		} else {
			tileEl.className = "puzzleTile";
			const col = tileValue % puzzleSize;
			const row = Math.floor(tileValue / puzzleSize);
			const percent = puzzleSize > 1 ? 100 / (puzzleSize - 1) : 0;
			tileEl.style.backgroundImage = "url(\"" + picture + "\")";
			tileEl.style.backgroundSize = (puzzleSize * 100) + "% " + (puzzleSize * 100) + "%";
			tileEl.style.backgroundPosition = (col * percent) + "% " + (row * percent) + "%";
			tileEl.onclick = (event) => {
				event.stopPropagation();
				handleTileClick(position);
			};
		}
		grid.append(tileEl);
	});
}

function handleTileClick(position){
	const total = puzzleTiles.length;
	const blankPos = puzzleTiles.indexOf(total - 1);
	if (!puzzleNeighbors(blankPos).includes(position)) return;
	[puzzleTiles[blankPos], puzzleTiles[position]] = [puzzleTiles[position], puzzleTiles[blankPos]];
	tileMoveSound.currentTime = 0;
	tileMoveSound.play();
	renderPuzzle(currentLevel);
	if (isPuzzleSolved()) onPuzzleSolved();
}

function isPuzzleSolved(){
	return puzzleTiles.every((value, index) => value === index);
}

function onPuzzleSolved(){
	puzzleSolvedSound.currentTime = 0;
	puzzleSolvedSound.play();
	setTimeout(() => {
		closePuzzle();
		advanceLevel();
	}, 500);
}

function advanceLevel(){
	currentLevel++;
	if (currentLevel >= levelArt.length){
		showWinScreen();
		return;
	}
	setLevelWalls(currentLevel);
	applyLevelArt(currentLevel);
	spawnPlayerAt(currentLevel);
	if (gameStarted) container.requestPointerLock();
}

function showWinScreen(){
	gameStarted = false;
	document.getElementById("menuWin").style.display = "flex";
	winFanfareSound.currentTime = 0;
	winFanfareSound.play();
}

CreateNewWorld();
createPictureFrame();
setLevelWalls(currentLevel);

const TimerGame = setInterval(Repeat, 10);

function Repeat(){
	update();

	if (!puzzleOpen){
		pictureRotation += 0.5;
		updatePictureTransform();
		checkPictureInteract();
	}
}
