import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { VERIFICATION } from '@genuine-homes/shared';

class VerificationDocumentDto {
  @ApiProperty({ example: 'land_title' })
  @IsString()
  @Length(1, 60)
  kind!: string;

  @ApiProperty({ example: 'https://storage.example/doc.pdf' })
  @IsUrl()
  url!: string;
}

/** Submit documents for property verification. Mirrors `submitVerificationSchema`. */
export class SubmitVerificationDto {
  @ApiProperty()
  @IsUUID()
  propertyId!: string;

  @ApiProperty({ type: [VerificationDocumentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(VERIFICATION.MAX_DOCUMENTS)
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents!: VerificationDocumentDto[];
}
