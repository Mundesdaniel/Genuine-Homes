import {
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  DOCUMENT_UPLOAD,
  IMAGE_UPLOAD,
  type DocumentUploadResponse,
  type UploadResponse,
} from '@genuine-homes/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SELLER_ROLES } from '../common/roles';
import type { FileStorage, UploadFile } from './storage/file-storage.interface';
import { PrivateDocumentStorage } from './storage/private-document-storage';
import { UrlSignerService } from './url-signer.service';
import { FILE_STORAGE } from './uploads.constants';

// Shape of a memory-stored multer file. Declared locally so the module doesn't
// need @types/multer just for one parameter type.
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const ACCEPTED_IMAGE_TYPES = new RegExp(`^(${IMAGE_UPLOAD.ACCEPTED_MIME_TYPES.join('|')})$`);
const ACCEPTED_DOCUMENT_TYPES = new RegExp(
  `^(${DOCUMENT_UPLOAD.ACCEPTED_MIME_TYPES.join('|')})$`,
);

const MULTIPART_FILE_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
  },
} as const;

const toUploadFile = (file: MulterFile): UploadFile => ({
  buffer: file.buffer,
  originalName: file.originalname,
  mimeType: file.mimetype,
});

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly documents: PrivateDocumentStorage,
    private readonly signer: UrlSignerService,
  ) {}

  @Post()
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody(MULTIPART_FILE_BODY)
  @ApiOperation({ summary: 'Upload a property image and get its public URL' })
  // A generous hard cap stops runaway memory use; the validator below gives the
  // clean 422 for files over the real limit.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD.MAX_BYTES * 2 } }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: ACCEPTED_IMAGE_TYPES })
        .addMaxSizeValidator({ maxSize: IMAGE_UPLOAD.MAX_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: MulterFile,
  ): Promise<UploadResponse> {
    return this.storage.save(toUploadFile(file));
  }

  @Post('documents')
  @Roles(...SELLER_ROLES)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody(MULTIPART_FILE_BODY)
  @ApiOperation({
    summary:
      'Upload a verification document (land title, ID) to private storage; ' +
      'returns the key a verification submission references',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: DOCUMENT_UPLOAD.MAX_BYTES * 2 } }),
  )
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: ACCEPTED_DOCUMENT_TYPES })
        .addMaxSizeValidator({ maxSize: DOCUMENT_UPLOAD.MAX_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: MulterFile,
  ): Promise<DocumentUploadResponse> {
    return this.documents.save(toUploadFile(file));
  }

  // Public in the auth sense only: the link itself is the credential. Admins
  // open these in a new tab, where no Authorization header can travel — the
  // HMAC signature (key + expiry) is what gates access instead.
  @Public()
  @Get('documents/:key')
  @ApiOperation({ summary: 'Fetch a private document via a signed, expiring link' })
  serveDocument(
    @Param('key') key: string,
    @Query('exp', ParseIntPipe) exp: number,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): void {
    if (!sig || !this.signer.verify(key, exp, sig)) {
      throw new ForbiddenException('This document link is invalid or has expired');
    }
    const path = this.documents.resolvePath(key);
    if (!path) throw new NotFoundException('Document not found');

    // Never let a shared cache hold a copy — the link expires, the file must too.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${key}"`);
    res.sendFile(path);
  }
}
