# NBA Tic-Tac-Toe

Desktop-first NBA trivia Tic-Tac-Toe web app with local play, AI, online rooms, matchmaking, Elo, and server-authoritative realtime gameplay.

## Quick Intro
NBA Tic-Tac-Toe is a knowledge-based grid game:
- You pick a square on the board.
- Each square is defined by a row prompt + a column prompt.
- You must enter an NBA player who satisfies both prompts.
- If correct, you claim the square with your symbol.
- First player to complete a line wins the round.

Examples:
- Row: `Played for the Lakers`
- Column: `All-Star`
- Valid answer could be a player who satisfies both conditions.

If you are new, start with:
1. `Local Play` for learning flow.
2. `AI Challenge` for practice.
3. `Ranked` once you are comfortable.

## Stack
- `apps/web`: Next.js App Router + TypeScript + Tailwind CSS
- `apps/server`: Express + Socket.IO + Prisma
- `packages/game-engine`: shared board rules + AI
- `packages/contracts`: shared typed socket contracts
- Database: PostgreSQL
- NBA validation data: local CSVs (auto-detected by server)

## Gameplay Model
- Realtime state flow: `LOBBY -> COUNTDOWN -> IN_GAME -> ROUND_END -> MATCH_END`
- Server authoritative:
  - turn order
  - timers
  - move validation
  - reconnect grace + forfeit handling
  - ranked Elo updates

## NBA Prompt/Validation Rules (Current)
- Prompt answers are restricted to players active in roughly the last 10 years (based on player seasons in dataset).
- Grid generation enforces minimum playability: each row/column intersection targets at least 5 possible valid answers.
- Multi-team `A AND B teams` prompts are excluded to reduce impossible boards.

## Monorepo Layout
```text
apps/
  server/
    prisma/
    src/
    tests/
  web/
    app/
    components/
    lib/
    tests/
packages/
  contracts/
  game-engine/
```

## Prerequisites
- Node.js 20+
- PostgreSQL 14+

## Local Setup
1. Install dependencies:
   - `npm install`
2. Configure env files:
   - `apps/server/.env.example` -> `apps/server/.env`
   - `apps/web/.env.example` -> `apps/web/.env.local`
3. Generate Prisma client + run migrations:
   - `npm run prisma:generate --workspace @nba/server`
   - `npm run prisma:migrate:dev --workspace @nba/server`
4. Start full app:
   - `npm run dev`

Default URLs:
- Web: `http://localhost:3000`
- Server: `http://localhost:4000`

## NBA Data Input (Auto-Detected)
The server checks several folder names (`nbadata`, `nba_data`, `nba_data/csv`, etc.) and supports:

1. Basketball-Reference style set (recommended)
- `Player Career Info.csv`
- `Player Season Info.csv`
- `Player Per Game.csv`
- Optional enrichments:
  - `All-Star Selections.csv`
  - `Draft Pick History.csv`
  - `Player Award Shares.csv`
  - `End of Season Teams.csv`

2. Legacy/simple set
- `Players.csv`
- `PlayerStatistics.csv` or `PlayerStatisticsScoring.csv`

3. NBA stats CSV folder style (`nba_data/csv`)
- `player.csv`
- `common_player_info.csv`
- `play_by_play.csv`
- Optional:
  - `game.csv`
  - `draft_history.csv`

If none are found, the server falls back to a tiny built-in seed dataset.

## Scripts
Root:
- `npm run dev` - run web + server (and opens browser)
- `npm run build` - build all workspaces
- `npm run test` - engine + server tests
- `npm run lint` - web lint

Web (`@nba/web`):
- `npm run dev --workspace @nba/web`
- `npm run build --workspace @nba/web`
- `npm run lint --workspace @nba/web`
- `npm run test:e2e:install --workspace @nba/web`
- `npm run test:e2e --workspace @nba/web`

Server (`@nba/server`):
- `npm run dev --workspace @nba/server`
- `npm run build --workspace @nba/server`
- `npm run test --workspace @nba/server`
- `npm run prisma:generate --workspace @nba/server`
- `npm run prisma:migrate:dev --workspace @nba/server`

## Socket Coverage
Core typed events are in `packages/contracts/src/index.ts`.

Includes:
- matchmaking (`matchmaking:*`)
- rooms (`room:*`)
- gameplay (`game:move`, `game:rematch`, `game:surrender`, timer/over events)
- reconnect/session resume

## Deploy
### Server
Required env vars:
- `PORT`
- `DATABASE_URL`
- `CORS_ORIGIN` (comma-separated allowed origins)

Typical deploy commands:
- Build: `npm run build --workspace @nba/server`
- Start: `npm run start --workspace @nba/server`
- Migrate: `npm run prisma:migrate --workspace @nba/server`

### Web
Required env vars:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`

Build:
- `npm run build --workspace @nba/web`

## Current Feature Coverage
- Local pass-and-play
- AI modes (easy/medium/hard)
- Ranked/unranked matchmaking
- Private rooms + lobby settings + ready/start flow
- In-game timers (per-move/per-game/none)
- Answer validation with autocomplete + canonical player matching
- Match replay controls at match end
- Leaderboard + profile history
