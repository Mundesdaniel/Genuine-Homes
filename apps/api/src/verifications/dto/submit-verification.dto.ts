import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DOCUMENT_UPLOAD, VERIFICATION } from '@genuine-homes/shared';

class VerificationDocumentDto {
  @ApiProperty({ example: 'land_title' })
  @IsString()
  @Length(1, 60)
  kind!: string;

  /** Private-storage key returned by `POST /uploads/documents` — never a URL;
   *  the API mints signed links when it serves the verification back. */
  @ApiProperty({ example: '5e0da180-3d9f-4a5e-b3f7-1f9a2c4d6e8b.pdf' })
  @Matches(DOCUMENT_UPLOAD.KEY_PATTERN, { message: 'Invalid document key' })
  key!: string;
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
