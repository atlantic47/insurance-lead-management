import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class CreateCampaignTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['WHATSAPP', 'EMAIL'])
  @IsNotEmpty()
  type: 'WHATSAPP' | 'EMAIL';

  // Email template fields
  @IsString()
  @IsOptional()
  subject?: string; // For email only

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  htmlContent?: string; // HTML email content with inline CSS

  @IsBoolean()
  @IsOptional()
  isHtml?: boolean; // Whether to use HTML content

  @IsObject()
  @IsOptional()
  variables?: any; // Available variables for email template

  // WhatsApp Business API template fields
  @IsString()
  @IsOptional()
  whatsappTemplateName?: string; // Meta-approved template name

  @IsString()
  @IsOptional()
  whatsappLanguageCode?: string; // Language code (e.g., "en", "es")

  @IsObject()
  @IsOptional()
  whatsappComponents?: any; // Template structure

  @IsObject()
  @IsOptional()
  whatsappParameters?: any; // Mapping for numbered placeholders
}
