import { Transform, Type } from 'class-transformer';
import { IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value?.trim())
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}