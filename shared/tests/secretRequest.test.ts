import { describe, expect, it } from "vitest";
import { CLIENT_EVENTS, requestSecretSchema } from "../src";

describe("requestSecretSchema", () => {
  it("only needs a known game, and never an id of the player", () => {
    expect(requestSecretSchema.safeParse({ gameId: "impostor" }).success).toBe(true);
    expect(requestSecretSchema.safeParse({ gameId: "impostor", playerId: "someone-else" }).success).toBe(false);
    expect(requestSecretSchema.safeParse({ gameId: "chess" }).success).toBe(false);
  });

  it("has its own event name", () => {
    expect(CLIENT_EVENTS.requestSecret).toBe("game:secret");
  });
});
