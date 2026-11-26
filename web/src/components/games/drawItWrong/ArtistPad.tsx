"use client";

import { Brush, Circle, Eraser, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import {
  DRAW_CANVAS_SIZE,
  DRAW_COLORS,
  DRAW_MAX_POINTS_PER_CHUNK,
  DRAW_SIZES,
  type DrawColor,
  type DrawItWrongAction,
  type DrawRules,
  type DrawSize,
  type DrawingSnapshot,
} from "@chaos/shared";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { DrawingStore } from "@/lib/drawingStore";
import type { DrawingResult } from "@/lib/roomClient";
import { useLiveDrawing } from "@/lib/useLiveDrawing";
import { CanvasSurface } from "./CanvasSurface";

type Tool = "brush" | "circle" | "eraser";
type Point = [number, number];

type ActiveStroke =
  | { kind: "path"; id: number; color: DrawColor; size: DrawSize; buffer: Point[]; last: Point; timer: ReturnType<typeof setTimeout> | null }
  | { kind: "circle"; id: number; color: DrawColor; size: DrawSize; cx: number; cy: number; r: number };

const FLUSH_MS = 60;
const FLUSH_POINTS = 24;
const MIN_POINT_GAP = 3;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function toPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return [
    clamp(Math.round(((event.clientX - rect.left) / rect.width) * DRAW_CANVAS_SIZE), 0, DRAW_CANVAS_SIZE),
    clamp(Math.round(((event.clientY - rect.top) / rect.height) * DRAW_CANVAS_SIZE), 0, DRAW_CANVAS_SIZE),
  ];
}

/** The artist's canvas and tools. Draws locally at once, and sends small pieces of each line to the server. */
export function ArtistPad({
  rules,
  store,
  onMove,
  load,
}: {
  rules: DrawRules;
  store: DrawingStore;
  onMove: (action: DrawItWrongAction) => Promise<string | null>;
  load: (round?: number) => Promise<DrawingResult>;
}) {
  const hasBrush = rules.allowedKinds.includes("path");
  const hasCircle = rules.allowedKinds.includes("circle");
  const canErase = hasBrush && rules.allowedColors.includes("#ffffff");
  const palette = DRAW_COLORS.filter((color) => color !== "#ffffff");

  const [tool, setTool] = useState<Tool>(hasBrush ? "brush" : "circle");
  const [color, setColor] = useState<DrawColor>(rules.allowedColors.find((c) => c !== "#ffffff") ?? "#111111");
  const [size, setSize] = useState<DrawSize>(10);
  const [error, setError] = useState<string | null>(null);

  const nextId = useRef(1);
  const active = useRef<ActiveStroke | null>(null);
  const strokeCount = useSyncExternalStore(store.subscribe, () => store.count(), () => 0);

  const resync = useLiveDrawing(store, load, {
    live: false,
    onLoaded: (snapshot: DrawingSnapshot) => {
      nextId.current = Math.max(nextId.current, snapshot.nextStrokeId);
    },
  });

  useEffect(() => {
    store.setBlank(rules.hideCanvasFromArtist);
  }, [store, rules.hideCanvasFromArtist]);

  /** Sends one move. If the server refuses it, show why and fetch the true drawing again. */
  function send(action: DrawItWrongAction) {
    void onMove(action).then((message) => {
      if (message) {
        setError(message);
        void resync();
      }
    });
  }

  function flush(stroke: Extract<ActiveStroke, { kind: "path" }>, finished: boolean) {
    if (stroke.timer) clearTimeout(stroke.timer);
    stroke.timer = null;
    let points = stroke.buffer.splice(0, DRAW_MAX_POINTS_PER_CHUNK);
    if (points.length === 0) {
      if (!finished) return;
      points = [stroke.last];
    }
    send({ type: "stroke", id: stroke.id, color: stroke.color, size: stroke.size, points, done: finished && stroke.buffer.length === 0 });
    if (stroke.buffer.length > 0) flush(stroke, finished);
  }

  function handleDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (active.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    setError(null);
    if (store.count() >= rules.maxStrokes) {
      setError("You have no lines left.");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);
    const id = nextId.current++;

    if (tool === "circle") {
      active.current = { kind: "circle", id, color, size, cx: point[0], cy: point[1], r: 1 };
      store.addStroke({ id, kind: "circle", color, size, cx: point[0], cy: point[1], r: 1, done: true });
      return;
    }
    const strokeColor: DrawColor = tool === "eraser" ? "#ffffff" : color;
    const stroke: Extract<ActiveStroke, { kind: "path" }> = {
      kind: "path",
      id,
      color: strokeColor,
      size,
      buffer: [],
      last: point,
      timer: null,
    };
    active.current = stroke;
    store.addStroke({ id, kind: "path", color: strokeColor, size, points: [point], done: false });
    send({ type: "stroke", id, color: strokeColor, size, points: [point], done: false });
  }

  function handleMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = active.current;
    if (!stroke) return;
    const point = toPoint(event);

    if (stroke.kind === "circle") {
      const r = clamp(Math.round(Math.hypot(point[0] - stroke.cx, point[1] - stroke.cy)), 1, DRAW_CANVAS_SIZE / 2);
      stroke.r = r;
      store.setCircleRadius(stroke.id, r);
      return;
    }
    if (Math.hypot(point[0] - stroke.last[0], point[1] - stroke.last[1]) < MIN_POINT_GAP) return;
    stroke.last = point;
    stroke.buffer.push(point);
    store.appendPoints(stroke.id, [point], false);
    if (stroke.buffer.length >= FLUSH_POINTS) flush(stroke, false);
    else if (!stroke.timer) stroke.timer = setTimeout(() => flush(stroke, false), FLUSH_MS);
  }

  function handleUp() {
    const stroke = active.current;
    active.current = null;
    if (!stroke) return;
    if (stroke.kind === "circle") {
      send({ type: "circle", id: stroke.id, color: stroke.color, size: stroke.size, cx: stroke.cx, cy: stroke.cy, r: stroke.r });
      return;
    }
    store.appendPoints(stroke.id, [], true);
    flush(stroke, true);
  }

  function undo() {
    setError(null);
    if (store.popLast()) send({ type: "undo" });
  }

  function clear() {
    setError(null);
    store.clear();
    send({ type: "clear" });
  }

  const linesLeft = rules.maxStrokes - strokeCount;
  const limited = rules.maxStrokes <= 5;

  return (
    <div className="flex flex-col gap-4">
      <CanvasSurface
        store={store}
        label="Your drawing"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      />

      {rules.hideCanvasFromArtist && (
        <p className="text-center font-semibold text-sunny">
          Eyes closed! You cannot see your drawing, but everyone else can.
        </p>
      )}
      {limited && (
        <p role="status" className="text-center font-display text-xl font-semibold">
          Lines left: {Math.max(0, linesLeft)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tool === "brush" ? "primary" : "secondary"} disabled={!hasBrush} aria-pressed={tool === "brush"} onClick={() => setTool("brush")}>
          <Brush aria-hidden className="size-4" />
          Brush
        </Button>
        <Button size="sm" variant={tool === "circle" ? "primary" : "secondary"} disabled={!hasCircle} aria-pressed={tool === "circle"} onClick={() => setTool("circle")}>
          <Circle aria-hidden className="size-4" />
          Circle
        </Button>
        <Button size="sm" variant={tool === "eraser" ? "primary" : "secondary"} disabled={!canErase} aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>
          <Eraser aria-hidden className="size-4" />
          Eraser
        </Button>
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" disabled={!rules.canUndo || strokeCount === 0} onClick={undo}>
            <Undo2 aria-hidden className="size-4" />
            Undo
          </Button>
          <Button size="sm" variant="danger" disabled={!rules.canClear || strokeCount === 0} onClick={clear}>
            <Trash2 aria-hidden className="size-4" />
            Clear
          </Button>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colors">
        {palette.map((swatch) => {
          const allowed = rules.allowedColors.includes(swatch);
          return (
            <button
              key={swatch}
              type="button"
              aria-label={`Color ${swatch}`}
              aria-pressed={color === swatch}
              disabled={!allowed}
              onClick={() => setColor(swatch)}
              style={{ backgroundColor: swatch }}
              className={cn(
                "size-11 rounded-full ring-4 ring-transparent transition disabled:opacity-25",
                color === swatch && tool !== "eraser" && "ring-white",
              )}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Brush size">
        {DRAW_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            aria-label={`Brush size ${option}`}
            aria-pressed={size === option}
            onClick={() => setSize(option)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border-2 border-white/15 bg-night-800",
              size === option && "border-sunny",
            )}
          >
            <span className="rounded-full bg-ink" style={{ width: option + 4, height: option + 4 }} />
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}
    </div>
  );
}
