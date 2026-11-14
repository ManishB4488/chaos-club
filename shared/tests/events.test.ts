import { describe, expect, it } from "vitest";
import { createRoomSchema, joinRoomSchema, rejoinRoomSchema, selectGameSchema } from "../src";

const profile = { nickname: "Priya", avatar: "cat", color: "grape" } as const;

describe("event payload schemas", () => {
  it("accepts a valid create payload", () => {
    expect(createRoomSchema.safeParse(profile).success).toBe(true);
  });

  it("rejects unexpected extra fields", () => {
    expect(createRoomSchema.safeParse({ ...profile, isHost: true }).success).toBe(false);
  });

  it("normalises the room code when joining", () => {
    const parsed = joinRoomSchema.parse({ ...profile, code: " abc234 " });
    expect(parsed.code).toBe("ABC234");
  });

  it("rejects a bad room code, nickname or avatar", () => {
    expect(joinRoomSchema.safeParse({ ...profile, code: "ABC" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ ...profile, nickname: "<b>" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ ...profile, avatar: "dragon" }).success).toBe(false);
  });

  it("requires a session token to rejoin", () => {
    expect(rejoinRoomSchema.safeParse({ code: "ABC234" }).success).toBe(false);
  });

  it("only accepts known games", () => {
    expect(selectGameSchema.safeParse({ gameId: "impostor" }).success).toBe(true);
    expect(selectGameSchema.safeParse({ gameId: "chess" }).success).toBe(false);
  });
});
