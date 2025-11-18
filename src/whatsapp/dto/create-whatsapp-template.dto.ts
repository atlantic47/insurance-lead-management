import { IsString, IsEnum, IsArray, IsOptional, ValidateNested, IsBoolean, MaxLength, MinLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export enum WhatsAppTemplateCategory {
  MARKETING = 'MARKETING',
  UTILITY = 'UTILITY',
  AUTHENTICATION = 'AUTHENTICATION',
}

export enum WhatsAppButtonType {
  QUICK_REPLY = 'QUICK_REPLY',
  PHONE_NUMBER = 'PHONE_NUMBER',
  URL = 'URL',
}

export enum WhatsAppHeaderFormat {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export class WhatsAppTemplateButtonDto {
  @IsEnum(WhatsAppButtonType)
  type: WhatsAppButtonType;

  @IsString()
  @MaxLength(25, { message: 'Button text must not exceed 25 characters' })
  text: string;

  @IsOptional()
  @IsString()
  url?: string; // For URL buttons

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
  phoneNumber?: string; // For PHONE_NUMBER buttons
}

export class WhatsAppTemplateHeaderDto {
  @IsEnum(WhatsAppHeaderFormat)
  format: WhatsAppHeaderFormat;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Header text must not exceed 60 characters' })
  text?: string; // For TEXT format

  @IsOptional()
  @IsString()
  example?: string; // Example media URL for IMAGE/VIDEO/DOCUMENT
}

export class CreateWhatsAppTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/, { message: 'Template name must be lowercase alphanumeric with underscores only' })
  name: string;

  @IsEnum(WhatsAppTemplateCategory)
  category: WhatsAppTemplateCategory;

  @IsString()
  @MinLength(2, { message: 'Language code must be at least 2 characters' })
  @MaxLength(10, { message: 'Language code must not exceed 10 characters' })
  language: string; // e.g., "en", "en_US"

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppTemplateHeaderDto)
  header?: WhatsAppTemplateHeaderDto;

  @IsString()
  @MinLength(1, { message: 'Body text is required' })
  @MaxLength(1024, { message: 'Body text must not exceed 1024 characters' })
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'Footer text must not exceed 60 characters' })
  footer?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppTemplateButtonDto)
  buttons?: WhatsAppTemplateButtonDto[];

  // Examples for variables in the template
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  headerExamples?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bodyExamples?: string[];

  @IsOptional()
  @IsBoolean()
  submitToMeta?: boolean; // If true, submit to Meta immediately
}
