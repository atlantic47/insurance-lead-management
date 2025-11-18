import { IsString, IsNumber, IsBoolean, IsEmail, IsOptional } from 'class-validator';

export class CreateEmailCredentialDto {
  @IsString()
  name: string;

  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsBoolean()
  secure: boolean;

  @IsString()
  user: string;

  @IsString()
  pass: string;

  @IsEmail()
  fromEmail: string;

  @IsString()
  @IsOptional()
  fromName?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateEmailCredentialDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsNumber()
  @IsOptional()
  port?: number;

  @IsBoolean()
  @IsOptional()
  secure?: boolean;

  @IsString()
  @IsOptional()
  user?: string;

  @IsString()
  @IsOptional()
  pass?: string;

  @IsEmail()
  @IsOptional()
  fromEmail?: string;

  @IsString()
  @IsOptional()
  fromName?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
