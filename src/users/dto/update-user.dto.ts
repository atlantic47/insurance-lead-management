import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}