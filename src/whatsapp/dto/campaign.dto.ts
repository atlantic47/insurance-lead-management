import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsObject,
  IsArray,
  IsDateString,
} from 'class-validator';
import {
  CampaignStatus,
  CampaignTargetType,
  SendingSpeed,
} from '../enums/automation.enums';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsObject()
  templateParams?: Record<string, any>;

  @IsEnum(CampaignTargetType)
  targetType: CampaignTargetType;

  @IsOptional()
  @IsString()
  targetGroupId?: string;

  @IsOptional()
  @IsObject()
  targetFilters?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactsList?: string[]; // Array of phone numbers

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsEnum(SendingSpeed)
  sendingSpeed?: SendingSpeed;

  @IsOptional()
  @IsBoolean()
  respectWorkingHours?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  workingHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  workingHoursEnd?: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  templateParams?: Record<string, any>;

  @IsOptional()
  @IsEnum(CampaignTargetType)
  targetType?: CampaignTargetType;

  @IsOptional()
  @IsString()
  targetGroupId?: string;

  @IsOptional()
  @IsObject()
  targetFilters?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactsList?: string[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsEnum(SendingSpeed)
  sendingSpeed?: SendingSpeed;

  @IsOptional()
  @IsBoolean()
  respectWorkingHours?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  workingHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  workingHoursEnd?: number;
}
