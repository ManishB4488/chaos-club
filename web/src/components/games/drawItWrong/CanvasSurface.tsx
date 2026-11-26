"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import type { DrawingStore } from "@/lib/drawingStore";

type PointerHandler = (event: ReactPointerEvent<HTMLCanvasElement>) => void;

/** A square, white drawing area that keeps itself sharp at any size. Optionally takes finger or mouse input. */
export function CanvasSurface({
  store,
  label,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  store: DrawingStore;
  label: string;
  onPointerDown?: PointerHandler;
  onPointerMove?: PointerHandler;
  onPointerUp?: PointerHandler;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    store.attach(canvas);
    const resize = () => {
      const size = Math.max(1, Math.round(wrapper.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      store.invalidate();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      store.attach(null);
    };
  }, [store]);

  const interactive = Boolean(onPointerDown);
  return (
    <div
      ref={wrapperRef}
      className="relative mx-auto aspect-square w-full max-w-[min(100%,70dvh)] overflow-hidden rounded-card border-2 border-white/15 bg-white"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={cn("absolute inset-0 size-full", interactive && "cursor-crosshair touch-none")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
