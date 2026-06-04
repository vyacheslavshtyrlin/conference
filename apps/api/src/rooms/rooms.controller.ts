import { Body, Controller, Get, Inject, Param, Post, ValidationPipe } from "@nestjs/common";
import type { CreateRoomResponse, GetRoomResponse, JoinRoomResponse } from "@conference/contracts";
import { CreateRoomDto } from "./dto/create-room.dto.js";
import { JoinRoomDto } from "./dto/join-room.dto.js";
import { RoomParamsDto } from "./dto/room-params.dto.js";
import { RoomsService } from "./rooms.service.js";

const dtoValidationPipe = (expectedType: new () => object) =>
  new ValidationPipe({
    expectedType,
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  });

@Controller("rooms")
export class RoomsController {
  constructor(@Inject(RoomsService) private readonly rooms: RoomsService) {}

  @Post()
  createRoom(@Body(dtoValidationPipe(CreateRoomDto)) _body: CreateRoomDto): Promise<CreateRoomResponse> {
    return this.rooms.createRoom();
  }

  @Get(":slug")
  getRoom(@Param(dtoValidationPipe(RoomParamsDto)) params: RoomParamsDto): Promise<GetRoomResponse> {
    return this.rooms.getRoom(params.slug);
  }

  @Post(":slug/join")
  joinRoom(
    @Param(dtoValidationPipe(RoomParamsDto)) params: RoomParamsDto,
    @Body(dtoValidationPipe(JoinRoomDto)) body: JoinRoomDto
  ): Promise<JoinRoomResponse> {
    return this.rooms.joinRoom(params.slug, body.displayName, body.creatorToken);
  }
}
