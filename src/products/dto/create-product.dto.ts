import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsuranceType } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({
    example: 'Comprehensive Life Insurance',
    description: 'Product name'
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Complete life insurance coverage with flexible terms and competitive rates',
    description: 'Detailed product description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: InsuranceType,
    example: InsuranceType.LIFE,
    description: 'Type of insurance product'
  })
  @IsEnum(InsuranceType)
  type: InsuranceType;

  @ApiPropertyOptional({
    example: 150.00,
    description: 'Base monthly premium price'
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  basePrice?: number;

  @ApiPropertyOptional({
    example: {
      coverage: 'Up to $1M',
      term: '10-30 years',
      riders: ['Accidental Death', 'Disability Waiver']
    },
    description: 'Product features and benefits as JSON object'
  })
  @IsOptional()
  @IsObject()
  features?: any;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the product is active and available for sale'
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}