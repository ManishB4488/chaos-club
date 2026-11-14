import { io, type Socket } from "socket.io-client";
import type { Ack } from "@chaos/shared";

let socket: Socket | null = null;

/** Where the game server lives. On a phone this follows the address of the page, so no setup is needed. */
function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL;
  if (configured) return configured;
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
