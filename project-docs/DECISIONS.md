# CHAOS CLUB: DECISIONS LOG

Architecture is never changed silently. Every change is recorded here with the owner's approval.

## Approved decisions

| ID | Area | Decision |
|---|---|---|
| D-001 | Architecture | Separate `server/` process in the same repository. Next.js serves the frontend; Node.js + Socket.IO handles real-time multiplayer. |
| D-002 | Shared code | Common shared package for types and validation contracts. |
| D-003 | Database | PostgreSQL via Docker Compose for local development. |
| D-004 | Redis | Optional for now. In-memory room state first, behind a storage interface so Redis can be added later. |
| D-005 | Tooling | **Updated:** Node.js 22 or newer LTS (owner develops on Node 24.11.1), npm, Vitest. Root `package.json` declares `engines: node >=22`. |
| D-006 | Testing | Playwright for end-to-end multiplayer tests. |
| D-007 | Hosting | Plan for Railway initially; stay portable. **No deployment and no paid services without explicit owner approval.** |
| D-008 | Min players | Most Likely To 2-4; Impostor 3-4; Roast 2-4; Fake Answer 2-4; Draw It Wrong 2-4. Shown in each lobby and enforced on the server. |
| D-009 | Impostor | Related-word mode first. No-word mode is a future optional feature. |
| D-010 | Accounts | Guests need no registration. Initial version has a secure admin-only login. Player accounts and personal stats come later. |
| D-011 | Language | English first. Content architecture ready for future Hinglish. Appropriate moderation. |
| D-012 | Content | Original datasets, 100+ items per relevant game, reviewed by the owner before finalizing. |
| D-013 | Layout | Monorepo with `web/`, `server/`, `shared/` folders. Replaces the earlier plan of `src/` at the root. |
| D-014 | Sound | Properly licensed free sounds or original generated sounds. |
| D-015 | Process | Games do not start until the multiplayer foundation works. Beginner-friendly explanations for every command. Never assume a tool is installed. |
| D-016 | Database access | (P-1) Prisma and database access live in `server/` only. The web app never talks to the database; the admin panel calls a server HTTP API. |
| D-017 | Identity | (P-2) Reconnection uses a random session token in `sessionStorage`, one per browser tab. |
| D-018 | Secrets | (P-3) Per-player state projection: the server sends each player only what they may see. Secrets go only to the owning socket. |
| D-019 | Admin login | (P-4) Single admin account, password hash from environment variables, secure httpOnly session cookie. Database admin users later. |
| D-020 | Ports | (P-5) Web 3000, server 4000, PostgreSQL 5432. |
| D-021 | Content storage | (P-6) JSON files in `content/en/`, loaded into PostgreSQL by a seed script. |
| D-022 | Scoring | (P-7) Scoring rules for all five games are written and approved by the owner BEFORE any game is implemented. |

## Proposed: awaiting owner approval

| ID | Proposal | Why |
|---|---|---|
| P-8 | The server runs TypeScript directly with `tsx` (no separate build step) in development and, initially, in production. Revisit before the first deployment. | Keeps setup simple for a beginner. A compiled build may be better for production. |
| P-9 | The web package keeps its generated name `web` (not `@chaos/web`). A single `.env` at the project root serves the server and Docker; the website reads `web/.env.local` when it needs settings. | Avoids unnecessary renaming. Next.js only reads env files inside `web/`. |

## Open questions

None at this time.
