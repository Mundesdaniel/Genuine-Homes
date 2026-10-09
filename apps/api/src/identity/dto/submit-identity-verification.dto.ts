import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DOCUMENT_UPLOAD, IDENTITY } from '@genuine-homes/shared';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

class IdentityDocumentDto {
  @ApiProperty({ example: 'national_id_front' })
  @IsString()
  @Length(1, 60)
  kind!: string;

  /** Private-storage key returned by `POST /uploads/documents`. */
  @ApiProperty({ example: '5e0da180-3d9f-4a5e-b3f7-1f9a2c4d6e8b.jpg' })
  @Matches(DOCUMENT_UPLOAD.KEY_PATTERN, { message: 'Invalid document key' })
  key!: string;
}

/** Submit National ID (KYC) details. Mirrors `submitIdentityVerificationSchema`. */
export class SubmitIdentityVerificationDto {
  @ApiProperty({ example: 'Sarah Nakato' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  legalName!: string;

  /** Never stored raw — masked + HMAC-hashed immediately in the service. */
  @ApiProperty({ example: 'CM90012100ABCD', description: 'Ugandan NIN (14 chars)' })
  @Transform(upper)
  @Matches(IDENTITY.NIN_PATTERN, { message: 'Invalid NIN' })
  nin!: string;

  @ApiProperty({ type: [IdentityDocumentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IDENTITY.MAX_DOCUMENTS)
  @ValidateNested({ each: true })
  @Type(() => IdentityDocumentDto)
  documents!: IdentityDocumentDto[];

  // KYB fields — the service requires these for developer (company) accounts.
  @ApiPropertyOptional({ example: 'Pearl Estates Ltd' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  organizationName?: string;

  @ApiPropertyOptional({ example: '80020001234567', description: 'URSB registration no.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: '1000123456' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 30)
  tin?: string;
}
