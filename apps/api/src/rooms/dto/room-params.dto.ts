import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RoomParamsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;
}
