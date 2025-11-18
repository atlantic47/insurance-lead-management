import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AutomationTriggerType,
  SendingFrequency,
} from '../enums/automation.enums';

export class CreateAutomationRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsEnum(AutomationTriggerType)
  triggerType: AutomationTriggerType;

  @IsOptional()
  @IsObject()
  triggerConditions?: Record<string, any>;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsObject()
  templateParams?: Record<string, any>;

  @IsEnum(SendingFrequency)
  sendingFrequency: SendingFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSendCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sendAfterMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  activeDays?: number[]; // 0 = Sunday, 6 = Saturday

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHoursEnd?: number;
}

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(AutomationTriggerType)
  triggerType?: AutomationTriggerType;

  @IsOptional()
  @IsObject()
  triggerConditions?: Record<string, any>;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  templateParams?: Record<string, any>;

  @IsOptional()
  @IsEnum(SendingFrequency)
  sendingFrequency?: SendingFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSendCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sendAfterMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  activeDays?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHoursEnd?: number;
}
