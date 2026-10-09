import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { FileStorage, StoredFile, UploadFile } from './file-storage.interface';

/**
 * Production storage: stream the image to Cloudinary (CDN + transforms). The
 * SDK reads its credentials from the `CLOUDINARY_URL` env var on its own.
 *
 * The package is imported lazily so it's only a dependency when Cloudinary is
 * actually configured — the local-disk path needs nothing extra installed.
 */
@Injectable()
export class CloudinaryFileStorage implements FileStorage {
  readonly name = 'cloudinary';
  private readonly logger = new Logger(CloudinaryFileStorage.name);

  async save(file: UploadFile): Promise<StoredFile> {
    let cloudinary: typeof import('cloudinary');
    try {
      cloudinary = await import('cloudinary');
    } catch {
      throw new InternalServerErrorException(
        'CLOUDINARY_URL is set but the "cloudinary" package is not installed. ' +
          'Run `pnpm --filter @genuine-homes/api add cloudinary`.',
      );
    }

    return new Promise<StoredFile>((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        { folder: 'genuine-homes/properties', resource_type: 'image' },
        (error, result) => {
          if (error || !result?.secure_url) {
            this.logger.error('Cloudinary upload failed', error as Error);
            return reject(
              new InternalServerErrorException('Image upload to Cloudinary failed'),
            );
          }
          resolve({ url: result.secure_url });
        },
      );
      stream.end(file.buffer);
    });
  }
}
