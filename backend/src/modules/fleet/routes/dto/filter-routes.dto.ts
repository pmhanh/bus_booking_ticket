import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class FilterRoutesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  originCityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  destinationCityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
