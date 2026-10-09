import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { CloudinaryFileStorage } from './storage/cloudinary-file-storage';
import type { FileStorage } from './storage/file-storage.interface';
import { LocalFileStorage } from './storage/local-file-storage';
import { PrivateDocumentStorage } from './storage/private-document-storage';
import { UploadsController } from './uploads.controller';
import { UrlSignerService } from './url-signer.service';
import { FILE_STORAGE } from './uploads.constants';

/**
 * Media uploads. Public property images go through the active storage strategy,
 * chosen at boot: Cloudinary when CLOUDINARY_URL is configured, otherwise local
 * disk (the zero-config default for development). Sensitive documents always
 * live in local private storage, reachable only through signed, expiring URLs
 * minted by UrlSignerService (exported so verifications can sign responses).
 */
@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): FileStorage =>
        config.get('CLOUDINARY_URL', { infer: true })
          ? new CloudinaryFileStorage()
          : new LocalFileStorage(config),
    },
    PrivateDocumentStorage,
    UrlSignerService,
  ],
  exports: [UrlSignerService],
})
export class UploadsModule {}
