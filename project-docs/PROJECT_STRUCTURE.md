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
