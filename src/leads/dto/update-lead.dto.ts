import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';
import { LeadStatus } from '@prisma/client';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  manualScore?: number;
}