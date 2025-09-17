import { IsString, IsEnum, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommunicationChannel } from '@prisma/client';

export class CreateCommunicationDto {
  @ApiProperty({
    example: 'lead-uuid-here',
    description: 'ID of the lead this communication belongs to'
  })
  @IsString()
  leadId: string;

  @ApiProperty({
    enum: CommunicationChannel,
    example: CommunicationChannel.EMAIL,
    description: 'Communication channel used'
  })
  @IsEnum(CommunicationChannel)
  channel: CommunicationChannel;

  @ApiProperty({
    example: 'OUTBOUND',
    description: 'Direction of communication (INBOUND or OUTBOUND)'
  })
  @IsString()
  direction: string; // INBOUND or OUTBOUND

  @ApiPropertyOptional({
    example: 'Insurance Quote Follow-up',
    description: 'Subject line for email communications'
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    example: 'Thank you for your interest in our life insurance products. I would like to schedule a call to discuss your needs.',
    description: 'Content of the communication'
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    example: { duration: '15 minutes', outcome: 'positive' },
    description: 'Additional metadata specific to the communication channel'
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the communication has been read'
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean = false;
}