/** A disconnected player keeps their seat this long (lobby and countdown only). */
export const DISCONNECT_GRACE_MS = 60_000;
/** A room where nobody is connected is deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 10 * 60_000;
/** Length of the countdown before a game starts. */
export const START_COUNTDOWN_MS = 5_000;
/** Upper limit on rooms held in memory at once. */
export const MAX_ROOMS = 1_000;
/** How many times to retry when a random room code is already taken. */
export const CODE_ATTEMPTS = 20;
