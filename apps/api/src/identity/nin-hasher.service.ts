import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDENTITY } from '@genuine-homes/shared';
import type { Env } from '../config/env.validation';

/**
 * Masks and hashes National IDs so the raw number never touches the database.
 * The hash is a keyed HMAC (not a plain digest): NINs have low entropy, so an
 * unkeyed hash would be trivially reversible by enumeration. The key follows
 * the same pattern as the uploads URL signer — explicit env secret, or a
 * one-way derivation from the JWT access secret when unset.
 */
@Injectable()
export class NinHasherService {
  private readonly secret: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const explicit = config.get('IDENTITY_HASH_SECRET', { infer: true });
    this.secret = explicit
      ? Buffer.from(explicit)
      : createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }))
          .update('identity-nin-hash')
          .digest();
  }

  /** Uppercased, trimmed canonical form the mask/hash both derive from. */
  normalize(nin: string): string {
    return nin.trim().toUpperCase();
  }

  /** `**********1234` — display-safe, stored instead of the number. */
  mask(nin: string): string {
    const normalized = this.normalize(nin);
    return (
      '*'.repeat(IDENTITY.NIN_LENGTH - 4) + normalized.slice(-4)
    );
  }

  hash(nin: string): string {
    return createHmac('sha256', this.secret)
      .update(this.normalize(nin))
      .digest('hex');
  }
}
