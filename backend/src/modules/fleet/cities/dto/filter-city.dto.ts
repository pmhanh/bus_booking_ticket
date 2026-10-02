import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min, } from "class-validator";


export class FilterCityDto {
    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;
}