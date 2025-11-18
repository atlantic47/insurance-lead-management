import { IsString, IsOptional, IsBoolean, IsHexColor, MinLength, MaxLength } from 'class-validator';

export class CreateConversationLabelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsHexColor()
  color: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isSystemLabel?: boolean;
}

export class UpdateConversationLabelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class AssignLabelDto {
  @IsString()
  conversationId: string;

  @IsString()
  labelId: string;
}
