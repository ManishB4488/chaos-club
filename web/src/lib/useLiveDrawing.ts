import { useCallback, useEffect, useRef } from "react";
import { SERVER_EVENTS, type DrawDelta, type DrawingSnapshot } from "@chaos/shared";
import type { DrawingStore } from "./drawingStore";
import type { DrawingResult } from "./roomClient";
import { getSocket } from "./socket";

/**
 * Keeps a DrawingStore in step with the server: fetches the drawing when the screen appears, applies the live
 * updates as they arrive, and fetches again after a dropped connection comes back. Returns a function that
 * fetches the drawing again on demand.
 */
export function useLiveDrawing(
  store: DrawingStore,
  load: (round?: number) => Promise<DrawingResult>,
  options: { live: boolean; round?: number; onLoaded?: (snapshot: DrawingSnapshot) => void },
): () => Promise<void> {
  const { live, round } = options;
  const loadRef = useRef(load);
  const loadedRef = useRef(options.onLoaded);
  useEffect(() => {
    loadRef.current = load;
    loadedRef.current = options.onLoaded;
  });

  const refresh = useCallback(async () => {
    const result = await loadRef.current(round);
    if ("drawing" in result) {
      store.replace(result.drawing.strokes);
      loadedRef.current?.(result.drawing);
    }
  }, [store, round]);

  useEffect(() => {
    const socket = getSocket();
    const onDelta = (delta: DrawDelta) => store.apply(delta);
    const onReconnect = () => {
      void refresh();
    };
    if (live) socket.on(SERVER_EVENTS.drawDelta, onDelta);
    socket.on("connect", onReconnect);
    void refresh();
    return () => {
      if (live) socket.off(SERVER_EVENTS.drawDelta, onDelta);
      socket.off("connect", onReconnect);
    };
  }, [store, live, refresh]);

  return refresh;
}
