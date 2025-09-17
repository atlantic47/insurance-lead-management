import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';

export class MoveToPipelineStageDto {
  @ApiProperty({
    enum: LeadStatus,
    example: LeadStatus.CONTACTED,
    description: 'New pipeline stage for the lead'
  })
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @ApiPropertyOptional({
    example: 'Successfully contacted lead via phone call',
    description: 'Notes about the stage transition'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PipelineStageResponse {
  stage: LeadStatus;
  leads: any[];
  count: number;
  conversionRate?: number;
  averageTimeInStage?: string;
}