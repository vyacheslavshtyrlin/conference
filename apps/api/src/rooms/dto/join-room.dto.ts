import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class JoinRoomDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  creatorToken?: string;
}
