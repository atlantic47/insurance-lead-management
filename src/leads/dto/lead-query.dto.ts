import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LeadStatus, LeadSource, InsuranceType } from '@prisma/client';

export class LeadQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsEnum(InsuranceType)
  insuranceType?: InsuranceType;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  urgency?: string; // 'high', 'medium', 'low'

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  startDate?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  endDate?: Date;
}