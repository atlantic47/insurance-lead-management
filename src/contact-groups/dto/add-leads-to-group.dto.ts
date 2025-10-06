import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddLeadsToGroupDto {
  @ApiProperty({
    example: ['lead-id-1', 'lead-id-2', 'lead-id-3'],
    description: 'Array of lead IDs to add to the group'
  })
  @IsArray()
  @IsString({ each: true })
  leadIds: string[];
}
