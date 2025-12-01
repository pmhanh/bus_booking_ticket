import { IsOptional, IsString } from 'class-validator';

export class CreateCityDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  country?: string;
}
