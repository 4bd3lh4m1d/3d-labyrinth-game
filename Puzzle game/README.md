# 🖼️ Picture Quest

A first-person 3D maze game built with **vanilla JavaScript and CSS 3D transforms** (no canvas, no WebGL, no libraries). Each level is a zigzag maze room built from CSS-transformed `<div>` "walls." Find the rotating framed picture, solve its sliding-tile puzzle, and move on to the next room.

Supports **English and Latvian**, and scales puzzle difficulty to the player's age.

## How to Play

Open `index.html` in any modern browser. No server or install required.

1. Enter your name and age (used only to size the puzzle difficulty — never saved or sent anywhere).
2. Explore the maze room with **W A S D**, look around with the **mouse** (click to lock the pointer), and **Space** to jump. Hold **Left Shift** to run.
3. Find the rotating framed picture in the room and walk up to it — this opens a sliding-tile puzzle of that picture.
4. Solve the puzzle (click tiles adjacent to the blank space to slide them) to unlock the next room.
5. Solve all 4 puzzles to win.

> Keyboard controls use physical key codes (`KeyW`/`KeyA`/etc.), so an English keyboard layout is required.

## Features

- First-person movement and mouse-look implemented with pure CSS `transform: translate3d/rotateX/rotateY` on a `<div>` "world" — no canvas or WebGL
- Circle-vs-rectangle wall collision (closest-point-on-rectangle) so corners are handled correctly, with gravity/jump physics
- Difficulty scales to the player's stated age: ages 3–6 get a 2×2 puzzle, 7–9 get 3×3, 10–12 get a harder 4×4
- Puzzles are shuffled by making random legal slides from the solved state, so every puzzle is guaranteed solvable
- Each of the 4 levels has its own wall texture and a unique framed photo (horizontal or vertical frame) rotating in the room
- Full English/Latvian localization via `data-i18n` attributes, switchable from the setup screen
- Sound effects for footsteps, jumping, wall bumps, button clicks, tile moves, solving a puzzle, and a win fanfare

## Project Structure

```
Puzzle game/
├── index.html    # Screens: setup, main menu, controls, rules, puzzle overlay, win screen
├── style.css     # 3D world, menu, and puzzle grid styling
├── script.js     # Player movement/collision, maze world, puzzle logic, i18n
├── frames/       # Picture frame overlay graphics (horizontal/vertical)
├── pictures/     # Photos used as the rotating picture + puzzle image per level
├── patterns/     # Wall textures, one per level
├── music/        # Sound effects (CC0, Kenney.nl — see music/CREDITS.txt)
└── README.md
```

## Tech Stack

Plain HTML, CSS, and JavaScript. No frameworks, no dependencies, no build tools — just open `index.html` and play. Google Fonts (Baloo 2, Nunito) are loaded from a CDN for the UI; everything else runs offline.

## Level Design

Each level shares the same zigzag maze layout (`map` in `script.js`) but swaps in a different wall pattern and framed photo:

| Level | Wall Pattern | Picture | Orientation |
|---|---|---|---|
| 1 | Abstract Textured Surface | `horizontal_01.jpg` | Horizontal |
| 2 | Abstract Wavy Pattern | `vertical_01.jpg` | Vertical |
| 3 | Textured Olive Surface | `horizontal_02.jpg` | Horizontal |
| 4 | Vintage Paper Texture | `vertical_03.jpg` | Vertical |

The picture itself never moves within a room; only the player's spawn point changes per level (`SPAWN_POINTS`), keeping the walk to the picture non-trivial without turning the maze into a new layout each time.

## Sound Credits

All sound effects in `music/` are CC0 (public domain), sourced from Kenney.nl — see `music/CREDITS.txt` for details.
