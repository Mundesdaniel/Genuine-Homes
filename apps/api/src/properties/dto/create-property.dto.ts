import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  OWNER_SETTABLE_STATUSES,
  PropertyType,
  enumValues,
  type PropertyStatus,
  type PropertyType as PropertyTypeValue,
} from '@genuine-homes/shared';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Create a property. Validation mirrors `createPropertySchema` in shared. */
export class CreatePropertyDto {
  @ApiProperty({ enum: enumValues(PropertyType) })
  @IsIn(enumValues(PropertyType))
  type!: PropertyTypeValue;

  @ApiProperty({ example: '4-Bedroom Family House in Nakawa' })
  @Transform(trim)
  @IsString()
  @Length(4, 150)
  title!: string;

  @ApiProperty({ example: 'Spacious family home with a fenced compound...' })
  @Transform(trim)
  @IsString()
  @Length(10, 5000)
  description!: string;

  @ApiProperty({ example: 'Kampala' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  district!: string;

  @ApiProperty({ example: 'Kampala' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  city!: string;

  @ApiPropertyOptional({ example: 'Nakawa' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100)
  area?: string;

  @ApiPropertyOptional({
    example: 'Sarah Namuli (Prime Agents)',
    description: 'Public "listed by" contact name (landlord/agent/owner)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  contactName?: string;

  @ApiPropertyOptional({ example: 250, description: 'Size in square metres' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  sizeSqm?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bathrooms?: number;

  @ApiPropertyOptional({
    example: { water: true, power: true, fence: true },
    description: 'Map of amenity flags',
  })
  @IsOptional()
  @IsObject()
  amenities?: Record<string, boolean>;

  @ApiPropertyOptional({ enum: OWNER_SETTABLE_STATUSES })
  @IsOptional()
  @IsIn([...OWNER_SETTABLE_STATUSES])
  status?: PropertyStatus;

  @ApiPropertyOptional({ example: 0.3325, description: 'Latitude (WGS84)' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 32.6155, description: 'Longitude (WGS84)' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
