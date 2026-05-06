import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateCityDto {
  @IsInt()
  @IsPositive()
  code: number;

  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  divisionType?: string;

  @IsOptional()
  @IsString()
  phoneCode?: string;
}
