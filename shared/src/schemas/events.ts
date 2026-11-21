import { z } from "zod";
import { GAME_IDS } from "../constants";
import { avatarIdSchema, playerColorSchema } from "./player";
import { nicknameSchema, roomCodeSchema } from "./room";

// strictObject rejects any extra, unexpected fields.
const profileFields = {
  nickname: nicknameSchema,
  avatar: avatarIdSchema,
  color: playerColorSchema,
};

export const createRoomSchema = z.strictObject(profileFields);

export const joinRoomSchema = z.strictObject({ ...profileFields, code: roomCodeSchema });

export const rejoinRoomSchema = z.strictObject({
  code: roomCodeSchema,
  sessionToken: z.string().min(16).max(128),
});

export const kickPlayerSchema = z.strictObject({ playerId: z.string().min(1).max(64) });

export const selectGameSchema = z.strictObject({ gameId: z.enum(GAME_IDS) });

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type RejoinRoomInput = z.infer<typeof rejoinRoomSchema>;
export type KickPlayerInput = z.infer<typeof kickPlayerSchema>;
export type SelectGameInput = z.infer<typeof selectGameSchema>;

/** Wrapper for any in-game action. Each game checks its own `action` shape. */
export const gameActionSchema = z.strictObject({
  gameId: z.enum(GAME_IDS),
  action: z.unknown(),
});
export type GameActionInput = z.infer<typeof gameActionSchema>;

/** Asking for your own secret in the running game. The player is identified by their connection, never by this payload. */
export const requestSecretSchema = z.strictObject({ gameId: z.enum(GAME_IDS) });
export type RequestSecretInput = z.infer<typeof requestSecretSchema>;
