import type { Room } from "../rooms/types";

/**
 * Where live rooms are kept. Today: in memory. Later this can be backed by Redis.
 * (A Redis version will need asynchronous methods, which is a contained refactor.)
 */
export interface RoomStore {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  list(): Room[];
  size(): number;
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  set(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  list(): Room[] {
    return [...this.rooms.values()];
  }

  size(): number {
    return this.rooms.size;
  }
}
