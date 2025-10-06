import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class UploadTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['EMAIL'])
  @IsNotEmpty()
  type: 'EMAIL';

  @IsString()
  @IsOptional()
  subject?: string;
}
