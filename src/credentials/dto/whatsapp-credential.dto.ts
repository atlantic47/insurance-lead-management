import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateWhatsAppCredentialDto {
  @IsString()
  name: string;

  @IsString()
  phoneNumber: string;

  @IsString()
  phoneNumberId: string;

  @IsString()
  businessAccountId: string;

  @IsString()
  accessToken: string;

  @IsString()
  @IsOptional()
  appSecret?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateWhatsAppCredentialDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  phoneNumberId?: string;

  @IsString()
  @IsOptional()
  businessAccountId?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsString()
  @IsOptional()
  appSecret?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
