import { describe, expect, it } from "vitest";
import {
  DRAW_CANVAS_SIZE,
  DRAW_COLORS,
  DRAW_MAX_POINTS_PER_CHUNK,
  drawItWrongActionSchema,
  requestDrawingSchema,
} from "../src";

const stroke = (overrides: Record<string, unknown> = {}) => ({
  type: "stroke",
  id: 1,
  color: DRAW_COLORS[0],
  size: 10,
  points: [[10, 20]],
  ...overrides,
});

describe("drawItWrongActionSchema", () => {
  it("accepts each real action", () => {
    expect(drawItWrongActionSchema.safeParse({ type: "pick", index: 2 }).success).toBe(true);
    expect(drawItWrongActionSchema.safeParse(stroke()).success).toBe(true);
    expect(
      drawItWrongActionSchema.safeParse({ type: "circle", id: 2, color: "#ef4444", size: 4, cx: 500, cy: 500, r: 80 }).success,
    ).toBe(true);
    expect(drawItWrongActionSchema.safeParse({ type: "undo" }).success).toBe(true);
    expect(drawItWrongActionSchema.safeParse({ type: "clear" }).success).toBe(true);
    expect(drawItWrongActionSchema.safeParse({ type: "guess", text: "cat" }).success).toBe(true);
  });

  it("only allows the fixed colors and brush sizes", () => {
    expect(drawItWrongActionSchema.safeParse(stroke({ color: "#123456" })).success).toBe(false);
    expect(drawItWrongActionSchema.safeParse(stroke({ size: 50 })).success).toBe(false);
  });

  it("keeps every point on the canvas and every message small", () => {
    expect(drawItWrongActionSchema.safeParse(stroke({ points: [[DRAW_CANVAS_SIZE + 1, 0]] })).success).toBe(false);
    expect(drawItWrongActionSchema.safeParse(stroke({ points: [[1.5, 2]] })).success).toBe(false);
    expect(drawItWrongActionSchema.safeParse(stroke({ points: [] })).success).toBe(false);
    const tooMany = Array.from({ length: DRAW_MAX_POINTS_PER_CHUNK + 1 }, () => [1, 1]);
    expect(drawItWrongActionSchema.safeParse(stroke({ points: tooMany })).success).toBe(false);
  });

  it("rejects extra fields, a word choice by text, and unknown actions", () => {
    expect(drawItWrongActionSchema.safeParse({ type: "pick", index: 3 }).success).toBe(false);
    expect(drawItWrongActionSchema.safeParse({ type: "pick", index: 0, word: "cat" }).success).toBe(false);
    expect(drawItWrongActionSchema.safeParse({ type: "cheat" }).success).toBe(false);
  });
});

describe("requestDrawingSchema", () => {
  it("needs a known game and an optional round", () => {
    expect(requestDrawingSchema.safeParse({ gameId: "draw-it-wrong" }).success).toBe(true);
    expect(requestDrawingSchema.safeParse({ gameId: "draw-it-wrong", round: 3 }).success).toBe(true);
    expect(requestDrawingSchema.safeParse({ gameId: "draw-it-wrong", round: 0 }).success).toBe(false);
  });
});
