import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDecimal,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, InsuranceType, CommunicationChannel } from '@prisma/client';

export class CreateLeadDto {
  @ApiProperty({ 
    enum: LeadSource,
    example: LeadSource.WEBSITE,
    description: 'Source of the lead'
  })
  @IsEnum(LeadSource)
  source: LeadSource;

  @ApiProperty({ 
    enum: InsuranceType,
    example: InsuranceType.LIFE,
    description: 'Type of insurance the lead is interested in'
  })
  @IsEnum(InsuranceType)
  insuranceType: InsuranceType;

  @ApiPropertyOptional({ 
    minimum: 1,
    maximum: 5,
    example: 3,
    description: 'Urgency level from 1 (low) to 5 (high)'
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  urgency?: number = 1;

  @ApiProperty({ 
    example: 'John',
    description: 'Lead first name'
  })
  @IsString()
  firstName: string;

  @ApiProperty({ 
    example: 'Doe',
    description: 'Lead last name'
  })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ 
    example: 'john.doe@example.com',
    description: 'Lead email address'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ 
    example: '+1234567890',
    description: 'Primary phone number'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    example: '+1234567891',
    description: 'Alternate phone number'
  })
  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @ApiPropertyOptional({ 
    enum: CommunicationChannel,
    example: CommunicationChannel.EMAIL,
    description: 'Preferred communication channel'
  })
  @IsOptional()
  @IsEnum(CommunicationChannel)
  preferredContact?: CommunicationChannel;

  @ApiPropertyOptional({ 
    example: '123 Main St',
    description: 'Street address'
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ 
    example: 'Austin',
    description: 'City'
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ 
    example: 'TX',
    description: 'State or province'
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ 
    example: '78701',
    description: 'ZIP or postal code'
  })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({ 
    example: 'US',
    description: 'Country code'
  })
  @IsOptional()
  @IsString()
  country?: string = 'US';

  @ApiPropertyOptional({ 
    example: 'Looking for comprehensive life insurance coverage for a family of 4',
    description: 'Details about the inquiry'
  })
  @IsOptional()
  @IsString()
  inquiryDetails?: string;

  @ApiPropertyOptional({ 
    example: 250.00,
    description: 'Monthly budget for insurance'
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  budget?: number;

  @ApiPropertyOptional({ 
    example: '2024-12-31',
    description: 'Expected close date (ISO date string)'
  })
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional({ 
    example: 'user-uuid-here',
    description: 'ID of the user to assign this lead to'
  })
  @IsOptional()
  @IsString()
  assignedUserId?: string;
}