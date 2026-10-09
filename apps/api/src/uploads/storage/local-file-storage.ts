import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { UPLOADS_DIR, UPLOADS_ROUTE } from '../uploads.constants';
import type { FileStorage, StoredFile, UploadFile } from './file-storage.interface';

// Pick a sane extension from the (already-validated) MIME type.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

/**
 * Default storage in development: write the image to a local `uploads/` folder
 * that the API serves statically. No third-party account needed.
 */
@Injectable()
export class LocalFileStorage implements FileStorage {
  readonly name = 'local';
  private readonly logger = new Logger(LocalFileStorage.name);
  // Absolute origin the stored URL points at (the web app loads it directly,
  // not through the /api proxy), e.g. http://localhost:3100.
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    const explicit = config.get('PUBLIC_API_URL', { infer: true });
    const port = config.get('PORT', { infer: true });
    this.baseUrl = (explicit ?? `http://localhost:${port}`).replace(/\/+$/, '');
    if (!existsSync(UPLOADS_DIR)) {
      mkdirSync(UPLOADS_DIR, { recursive: true });
      this.logger.log(`Created uploads directory at ${UPLOADS_DIR}`);
    }
  }

  async save(file: UploadFile): Promise<StoredFile> {
    const filename = `${randomUUID()}${EXT_BY_MIME[file.mimeType] ?? ''}`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);
    return { url: `${this.baseUrl}${UPLOADS_ROUTE}/${filename}` };
  }
}
