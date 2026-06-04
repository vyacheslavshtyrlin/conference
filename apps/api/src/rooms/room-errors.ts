import { ConflictException, GoneException, NotFoundException } from "@nestjs/common";

export function roomNotFound() {
  return new NotFoundException({
    code: "ROOM_NOT_FOUND",
    message: "Room not found",
  });
}

export function roomExpired() {
  return new GoneException({
    code: "ROOM_EXPIRED",
    message: "Room expired",
  });
}

export function roomFull() {
  return new ConflictException({
    code: "ROOM_FULL",
    message: "Room is full",
  });
}
