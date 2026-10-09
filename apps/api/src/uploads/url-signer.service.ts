import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { DOCUMENTS_PATH, SIGNED_URL_TTL_SECONDS } from './uploads.constants';

/**
 * Mints and verifies HMAC-signed, expiring links to private documents. The
 * signature covers the storage key and the expiry, so neither can be swapped
 * without invalidating the link — possession of a fresh signed URL is the only
 * way to read a private file.
 */
@Injectable()
export class UrlSignerService {
  private readonly secret: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const explicit = config.get('UPLOADS_SIGNING_SECRET', { infer: true });
    // Zero-config default: derive a dedicated key from the access secret. The
    // derivation is one-way, so signed URLs never expose the JWT secret itself.
    this.secret = explicit
      ? Buffer.from(explicit)
      : createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }))
          .update('uploads-url-signing')
          .digest();
  }

  /** A relative `/api/...` link to the document, valid for `ttlSeconds`. */
  signedDocumentPath(key: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${DOCUMENTS_PATH}/${key}?exp=${exp}&sig=${this.sign(key, exp)}`;
  }

  /** True only for an unexpired signature that matches key + exp exactly. */
  verify(key: string, exp: number, sig: string): boolean {
    if (!Number.isSafeInteger(exp) || exp * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(key, exp));
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  private sign(key: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${key}:${exp}`).digest('hex');
  }
}
