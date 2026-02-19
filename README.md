# NBA Tic-Tac-Toe (Desktop Web)

Production-ready desktop-first web app inspired by footy-tic-tac-toe, rebuilt with an NBA theme.

## 1) Architecture Plan

- Frontend (`apps/web`): Next.js App Router + TypeScript + TailwindCSS.
- Backend (`apps/server`): Express + Socket.IO (server-authoritative realtime state).
- Shared game logic (`packages/game-engine`): board rules, win detection, legal moves, AI (easy/medium/hard with minimax).
- Shared contracts (`packages/contracts`): typed Socket.IO event contracts and shared DTOs.
- Persistence: Postgres + Prisma (`apps/server/prisma/schema.prisma`) for users, rooms, and matches/replays.
- NBA validation dataset: local CSVs in `nbadata/` (Players + PlayerStatisticsScoring), loaded by `apps/server/src/nbaData.ts`.

### Realtime state machine

- `LOBBY -> COUNTDOWN -> IN_GAME -> ROUND_END -> MATCH_END`

### Authoritative server responsibilities

- Validate moves.
- Track turn/order/timer.
- Handle reconnect grace window and forfeits.
- Persist ranked results and rating deltas.

## 2) File Tree

```text
.
├─ apps
│  ├─ server
│  │  ├─ prisma/schema.prisma
│  │  ├─ src
│  │  │  ├─ db.ts
│  │  │  ├─ index.ts
│  │  │  ├─ server.ts
│  │  │  ├─ state.ts
│  │  │  └─ utils.ts
│  │  ├─ tests
│  │  │  ├─ rest.test.ts
│  │  │  └─ socket-flow.test.ts
│  │  ├─ .env.example
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ web
│     ├─ app
│     │  ├─ leaderboard/page.tsx
│     │  ├─ match/[id]/page.tsx
│     │  ├─ profile/page.tsx
│     │  ├─ room/[code]/page.tsx
│     │  ├─ setup/page.tsx
│     │  ├─ globals.css
│     │  ├─ layout.tsx
│     │  ├─ page.tsx
│     │  └─ providers.tsx
│     ├─ components
│     │  ├─ GameBoard.tsx
│     │  ├─ LeftPanel.tsx
│     │  ├─ ModeCard.tsx
│     │  ├─ RightPanel.tsx
│     │  └─ SettingsModal.tsx
│     ├─ lib
│     │  ├─ api.ts
│     │  ├─ config.ts
│     │  ├─ local-game.ts
│     │  └─ socket.ts
│     ├─ tests/smoke.spec.ts
│     ├─ .env.example
│     ├─ next.config.ts
│     ├─ package.json
│     ├─ playwright.config.ts
│     ├─ postcss.config.js
│     ├─ tailwind.config.ts
│     └─ tsconfig.json
├─ packages
│  ├─ contracts
│  │  ├─ src/index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ game-engine
│     ├─ src/index.ts
│     ├─ tests/engine.test.ts
│     ├─ package.json
│     └─ tsconfig.json
├─ .gitignore
├─ package.json
└─ tsconfig.base.json
```

## 3) Prisma Schema

`apps/server/prisma/schema.prisma` includes:

- `User`: username, rating, W/L, streak, settings.
- `Match`: ranked/unranked metadata, moves JSON replay, winner, rating deltas.
- `Room`: host/settings/players/spectators/state snapshot.

## 4) Socket Event Contracts

All typed contracts are in `packages/contracts/src/index.ts`:

- Matchmaking: `matchmaking:join`, `matchmaking:leave`, `matchmaking:found`
- Rooms: `room:create`, `room:join`, `room:leave`, `room:ready`, `room:start`, `room:settings`, `room:stateSync`
- Gameplay: `game:move`, `game:timerTick`, `game:over`, `game:rematch`, `game:ratingDelta`
- Reconnect: `session:resume`, `reconnect:resume`, `reconnect:countdown`

## 5) Run Locally

### Prereqs

- Node.js 20+
- Postgres 14+

### Setup

1. Install dependencies at repo root:
   - `npm install`
2. Configure env files:
   - Copy `apps/server/.env.example` -> `apps/server/.env`
   - Copy `apps/web/.env.example` -> `apps/web/.env.local`
3. Run Prisma:
   - `npm run prisma:generate --workspace @nba/server`
   - `npm run prisma:migrate:dev --workspace @nba/server`
4. Start app (two processes via one command):
   - `npm run dev`

Frontend runs on `http://localhost:3000`, backend on `http://localhost:4000`.

## 6) Test

- Unit game engine: `npm run test --workspace @nba/game-engine`
- Backend integration: `npm run test --workspace @nba/server`
- E2E smoke (web): `npm run test:e2e --workspace @nba/web`

## NBA Dataset

- Put dataset files in `nbadata/` at repo root.
- Required files:
  - `Players.csv`
  - `PlayerStatisticsScoring.csv`
- Server auto-detects this folder and builds runtime indices for answer validation.

## 7) Deploy

### Backend (Render/Fly/Railway)

1. Deploy `apps/server`.
2. Set env vars:
   - `PORT=4000`
   - `DATABASE_URL=...`
   - `CORS_ORIGIN=https://<your-vercel-domain>`
3. Build/start:
   - Build: `npm run build --workspace @nba/server`
   - Start: `npm run start --workspace @nba/server`
4. Run migrations in deploy hook:
   - `npm run prisma:migrate --workspace @nba/server`

### Frontend (Vercel)

1. Deploy `apps/web`.
2. Env vars:
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>`
   - `NEXT_PUBLIC_SOCKET_URL=https://<backend-domain>`
3. Build command:
   - `npm run build --workspace @nba/web`

## Feature Coverage

- Desktop-first polished UI with left/right panels and centered stage.
- Local pass-and-play.
- AI modes (easy/medium/hard minimax).
- Online quick matchmaking + private rooms.
- Ranked/unranked support + Elo updates.
- Reconnection grace flow.
- Spectator join support.
- Match move history and replay controls.
- Leaderboard (global/weekly) and profile history.
