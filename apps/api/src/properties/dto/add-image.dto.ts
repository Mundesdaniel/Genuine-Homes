import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUrl, Max, MaxLength, Min } from 'class-validator';

/** Attach an image URL to a property's gallery. Mirrors `addImageSchema`. */
export class AddImageDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/x.jpg' })
  @IsUrl()
  @MaxLength(2048)
  url!: string;

  // Omit to append to the end of the gallery.
  @ApiPropertyOptional({ example: 0, description: 'Display order (0 = first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  position?: number;
}
