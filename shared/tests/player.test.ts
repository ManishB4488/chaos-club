import { describe, expect, it } from "vitest";
import {
  AVATAR_IDS,
  PLAYER_COLORS,
  ROOM_MAX_PLAYERS,
  avatarIdSchema,
  playerColorSchema,
} from "../src";

describe("avatarIdSchema", () => {
  it("accepts a known avatar and rejects an unknown one", () => {
    expect(avatarIdSchema.safeParse("cat").success).toBe(true);
    expect(avatarIdSchema.safeParse("dragon").success).toBe(false);
  });

  it("has no duplicate avatars", () => {
    expect(new Set(AVATAR_IDS).size).toBe(AVATAR_IDS.length);
  });
});

describe("playerColorSchema", () => {
  it("accepts a known color and rejects an unknown one", () => {
    expect(playerColorSchema.safeParse("grape").success).toBe(true);
    expect(playerColorSchema.safeParse("red").success).toBe(false);
  });

  it("has enough colors for every player in a full room", () => {
    expect(PLAYER_COLORS.length).toBeGreaterThanOrEqual(ROOM_MAX_PLAYERS);
  });
});
