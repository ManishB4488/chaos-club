import { io, type Socket } from "socket.io-client";
import type { Ack } from "@chaos/shared";

let socket: Socket | null = null;

/**
 * Where the game server lives.
 * - Production: the website and the game server are one program, so use the page's own address.
 * - Development: the game server is a separate program on port 4000 of the same machine, so this
 *   also works from a phone without any setup.
 * - NEXT_PUBLIC_SERVER_URL overrides both.
 */
function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return window.location.origin;
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

/** The one shared connection to the game server. Browser only. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(serverUrl(), { autoConnect: false });
  }
  return socket;
}

/** Connects if needed and waits until the connection is ready. */
export function ensureConnected(timeoutMs = 5_000): Promise<Socket> {
  const connection = getSocket();
  if (connection.connected) return Promise.resolve(connection);

  return new Promise<Socket>((resolve, reject) => {
    const timer = setTimeout(() => {
      connection.off("connect", onConnect);
      reject(new Error("timeout"));
    }, timeoutMs);

    function onConnect() {
      clearTimeout(timer);
      resolve(connection);
    }

    connection.once("connect", onConnect);
    connection.connect();
  });
}

/** Sends one request to the server and waits for its reply. Never throws: failures become an error reply. */
export async function request<T extends object = object>(
  event: string,
  payload?: unknown,
): Promise<Ack<T>> {
  try {
    const connection = await ensureConnected();
    return (await connection.timeout(5_000).emitWithAck(event, payload)) as Ack<T>;
  } catch {
    return {
      ok: false,
      error: "SERVER_BUSY",
      message: "Could not reach the game server. Check your connection and try again.",
    };
  }
}
