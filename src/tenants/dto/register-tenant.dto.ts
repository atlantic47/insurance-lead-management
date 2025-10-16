import { IsString, IsEmail, IsNotEmpty, MinLength, Matches, IsOptional } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Subdomain must contain only lowercase letters, numbers, and hyphens' })
  subdomain: string;

  @IsString()
  @IsNotEmpty()
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  adminLastName: string;

  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword: string;

  @IsString()
  @IsOptional()
  adminPhone?: string;

  @IsString()
  @IsOptional()
  plan?: string; // free, basic, pro, enterprise
}
