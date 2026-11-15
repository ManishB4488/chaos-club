import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import type { Ack, JoinedPayload } from "@chaos/shared";
import { createGameServer, type GameServerOptions } from "../src/app";

type JoinedAck = Ack<JoinedPayload>;

export const profile = (nickname: string, color = "grape") => ({ nickname, avatar: "cat", color });

const cleanups: Array<() => Promise<void> | void> = [];

export async function runCleanups(): Promise<void> {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
}

export async function startServer(options: Partial<GameServerOptions> = {}) {
  const server = createGameServer({
    webOrigins: ["http://localhost:3000"],
    sweepIntervalMs: 60_000,
    ...options,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, "127.0.0.1", resolve));
  const port = (server.httpServer.address() as AddressInfo).port;
  cleanups.push(() => server.close());
  return { url: `http://127.0.0.1:${port}` };
}

export async function connectClient(url: string): Promise<Socket> {
  const client = connect(url, { transports: ["websocket"], forceNew: true, reconnection: false });
  cleanups.push(() => {
    client.disconnect();
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}

export async function send<T>(client: Socket, event: string, payload?: unknown): Promise<T> {
  return (await client.timeout(2_000).emitWithAck(event, payload)) as T;
}

/** Waits for the next matching server event. Call it BEFORE the action that causes the event. */
export function waitFor<T>(
  client: Socket,
  event: string,
  predicate: (value: T) => boolean = () => true,
  timeoutMs = 2_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handler = (value: T) => {
      if (predicate(value)) {
        clearTimeout(timer);
        client.off(event, handler);
        resolve(value);
      }
    };
    const timer = setTimeout(() => {
      client.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    client.on(event, handler);
  });
}

export function mustJoin(ack: JoinedAck): JoinedPayload {
  if (!ack.ok) throw new Error(`Expected success but got ${ack.error}`);
  return ack;
}
