# CHAOS CLUB: PROJECT STRUCTURE

Do not assume a planned file or folder exists until it has been created.
Keep this document updated whenever the real project structure changes.

## Exists now (Phase 1 setup)
- `.git/`, `project-docs/` (documentation folder)
- `web/`: default Next.js app (create-next-app), confirmed running
- `server/` and `shared/`: starter files added in the setup zip (not yet verified until PROGRESS.md says so)
- Root files: `package.json`, `tsconfig.base.json`, `.gitignore`, `.prettierrc`, `.env.example`, `docker-compose.yml`

## Planned layout (npm workspaces monorepo)

```
chaos-club/
├── package.json              # workspaces: web, server, shared
├── tsconfig.base.json
├── .env.example              # copy to .env (never commit .env)
├── docker-compose.yml        # local PostgreSQL
├── project-docs/             # this documentation
│
├── shared/                   # "@chaos/shared": types, constants, Zod validation (no secrets, no game logic)
│   ├── src/
│   │   ├── constants.ts
│   │   ├── schemas/          # nickname, room code, later votes etc.
│   │   ├── events.ts         # (planned) Socket.IO event names and payloads
│   │   └── index.ts
│   └── tests/
│
├── server/                   # "@chaos/server": Node.js + Socket.IO
│   ├── prisma/               # (planned) schema, migrations, seed
│   ├── src/
│   │   ├── index.ts          # entry point
│   │   ├── config/env.ts     # environment loading and validation
│   │   ├── http/             # (planned) admin REST API
│   │   ├── socket/           # (planned) event routing, rate limiting
│   │   ├── rooms/            # (planned) room manager, codes, reconnection, cleanup
│   │   ├── storage/          # (planned) RoomStore interface + in-memory implementation
│   │   ├── engine/           # (planned) shared game engine
│   │   ├── games/            # (planned) one module per game
│   │   ├── moderation/       # (planned) sanitizing, profanity filter
│   │   └── content/          # (planned) language-aware content loading
│   └── tests/
│
├── web/                      # package "web": Next.js frontend
│   └── src/
│       ├── app/
│       ├── components/ (ui, room, games)
│       ├── hooks/
│       └── lib/
│
├── content/en/               # (planned) original datasets, owner-reviewed
├── e2e/                      # (planned) Playwright multi-session tests
└── ...
```

## Notes
- `web` never holds secret game state; it renders only what the server sends that player.
- `server` is the only place that decides scores, roles, words, votes and game completion.
- Room state lives in memory behind a `RoomStore` interface so Redis can be added later.

## Added in the Prisma step (unverified until PROGRESS.md says so)
- `server/prisma.config.ts`: Prisma CLI configuration (loads the root `.env`)
- `server/prisma/schema.prisma`: tables ContentItem, WordPack, Word, ContentReport
- `server/prisma/migrations/`: created by `prisma migrate dev` (committed to Git)
- `server/generated/`: generated Prisma client (NOT committed; rebuild with `db:generate`)
- `server/src/lib/prisma.ts`: the shared database client
- `server/scripts/db-check.ts`: connection check

## Added in the web foundation step (unverified until PROGRESS.md says so)
- `web/src/app/globals.css`: CHAOS CLUB colors, fonts, animations, reduced-motion rule
- `web/src/app/layout.tsx`: fonts (Fredoka, Nunito), metadata, viewport
- `web/src/app/page.tsx`: temporary themed start page (replaced by the real homepage in piece 3)
- `web/src/lib/site.ts`: configurable site name, tagline, description
- `web/src/components/ui/AnimatedWordmark.tsx`: animated title (client component)

## Added in the design system step (unverified until PROGRESS.md says so)
- `web/src/components/ui/`: Button (+ ButtonLink), Card, Badge, Avatar
- `web/src/lib/`: cn.ts (class joiner), theme.ts (accent colors), avatars.ts (avatar + player color lists; move to shared later)
- `web/src/app/design/page.tsx`: development-only preview of the components (404 in production)

## Added in the homepage step (unverified until PROGRESS.md says so)
- `web/src/lib/games.ts`: the five games' names, descriptions, player counts, durations, rules
- `web/src/components/home/`: Hero, HeroHeading, GameCards, HowItWorks, HowToPlay, game-visuals
- `web/src/components/layout/`: Footer, LegalPage
- `web/src/app/`: page.tsx (homepage), about/, contact/, privacy/, terms/
- `AnimatedWordmark.tsx` is no longer used and should be deleted.

## Added in the room rules step (unverified until PROGRESS.md says so)
- `shared/src/events.ts`: event names, error codes and messages, room and player view types
- `shared/src/schemas/events.ts`: Zod schemas for every event payload
- `server/src/rooms/`: RoomManager.ts (all room rules), codes.ts, constants.ts, types.ts
- `server/src/storage/roomStore.ts`: RoomStore interface and the in-memory version
- `server/tests/RoomManager.test.ts` and `shared/tests/events.test.ts`

## Added in the socket step (unverified until PROGRESS.md says so)
- `server/src/app.ts`: builds the whole server (health check, Socket.IO, room gateway) so tests can run it on any free port
- `server/src/index.ts`: starts the server from the .env settings; shuts down cleanly on Ctrl + C
- `server/src/socket/roomGateway.ts`: connects Socket.IO to RoomManager (validation, rate limits, private snapshots, timers)
- `server/src/socket/rateLimiter.ts`: token bucket and per-key limiter
- `server/tests/roomGateway.test.ts` (real socket clients) and `rateLimiter.test.ts`

## Added in the website room flow, part 1 (unverified until PROGRESS.md says so)
- `web/src/lib/`: socket.ts (shared connection), session.ts (tab session and profile), roomClient.ts (room connection store), clipboard.ts
- `web/src/components/ui/Modal.tsx`: pop-up window on the browser dialog element
- `web/src/components/room/`: ProfileForm, Lobby, RoomScreen, RoomLoading
- `web/src/components/home/RoomActions.tsx`: hero buttons plus the Create and Join windows
- `web/src/app/room/[code]/page.tsx`: the room page

## Added in the website room flow, part 2 (unverified until PROGRESS.md says so)
- `web/src/components/room/GameSection.tsx`: game picker, start button, countdown, started message
- `web/src/components/room/Lobby.tsx`: now includes kick buttons and the game section
- `server/src/config/env.ts`: new AVAILABLE_GAMES setting (empty by default; testing only)
- `shared/src/events.ts`: RoomView now includes availableGames

## Added with the Who's Most Likely To server module (unverified until PROGRESS.md says so)
- `shared/src/games/mostLikelyTo.ts`: vote action, view and result types for the game
- `server/src/games/types.ts`: the interface every game module follows
- `server/src/games/mostLikelyTo/MostLikelyToGame.ts`: the game rules, scoring and awards
- `server/src/games/registry.ts`: which games exist
- `server/src/content/loadQuestions.ts`: reads and checks the question file
- `server/src/rooms/RoomManager.ts`: now runs games (actions, tick, early end, back to lobby)
- `content/en/most-likely-to.json`: the 110 approved questions
- Tests: mostLikelyToGame, content, gameFlow (real sockets), plus new RoomManager tests

## Added with the Who's Most Likely To screens (unverified until PROGRESS.md says so)
- `web/src/components/games/mostLikelyTo/`: MostLikelyToScreen (picks the step), VotingView, RevealView, ResultsView, Scoreboard, TimerBar
- `web/src/lib/useCountdown.ts`: countdown that follows the server clock
- `web/src/components/room/Lobby.tsx`: shows the game screen while a game runs
- Server setting MLT_ROUNDS (default 8) for shorter test games

## Added with the Impostor server module (unverified until PROGRESS.md says so)
- `content/en/impostor-words.json`: 100 word pairs
- `shared/src/games/impostor.ts`: actions, steps and the private view
- `server/src/games/impostor/ImpostorGame.ts`: the rules, scoring and awards
- `server/src/games/random.ts`: shuffle and category rotation shared by games
- `server/src/moderation/profanity.ts`: starter word filter
- `server/src/content/loadImpostorWords.ts`
- The game is not offered yet: it is only registered when the word file is passed in (screens come first)
