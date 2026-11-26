import { DRAW_CANVAS_SIZE, type DrawDelta, type DrawStroke } from "@chaos/shared";

function copyStroke(stroke: DrawStroke): DrawStroke {
  return stroke.kind === "path"
    ? { ...stroke, points: stroke.points.map(([x, y]) => [x, y] as [number, number]) }
    : { ...stroke };
}

/**
 * Holds the lines of ONE drawing and paints them onto a canvas. It lives outside React: drawing changes
 * many times a second, and repainting through React state would be far too slow.
 */
export class DrawingStore {
  private strokes: DrawStroke[] = [];
  private version = 0;
  private readonly listeners = new Set<() => void>();
  private canvas: HTMLCanvasElement | null = null;
  private blank = false;
  private frame = 0;

  /** For useSyncExternalStore: tells React when the number of lines changes. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getVersion = (): number => this.version;

  count(): number {
    return this.strokes.length;
  }

  attach(canvas: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    this.schedule();
  }

  /** "Eyes closed": the artist's own canvas stays empty, whatever is drawn. */
  setBlank(blank: boolean): void {
    if (this.blank === blank) return;
    this.blank = blank;
    this.schedule();
  }

  invalidate(): void {
    this.schedule();
  }

  dispose(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.listeners.clear();
    this.canvas = null;
  }

  replace(strokes: readonly DrawStroke[]): void {
    this.strokes = strokes.map(copyStroke);
    this.changed();
  }

  /** Applies a live update that came from the server. */
  apply(delta: DrawDelta): void {
    if (delta.type === "clear") {
      this.strokes = [];
    } else if (delta.type === "undo") {
      this.strokes = this.strokes.filter((stroke) => stroke.id !== delta.strokeId);
    } else if (delta.append) {
      const existing = this.strokes.find((stroke) => stroke.id === delta.stroke.id);
      if (existing && existing.kind === "path" && delta.stroke.kind === "path") {
        existing.points.push(...delta.stroke.points);
        existing.done = delta.stroke.done;
      }
    } else if (!this.strokes.some((stroke) => stroke.id === delta.stroke.id)) {
      this.strokes.push(copyStroke(delta.stroke));
    }
    this.changed();
  }

  addStroke(stroke: DrawStroke): void {
    this.strokes.push(copyStroke(stroke));
    this.changed();
  }

  appendPoints(id: number, points: [number, number][], done: boolean): void {
    const stroke = this.strokes.find((entry) => entry.id === id);
    if (stroke && stroke.kind === "path") {
      stroke.points.push(...points);
      if (done) stroke.done = true;
      this.changed();
    }
  }

  setCircleRadius(id: number, r: number): void {
    const stroke = this.strokes.find((entry) => entry.id === id);
    if (stroke && stroke.kind === "circle") {
      stroke.r = r;
      this.changed();
    }
  }

  popLast(): DrawStroke | undefined {
    const last = this.strokes.pop();
    this.changed();
    return last;
  }

  clear(): void {
    this.strokes = [];
    this.changed();
  }

  private changed(): void {
    this.version++;
    for (const listener of this.listeners) listener();
    this.schedule();
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }

  private paint(): void {
    const canvas = this.canvas;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const scale = canvas.width / DRAW_CANVAS_SIZE;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (this.blank) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of this.strokes) {
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = stroke.size * scale;
      if (stroke.kind === "circle") {
        context.beginPath();
        context.arc(stroke.cx * scale, stroke.cy * scale, stroke.r * scale, 0, Math.PI * 2);
        context.stroke();
        continue;
      }
      const [first, ...rest] = stroke.points;
      if (!first) continue;
      if (rest.length === 0) {
        context.beginPath();
        context.arc(first[0] * scale, first[1] * scale, (stroke.size * scale) / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      context.beginPath();
      context.moveTo(first[0] * scale, first[1] * scale);
      for (const [x, y] of rest) context.lineTo(x * scale, y * scale);
      context.stroke();
    }
  }
}
