import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactGroupType } from '@prisma/client';

export class CreateContactGroupDto {
  @ApiProperty({ example: 'Auto Insurance Prospects' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Leads interested in auto insurance' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ContactGroupType, example: ContactGroupType.BOTH })
  @IsEnum(ContactGroupType)
  type: ContactGroupType;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    example: ['lead-id-1', 'lead-id-2'],
    description: 'Array of lead IDs to add to this group'
  })
  @IsOptional()
  @IsArray()
  leadIds?: string[];
}
