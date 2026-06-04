import { Module } from "@nestjs/common";
import { RedisRoomRepository, RoomRepository } from "./room.repository.js";
import { RoomTokenService } from "./room-token.service.js";
import { RoomsController } from "./rooms.controller.js";
import { RoomsService } from "./rooms.service.js";

@Module({
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomTokenService,
    {
      provide: RoomRepository,
      useClass: RedisRoomRepository,
    },
  ],
})
export class RoomsModule {}
