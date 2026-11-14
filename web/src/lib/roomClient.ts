import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type JoinedPayload,
  type RoomView,
} from "@chaos/shared";
import {
  clearSession,
  loadSession,
  saveProfile,
  saveSession,
  type ProfileValues,
} from "./session";
import { getSocket, request } from "./socket";

/**
 * Everything the room page needs to know about its connection, kept in one small store outside React.
 * Components read it with useSyncExternalStore.
 */
export type RoomClientState =
  | { status: "connecting" }
  | { status: "needs-join" }
  | { status: "in-room"; room: RoomView; online: boolean }
  | { status: "kicked" }
  | { status: "error"; message: string };

const INITIAL: RoomClientState = { status: "connecting" };

let state: RoomClientState = INITIAL;
let activeCode: string | null = null;
let listenersAttached = false;
const listeners = new Set<() => void>();

function setState(next: RoomClientState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): RoomClientState => state;
const getServerSnapshot = (): RoomClientState => INITIAL;

/** Tries to take back this tab's seat, using the private code saved when the player joined. */
async function attemptRejoin(): Promise<void> {
  const code = activeCode;
  if (!code) return;

  const session = loadSession(code);
  if (!session) {
    setState({ status: "needs-join" });
    return;
  }

  const ack = await request<JoinedPayload>(CLIENT_EVENTS.rejoinRoom, {
    code,
    sessionToken: session.sessionToken,
  });
  if (activeCode !== code) return;

  if (ack.ok) {
    setState({ status: "in-room", room: ack.room, online: true });
  } else if (ack.error === "INVALID_SESSION") {
    clearSession(code);
    setState({ status: "needs-join" });
  } else {
    if (ack.error === "ROOM_NOT_FOUND") clearSession(code);
    setState({ status: "error", message: ack.message });
  }
}

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  const socket = getSocket();

  socket.on("connect", () => {
    void attemptRejoin();
  });

  socket.on("disconnect", (reason: string) => {
    if (!activeCode || reason === "io client disconnect") return;
    if (reason === "io server disconnect") {
      setState({
        status: "error",
        message: "This room was opened in another window, so this one was disconnected.",
      });
      return;
    }
    if (state.status === "in-room") {
      setState({ status: "in-room", room: state.room, online: false });
    }
  });

  socket.on(SERVER_EVENTS.roomState, (view: RoomView) => {
    if (activeCode && view.code === activeCode && state.status === "in-room") {
      setState({ status: "in-room", room: view, online: true });
    }
  });

  socket.on(SERVER_EVENTS.kicked, () => {
    if (!activeCode) return;
    clearSession(activeCode);
    setState({ status: "kicked" });
  });
}

/** Call when the room page appears. */
function openRoom(code: string): void {
  activeCode = code;
  attachListeners();
  setState({ status: "connecting" });
  const socket = getSocket();
  if (socket.connected) {
    void attemptRejoin();
  } else {
    socket.connect();
  }
}

/** Call when the room page goes away. The seat is kept on the server for a minute in case of a refresh. */
function closeRoom(): void {
  activeCode = null;
  getSocket().disconnect();
  setState(INITIAL);
}

/** Joins the room in the address bar (used by invite links). Returns an error message, or null on success. */
async function joinActiveRoom(profile: ProfileValues): Promise<string | null> {
  const code = activeCode;
  if (!code) return "No room is open.";
  const ack = await request<JoinedPayload>(CLIENT_EVENTS.joinRoom, { ...profile, code });
  if (!ack.ok) return ack.message;
  saveSession(code, { playerId: ack.playerId, sessionToken: ack.sessionToken });
  saveProfile(profile);
  setState({ status: "in-room", room: ack.room, online: true });
  return null;
}

async function leaveActiveRoom(): Promise<void> {
  const code = activeCode;
  await request(CLIENT_EVENTS.leaveRoom);
  if (code) clearSession(code);
}

export const roomClient = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  openRoom,
  closeRoom,
  joinActiveRoom,
  leaveActiveRoom,
};
