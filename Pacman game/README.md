# 🌟 Maze Explorer 3D

A first-person 3D maze game built with **100% vanilla JavaScript** — no game engine, no libraries, no build step. The entire 3D view is drawn on a single `<canvas>` using **raycasting**, the same rendering technique behind Wolfenstein 3D (1992).

Collect coins, dodge ghosts, jump hurdles, and find the exit door across 5 increasingly difficult levels.

## How to Play

Open `index.html` in any modern browser. No server or install required.

- **Mouse** — look around (click the game screen first to lock the pointer)
- **W A S D** / **Arrow keys** — move
- **Space** — jump (needed to clear orange hurdles)
- **Esc** — release the mouse

### Objective

- 🪙 Collect every coin in the level to unlock the exit door (it turns from red to green).
- 🚪 Walk into the open door to advance to the next level.
- 👻 Avoid the ghosts — if one touches you, it's game over.
- 🟧 Jump over hurdles; you can't walk through them.
- 🟥 Sliding red barriers move back and forth — time your crossing.
- Finish all 5 levels to win.

## Features

- Raycasting renderer (Wolfenstein-3D style) written from scratch — no WebGL, no Three.js
- Procedural sprite art for coins, ghosts, and barriers, drawn once onto off-screen canvases
- Simple Pac-Man-style ghost AI (chases the player, avoids reversing, occasionally wanders)
- Physics: gravity, jumping, and hurdle clearance
- Live minimap showing walls, coins, ghosts, the door, and the player
- Mouse-look with pointer lock, WASD/arrow-key movement, HUD, and level-complete/game-over/win flows
- Sound effects (see below)

## Sounds

Three sound effects live in `sounds/` and are wired up in `script.js`:

| File | Trigger |
|---|---|
| `pacman Start Music.mp3` | Plays once each time a level loads |
| `pacman Credit Sound.mp3` | Plays each time the player picks up a coin |
| `pacman fail.mp3` | Plays when a ghost catches the player (game over) |

## Project Structure

```
Pacman game/
├── index.html    # Screen markup (menus, game screen, HUD)
├── style.css     # Menu and HUD styling
├── script.js     # Game engine: raycaster, physics, ghost AI, game loop
├── sounds/       # Sound effects
└── README.md
```

## Tech Stack

Plain HTML, CSS, and JavaScript. No frameworks, no dependencies, no build tools — just open `index.html` and play.

## Level Design

Levels are defined as plain text grids in `script.js` (`LEVELS` array), making them easy to read and extend:

| Symbol | Meaning |
|---|---|
| `#` | Wall |
| `S` | Player start |
| `E` | Exit door |
| `C` | Coin |
| `G` | Ghost |
| `P` | Hurdle (jump over it) |
| `B` | Sliding barrier |
| (space) | Open floor |

Difficulty ramps up across the 5 levels via bigger mazes, more coins, and faster/more numerous ghosts (`GHOST_SPEEDS`).
