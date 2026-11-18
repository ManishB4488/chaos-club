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
- [x] Scoring rules approved (D-026), content approved (D-027)

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
- [x] Web linked to @chaos/shared (avatar and color lists moved into shared): verified (11 tests, typecheck, lint, build)
- [x] Web linked to @chaos/shared (avatar and color lists moved into shared): verified (11 tests, typecheck, lint, build)
- [x] Room rules (RoomManager) and shared event contracts: 26 server tests and 17 shared tests pass, typecheck clean
- [x] Socket.IO room events, validation, rate limiting: 8 real-client tests pass (37 server tests total), typecheck clean, server starts
- [x] Server /health after the socket changes confirmed (shutdown with Ctrl + C still to confirm)
- [x] Website room flow, part 1: lint, build and 38 server + 17 shared tests pass; create, join, lobby, live updates, copy and share confirmed in Chrome and Brave. Still to confirm individually: refresh reconnect, invite-link join, Offline badge, Leave, wrong code.
- [x] Website room flow, part 2: game picker, start button, countdown, kick buttons, available-games setting. Verified: 39 server + 17 shared tests, typecheck, lint, build; countdown and game phase worked in two real windows.
- [x] Phone test over Wi-Fi: homepage, game server health page and joining a room from a real phone all worked (website dev server reads WEB_ORIGIN for allowedDevOrigins)
- [x] Four-window test with four separate sessions (normal, incognito, second browser, real phone): worked, including full room, kick and rejoin, host handover, phone lock and reconnect, refresh
- [x] Single-program production mode (website + game server on one address): owner reports it works
- [x] Deployed on Render free tier by the owner (not checked by me; live checks to be reported by owner)
- [ ] Create Room
- [ ] Join Room
- [ ] Multiplayer lobby (host controls, kick, leave, per-game minimum players)
- [ ] Reconnection after refresh
- [ ] Socket.IO browser connection

## Games (do not start until the multiplayer foundation works)
- [x] Who's Most Likely To? (2-4 players): server module and screens verified by owner (70 server + 20 shared tests, voting, reveal, results, play again, phone)
- [ ] Impostor Word Game (3-4 players). Words approved; server module VERIFIED (95 server + 23 shared tests, typecheck, build). Screens written and the game switched on: NOT yet verified with real windows.
- [ ] Roast Your Friends (2-4 players). Prompts approved; server module and screens written and the game switched on: NOT yet verified (owner has not yet reported the server test results).
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
Verify Roast with 3 real windows and a 2 player room. Then The Fake Answer (needs 100+ trivia questions for review) and Draw It Wrong. Before any public launch: expand the word filter list, review draft legal pages, set a real contact email.
