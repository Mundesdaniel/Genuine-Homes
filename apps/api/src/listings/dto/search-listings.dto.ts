import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  ListingType,
  MAX_PAGE_SIZE,
  PropertyType,
  enumValues,
  type ListingType as ListingTypeValue,
  type PropertyType as PropertyTypeValue,
} from '@genuine-homes/shared';

const SORTS = ['newest', 'price_asc', 'price_desc', 'distance'] as const;
type Sort = (typeof SORTS)[number];

// Query params arrive as strings; coerce '1'/'true' to a real boolean.
const toBool = ({ value }: { value: unknown }): unknown =>
  value === true || value === 'true' || value === '1';

/** Query params for `GET /listings`. Mirrors `searchListingsSchema` in shared. */
export class SearchListingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ enum: enumValues(PropertyType) })
  @IsOptional()
  @IsIn(enumValues(PropertyType))
  type?: PropertyTypeValue;

  @ApiPropertyOptional({ enum: enumValues(ListingType) })
  @IsOptional()
  @IsIn(enumValues(ListingType))
  listingType?: ListingTypeValue;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms?: number;

  @ApiPropertyOptional({ description: 'Only verified properties' })
  @IsOptional()
  @Transform(toBool)
  onlyVerified?: boolean;

  // "Near me": lat + lng required together; radiusM defaults server-side.
  @ApiPropertyOptional({ description: 'Latitude (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude (WGS84)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Search radius in metres', maximum: 200_000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(200_000)
  radiusM?: number;

  @ApiPropertyOptional({ enum: SORTS })
  @IsOptional()
  @IsIn(SORTS)
  sort?: Sort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
