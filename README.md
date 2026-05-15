# Raid on Bungeling Bay

A Spring Boot 3 / Java 21 app serving a browser-playable tribute to Will Wright's 1984
classic. Top-down helicopter shooter: launch from the carrier `CV-1`, fly across
Bungeling Bay, and destroy six enemy factories before the threat reaches 100%.

## Run

```bash
mvn spring-boot:run
```

Then open <http://localhost:8080>.

## Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Fly |
| `Space` | Machine guns (vs jets, ships, AA) |
| `F` | Drop bomb (needed to destroy factories) |
| `P` | Pause |

Land on the carrier (hover slowly over it) to rearm and repair. Each factory
destroyed shaves a chunk off the doomsday threat meter.

## Layout

- Backend: `src/main/java/com/raidonbungelingbay/`
  - `RaidOnBungelingBayApplication` -- Spring Boot entry point
  - `controller/GameController` -- REST endpoints (`/api/health`, `/api/highscores`)
  - `service/HighScoreService` -- in-memory top-scores
- Frontend: `src/main/resources/static/`
  - `index.html`, `css/style.css`, `js/game.js`

## API

- `GET  /api/health` -> `{status:"ok", game:"Raid on Bungeling Bay"}`
- `GET  /api/highscores` -> top 10 scores
- `POST /api/highscores` body `{name, score, factoriesDestroyed}`
