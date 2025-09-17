import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.AGENT;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}