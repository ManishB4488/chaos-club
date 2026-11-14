# CHAOS CLUB: DEVELOPMENT PROGRESS

## Current Phase
Phase 1: Project Foundation

## Rules for this file
Update after every development session. Never mark a feature complete unless it has been implemented AND tested.
"Planned" is not "done".

## Planning and Documentation
- [x] Project documents reviewed
- [x] Technical decisions approved by owner (see DECISIONS.md)
- [x] PROJECT_STRUCTURE.md updated
- [x] PROGRESS.md cleaned
- [x] DECISIONS.md created
- [x] Architecture proposals P-1 to P-7 approved
- [x] Proposals P-8, P-9 and P-10 approved (by owner delegation)
- [ ] Scoring rules proposed and approved (required before implementing any game)

## Phase 1: Foundation
- [x] Prerequisites verified (Node 24.11.1, npm 11.6.2, Git 2.52.0, Docker 29.9.2, Compose 5.6.1)
- [x] Git repository initialised
- [x] Next.js web app created and confirmed running at localhost:3000
- [x] npm workspaces linked (root package.json, web + server + shared): npm install succeeded; server resolves @chaos/shared
- [x] Shared package: 7 Vitest tests pass (npm test)
- [x] Server package: typecheck passes, server starts on port 4000 and loads shared + .env
- [x] Server /health page confirmed in browser
- [x] PostgreSQL 16 running via Docker Compose (healthy, accepting connections)
- [x] Prisma 7.10.1 installed (security patch), client generated, typecheck and db:check pass
- [x] Server production audit clean (npm audit --omit=dev: 0 vulnerabilities)
- [x] 7 moderate dev-tool warnings (minimatch via typescript-eslint, web linting only) reviewed; plain `npm audit fix` does not clear them; ACCEPTED, re-check when web tooling updates. Never use `npm audit fix --force`.
- [x] First migration (20261114054931_init) applied; db:check connects and reads 0 rows
- [x] Prisma migration committed to Git
- [x] Vitest configured and verified
- [x] Prettier verified (npm run format)
- [x] First Git commit made (18498ba, .env excluded)
- [x] Web foundation: theme, fonts, layout, Framer Motion + Lucide (verified: lint, build, browser render, background glow, phone width on iPhone 16 size; Console errors not reported)
- [x] Design system components: Button, Card, Badge, Avatar (verified: lint, build, desktop and phone rendering, Tab focus, press, Console; /design preview is development only)
- [ ] Modal and Timer components (built when the room screens need them)
- [ ] Link web to @chaos/shared (needs next.config.ts reviewed) and move avatar/color lists into shared
- [x] Homepage (hero with example room, Choose Your Chaos cards, How it works, How to play, footer): verified on desktop and phone width
- [x] Footer pages: About, Contact, Privacy, Terms built and verified. Contact, Privacy and Terms are DRAFTS needing owner review and a real contact email.
- [ ] Homepage Create/Join Room buttons working (needs the room system)
- [ ] Web linked to @chaos/shared (avatar and color lists moved into shared)
- [ ] Web linked to @chaos/shared (avatar and color lists moved into shared)
- [ ] Create Room
- [ ] Join Room
- [ ] Multiplayer lobby (host controls, kick, leave, per-game minimum players)
- [ ] Reconnection after refresh
- [ ] Socket.IO browser connection

## Games (do not start until the multiplayer foundation works)
- [ ] Who's Most Likely To? (2-4 players)
- [ ] Impostor Word Game (3-4 players)
- [ ] Roast Your Friends (2-4 players)
- [ ] The Fake Answer (2-4 players)
- [ ] Draw It Wrong (2-4 players)

## Testing
- [ ] Two-player testing
- [ ] Three-player testing
- [ ] Four-player testing
- [ ] Mobile testing
- [ ] Automated tests (Vitest)
- [ ] Automated multi-session tests (Playwright)

## Known Bugs
None recorded yet.

## Notes
- A leftover `next dev` server was still running on port 3000, so the dev server moved to 3001. Always stop old servers with Ctrl+C before starting new ones.
- The Network address shown by `next dev` may be a virtual adapter. Use the Wi-Fi IPv4 address from `ipconfig` for phone testing.

## Accepted risks
- 7 moderate npm audit warnings in web linting tools (minimatch via typescript-eslint). Dev-only, not in the game server.

## Next Task
Verify the web-to-shared link (tests, typecheck, build, /design and homepage still render). Then the room system, server side first.
