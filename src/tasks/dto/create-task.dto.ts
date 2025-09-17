import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskType } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({
    example: 'Follow up with John Doe regarding life insurance inquiry',
    description: 'Task title'
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    example: 'Call to discuss policy options and answer any questions about coverage',
    description: 'Detailed description of the task'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: TaskType,
    example: TaskType.FOLLOW_UP,
    description: 'Type of task'
  })
  @IsEnum(TaskType)
  type: TaskType;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    example: 3,
    description: 'Priority level from 1 (low) to 5 (high)'
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  priority?: number = 1;

  @ApiPropertyOptional({
    example: '2024-12-25T10:00:00Z',
    description: 'Due date and time for the task (ISO datetime string)'
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: 'lead-uuid-here',
    description: 'ID of the related lead (optional)'
  })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiProperty({
    example: 'user-uuid-here',
    description: 'ID of the user to assign this task to'
  })
  @IsString()
  assignedUserId: string;
}