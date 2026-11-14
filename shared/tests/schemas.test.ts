import { describe, expect, it } from "vitest";
import { GAME_PLAYER_LIMITS, nicknameSchema, roomCodeSchema } from "../src";

describe("roomCodeSchema", () => {
  it("accepts a valid code and upper-cases it", () => {
    expect(roomCodeSchema.parse(" abc234 ")).toBe("ABC234");
  });

  it("rejects a code with look-alike characters", () => {
    expect(roomCodeSchema.safeParse("ABCDE0").success).toBe(false);
  });

  it("rejects a code of the wrong length", () => {
    expect(roomCodeSchema.safeParse("ABC23").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABC2345").success).toBe(false);
  });
});

describe("nicknameSchema", () => {
  it("accepts and trims a normal nickname", () => {
    expect(nicknameSchema.parse("  Priya_7 ")).toBe("Priya_7");
  });

  it("rejects too-short nicknames", () => {
    expect(nicknameSchema.safeParse("a").success).toBe(false);
  });

  it("rejects HTML or symbols", () => {
    expect(nicknameSchema.safeParse("<script>").success).toBe(false);
  });
});

describe("GAME_PLAYER_LIMITS", () => {
  it("requires 3 players for the Impostor game and 2 for the others", () => {
    expect(GAME_PLAYER_LIMITS.impostor.min).toBe(3);
    expect(GAME_PLAYER_LIMITS["most-likely-to"].min).toBe(2);
  });
});
