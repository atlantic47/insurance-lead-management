import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CommunicationChannel } from '@prisma/client';

export class CommunicationQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsEnum(CommunicationChannel)
  channel?: CommunicationChannel;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  startDate?: Date;

  @IsOptional()
  @Transform(({ value }) => new Date(value))
  endDate?: Date;
}