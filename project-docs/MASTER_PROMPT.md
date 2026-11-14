# Build a Complete Multiplayer Party Games Website

Act as a senior full-stack developer, multiplayer game developer, UI/UX designer and product architect.

I want you to build a complete, modern, fun and highly interactive multiplayer party games website where 2–4 friends can join a private room and play entertaining games together in real time.

The website should feel like a combination of a modern gaming platform and a digital party room. It should be colorful, humorous, addictive, easy to navigate and extremely enjoyable on both desktop and mobile devices.

Project name: **CHAOS CLUB** (keep the name configurable).

Tagline: **Less serious. More chaos.**

The website must be fully functional. Do not create just static UI designs or non-functional buttons. All games, room creation, joining, voting, submissions, scoring and multiplayer interactions must work.

---

# 1. TECHNOLOGY STACK

Use the following technologies:

Frontend:
- Next.js with React.
- TypeScript.
- Tailwind CSS.
- Framer Motion for animations.
- Lucide icons.
- Canvas API for drawing gameplay.

Backend:
- Node.js.
- Socket.IO for real-time multiplayer communication.
- PostgreSQL for persistent data.
- Prisma ORM.
- Redis for room state and scaling when needed.

Use a clean, modular architecture with reusable components.

If the deployment environment does not support PostgreSQL or Redis initially, use a development-friendly alternative without compromising the architecture.

---

# 2. WEBSITE DESIGN AND BRAND IDENTITY

Create a visually impressive gaming website.

Design direction:
- Modern arcade gaming aesthetic.
- Dark purple or deep navy background.
- Vibrant purple, electric blue, orange, pink and yellow accents.
- Rounded cards and buttons.
- Smooth transitions.
- Animated gradients.
- Playful illustrations and avatars.
- Large typography.
- Confetti and celebration effects.
- Responsive layouts.

Avoid making it look like a corporate dashboard.

The interface should communicate fun, competition and friendship.

Create a consistent design system with reusable buttons, cards, badges, modals, timers, avatars and game components.

---

# 3. HOMEPAGE

Build an attractive homepage.

Hero section:

Heading:
"Your Friends. Your Room. Absolute Chaos."

Subtitle:
"Gather your friends, join a room and find out who is the funniest, smartest and biggest liar."

Primary buttons:
- Create a Room
- Join a Room
- Explore Games

Show animated player avatars and game illustrations.

Include a section called "Choose Your Chaos" containing five game cards.

Each card should include:
- Game illustration.
- Game name.
- Short description.
- Number of players.
- Average game duration.
- Play Now button.

The five games are:

1. Who's Most Likely To?
2. Impostor Word Game.
3. Roast Your Friends.
4. Draw It Wrong.
5. The Fake Answer.

Also include:
- How It Works section.
- Popular Games section.
- How to Play section.
- Footer with About, Contact, Privacy Policy and Terms.

---

# 4. MULTIPLAYER ROOM SYSTEM

This is one of the most important features.

Create a robust multiplayer room system.

Room creation:

When someone clicks Create Room:
- Ask for their nickname.
- Generate a unique 6-character room code.
- Create a private game room.
- Make the creator the room host.
- Show the room lobby.

Joining a room:

When someone clicks Join Room:
- Ask for nickname.
- Ask for room code.
- Validate the room code.
- Allow the player to enter if the room exists and has available capacity.

Room requirements:
- Minimum players: 2.
- Maximum players: 4.
- Show all connected players.
- Show player avatars and nicknames.
- Show the host indicator.
- Allow the host to select the game.
- Allow the host to start the game.
- Display a waiting message until enough players join.
- Allow the host to kick a player.
- Allow players to leave the room.
- Show connection and disconnection status.
- Support reconnecting after accidental page refresh.
- Show a countdown before starting.

Add an invitation feature:
- Copy room code.
- Copy room invitation URL.
- Share invitation through WhatsApp using the native share functionality when available.

Use Socket.IO for live room synchronization.

Important: Room codes must be unique and validated on the server.

---

# 5. GAME 1: WHO'S MOST LIKELY TO?

Build a fully functional voting-based party game.

Gameplay:

1. Display a funny question on the screen.
2. Every player secretly votes for one of the other players.
3. A player cannot vote for themselves.
4. Votes remain hidden until everyone has submitted.
5. Reveal all votes simultaneously.
6. Display the player who received the most votes.
7. Award points.
8. Move to the next question.

Example questions:
- Who is most likely to become a millionaire and forget their friends?
- Who would survive the longest in a zombie apocalypse?
- Who is most likely to become famous for something stupid?
- Who would accidentally text their crush to the family group?
- Who is most likely to sleep through their own wedding?

Features:
- At least 100 initial questions.
- Different question categories.
- Random question selection.
- Custom questions.
- Anonymous voting until reveal.
- Vote reveal animations.
- Funny player titles.
- Scoreboard.
- Tie-breaking logic.

At the end, show awards:
- Biggest Drama Queen.
- Most Suspicious.
- Walking Disaster.
- Main Character.
- Most Voted Player.

---

# 6. GAME 2: IMPOSTOR WORD GAME

Build a social deduction game.

Gameplay:

1. Assign a secret word to every player.
2. Most players receive the same word.
3. One randomly selected player receives a different but related word, or no word in special mode.
4. Players take turns giving clues.
5. Other players discuss and try to identify the impostor.
6. Everyone votes.
7. Reveal the impostor.
8. Award points based on the result.

Example:
- Normal players receive: Pizza.
- Impostor receives: Burger.

Features:
- Secret word distribution.
- Private word reveal screen.
- Word categories such as food, movies, animals, places and objects.
- Custom word packs.
- Turn timer.
- Clue submission.
- Voting phase.
- Impostor reveal animation.
- Impostor gets a final chance to guess the main word.
- Scoreboard.

Important:
Secret words and player roles must only be sent to the appropriate player. Never expose secret roles in public room events or frontend shared state.

---

# 7. GAME 3: ROAST YOUR FRIENDS

Build a funny creative-answer competition.

Gameplay:

1. Display a funny situation or prompt.
2. Every player submits a response.
3. Submissions remain anonymous.
4. Once everyone submits, display all responses.
5. Players vote for the funniest answer.
6. The winning answer receives points.
7. Move to the next round.

Example prompts:

- Your friend gets arrested. What's the most likely reason?
- What would your friend do if they became invisible for one day?
- What is the worst possible thing to say during a job interview?
- What would your friend name their autobiography?
- What is the most embarrassing superpower?

Features:
- Anonymous submissions.
- Countdown timer.
- Random prompt generator.
- Custom prompts.
- Voting system.
- Winning response animation.
- Funny award titles.
- Scoreboard.
- Copy and share winning responses.

Allow users to report inappropriate submissions. Provide basic profanity filtering and moderation.

---

# 8. GAME 4: DRAW IT WRONG

Build a real-time multiplayer drawing and guessing game.

Gameplay:

1. Randomly select one player as the artist.
2. Give the artist three secret word choices.
3. Artist chooses one word.
4. Artist gets 30–60 seconds to draw.
5. Other players guess through a live chat or guess input.
6. Award points to correct guessers.
7. Award points to the artist based on successful guesses.
8. Rotate the artist.

Drawing tools:
- Canvas drawing.
- Multiple brush sizes.
- Color palette.
- Eraser.
- Clear canvas.
- Undo.
- Drawing timer.

Unique game modes:
- Draw using only circles.
- Draw without lifting the mouse.
- Draw with eyes closed using a simulated challenge.
- Draw using one color.
- Draw with a limited number of strokes.

Important multiplayer requirements:
- Synchronize drawing strokes using Socket.IO.
- Broadcast drawing updates to all players in real time.
- Do not transmit the entire canvas image after every stroke.
- Use efficient stroke events.
- Keep the secret word hidden from guessers.
- Show guesses and drawing updates live.

Add a final drawing replay feature that replays the strokes in sequence.

---

# 9. GAME 5: THE FAKE ANSWER

Build a bluffing and trivia party game.

Gameplay:

1. Display a strange trivia question.
2. Each player submits a fake answer.
3. Add the real answer from the question database.
4. Randomly shuffle all answers.
5. Display the answers to everyone.
6. Players select the answer they believe is correct.
7. Reveal the real answer.
8. Award points.

Example question:

"What is the collective noun for a group of flamingos?"

Players create funny fake answers such as:
- A pink parliament.
- A flamingo festival.
- A squad of fashion models.

Features:
- At least 100 trivia questions.
- Multiple categories.
- Custom questions.
- Anonymous answer submissions.
- Random answer ordering.
- Voting system.
- Real answer reveal animation.
- Points for correct answers.
- Points when other players select your fake answer.
- Round scoreboard.

Make sure players cannot see who submitted which fake answer before voting finishes.

---

# 10. COMMON GAME ENGINE

Build a reusable game engine for all five games.

Common functionality:
- Game lobby.
- Player synchronization.
- Round management.
- Timers.
- Score management.
- Player turn management.
- Voting.
- Game completion.
- Result screen.
- Rematch option.

Each game should have its own independent module, but share the common multiplayer infrastructure.

The server must validate all player actions.

Never trust scores, votes, secret words, roles or game completion events sent by clients.

Handle disconnections and reconnects gracefully.

---

# 11. PLAYER PROFILES AND AVATARS

Allow users to play as guests without registration.

Create a fun avatar selection system.

Example player titles:
- Professional Liar.
- Certified Overthinker.
- Drama Machine.
- Walking Disaster.
- Suspicious Potato.
- The Mastermind.
- Chaos Creator.

Allow users to select:
- Nickname.
- Avatar.
- Player color.

Optional future feature:
Create registered accounts to save statistics, achievements and unlocked avatars.

---

# 12. SCORING AND LEADERBOARD

Create a unified scoring system.

Every game should have its own scoring rules.

At the end of each game show:
- Winner.
- Final ranking.
- Total points.
- Funny awards.
- Best answer.
- Funniest moment.

Add a leaderboard for:
- Most games played.
- Most wins.
- Highest average score.
- Funniest player.
- Most voted player.

Keep leaderboard data accurate and persistent for registered players.

---

# 13. VIRAL AND SOCIAL FEATURES

Build these features into the platform:

1. Shareable game result cards.
2. Copy room invitation links.
3. WhatsApp sharing.
4. Funny result animations.
5. Daily multiplayer challenges.
6. Random game selection mode.
7. Friend group statistics.
8. Rematch button.
9. Custom question packs.
10. Funny reactions during games.

Create visually attractive result cards suitable for sharing on WhatsApp, Instagram Stories and other social platforms.

Do not require registration before joining a game.

---

# 14. SOUND AND ANIMATIONS

Use tasteful sound effects and animations.

Examples:
- Room created sound.
- Player joined sound.
- Countdown sound.
- Voting submitted sound.
- Impostor reveal sound.
- Winner celebration.
- Confetti animation.
- Funny losing animation.

Provide mute controls.

Avoid excessive animation that slows down mobile devices.

---

# 15. MOBILE RESPONSIVENESS

The entire website must work perfectly on:
- Desktop.
- Laptop.
- Tablets.
- Android phones.
- iPhones.

Important:
- Large touch-friendly buttons.
- Responsive game cards.
- Properly sized drawing canvas.
- Mobile-friendly voting screens.
- Easy invitation sharing.
- No horizontal overflow.
- Fast loading.

---

# 16. SECURITY AND RELIABILITY

Implement:
- Server-side game validation.
- Room access validation.
- Rate limiting.
- Input validation.
- Nickname sanitization.
- Basic profanity filtering.
- Socket event validation.
- Protection against duplicate voting.
- Protection against duplicate submissions.
- Reconnection support.
- Automatic cleanup of abandoned rooms.
- No exposure of secret words or roles.
- Safe handling of user-generated content.

---

# 17. ADMIN PANEL

Create an admin dashboard where the administrator can:

- View active rooms.
- View active players.
- Add, edit and delete questions.
- Manage word packs.
- Manage trivia questions.
- Manage custom prompts.
- Review reported content.
- View game usage statistics.
- Manage users.
- Disable inappropriate content.

Protect the admin panel with proper authentication and authorization.

---

# 18. DEVELOPMENT APPROACH

Build the application in phases.

Phase 1:
- Design system.
- Homepage.
- Room creation and joining.
- Multiplayer lobby.
- Real-time connection.

Phase 2:
- Who's Most Likely To?
- Impostor Word Game.

Phase 3:
- Roast Your Friends.
- The Fake Answer.

Phase 4:
- Draw It Wrong.
- Drawing synchronization and replay.

Phase 5:
- Profiles.
- Leaderboards.
- Achievements.
- Shareable result cards.

Phase 6:
- Admin panel.
- Testing.
- Performance optimization.
- Production deployment.

Do not attempt to implement all five games as one giant component.

Use separate folders and reusable game modules.

---

# 19. EXPECTED DELIVERABLE

I want a real working application, not a prototype.

Deliver:
- Complete frontend.
- Backend APIs.
- Socket.IO multiplayer infrastructure.
- Database schema.
- Working game logic for all five games.
- Seed data for questions and words.
- Responsive UI.
- Environment variable example.
- Setup instructions.
- Database migration instructions.
- Local development instructions.
- Production deployment instructions.

Include proper loading states, error messages, empty states and reconnecting states.

All buttons and interactions must work.

Do not use fake player activity to simulate multiplayer. Test with multiple real browser sessions.

If a feature is incomplete, clearly identify it rather than presenting a placeholder as a completed feature.

Start by creating the project architecture and design system. Then implement the shared room infrastructure and each game one by one.

The final result should feel like a polished, launch-ready multiplayer party gaming platform that people genuinely enjoy playing with their friends.