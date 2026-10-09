import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { DOCUMENT_UPLOAD } from '@genuine-homes/shared';
import { PRIVATE_UPLOADS_DIR } from '../uploads.constants';
import type { UploadFile } from './file-storage.interface';

// Pick a sane extension from the (already-validated) MIME type.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};

/**
 * Storage for sensitive documents (land titles, national IDs). Always local
 * disk, always OUTSIDE the public static mount — files are addressable only by
 * an opaque key, and only the signed-URL route can read them back. Cloudinary
 * is deliberately not an option here: it is configured for public delivery.
 */
@Injectable()
export class PrivateDocumentStorage {
  private readonly logger = new Logger(PrivateDocumentStorage.name);

  constructor() {
    if (!existsSync(PRIVATE_UPLOADS_DIR)) {
      mkdirSync(PRIVATE_UPLOADS_DIR, { recursive: true });
      this.logger.log(`Created private uploads directory at ${PRIVATE_UPLOADS_DIR}`);
    }
  }

  async save(file: UploadFile): Promise<{ key: string }> {
    const key = `${randomUUID()}${EXT_BY_MIME[file.mimeType] ?? '.bin'}`;
    await writeFile(join(PRIVATE_UPLOADS_DIR, key), file.buffer);
    return { key };
  }

  /** Absolute path for a well-formed, existing key; null otherwise. The key
   *  pattern (uuid + extension) rules out path traversal by construction. */
  resolvePath(key: string): string | null {
    if (!DOCUMENT_UPLOAD.KEY_PATTERN.test(key)) return null;
    const path = join(PRIVATE_UPLOADS_DIR, key);
    return existsSync(path) ? path : null;
  }
}
