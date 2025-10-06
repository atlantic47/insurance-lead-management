import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['WHATSAPP', 'EMAIL'])
  @IsNotEmpty()
  type: 'WHATSAPP' | 'EMAIL';

  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  subject?: string; // For email (if not using template)

  @IsString()
  @IsOptional()
  content?: string; // Custom content (if not using template)

  @IsUUID()
  @IsNotEmpty()
  contactGroupId: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
