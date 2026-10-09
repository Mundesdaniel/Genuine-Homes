import { ConfigService } from '@nestjs/config';
import { UrlSignerService } from './url-signer.service';
import { DOCUMENTS_PATH } from './uploads.constants';

const configWith = (env: Record<string, string | undefined>): ConfigService =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

const KEY = '5e0da180-3d9f-4a5e-b3f7-1f9a2c4d6e8b.pdf';

describe('UrlSignerService', () => {
  let signer: UrlSignerService;

  beforeEach(() => {
    signer = new UrlSignerService(configWith({ JWT_ACCESS_SECRET: 'x'.repeat(32) }) as never);
  });

  const parse = (path: string): { key: string; exp: number; sig: string } => {
    const url = new URL(path, 'http://localhost');
    return {
      key: url.pathname.slice(`${DOCUMENTS_PATH}/`.length),
      exp: Number(url.searchParams.get('exp')),
      sig: url.searchParams.get('sig') ?? '',
    };
  };

  it('signs a key into a link that verifies (round trip)', () => {
    const { key, exp, sig } = parse(signer.signedDocumentPath(KEY));
    expect(key).toBe(KEY);
    expect(signer.verify(key, exp, sig)).toBe(true);
  });

  it('rejects an expired link', () => {
    const { key, exp, sig } = parse(signer.signedDocumentPath(KEY, -10));
    expect(exp * 1000).toBeLessThan(Date.now());
    expect(signer.verify(key, exp, sig)).toBe(false);
  });

  it('rejects a tampered key (signature bound to the key)', () => {
    const { exp, sig } = parse(signer.signedDocumentPath(KEY));
    expect(signer.verify('other-key.pdf', exp, sig)).toBe(false);
  });

  it('rejects a stretched expiry (signature bound to exp)', () => {
    const { key, exp, sig } = parse(signer.signedDocumentPath(KEY));
    expect(signer.verify(key, exp + 3600, sig)).toBe(false);
  });

  it('rejects garbage signatures without throwing', () => {
    const { key, exp } = parse(signer.signedDocumentPath(KEY));
    expect(signer.verify(key, exp, 'not-hex')).toBe(false);
    expect(signer.verify(key, Number.NaN, 'abc')).toBe(false);
  });

  it('prefers an explicit UPLOADS_SIGNING_SECRET over the derived key', () => {
    const explicit = new UrlSignerService(
      configWith({
        JWT_ACCESS_SECRET: 'x'.repeat(32),
        UPLOADS_SIGNING_SECRET: 'y'.repeat(32),
      }) as never,
    );
    const { key, exp, sig } = parse(signer.signedDocumentPath(KEY));
    // A link signed with the derived key must not verify under the explicit one.
    expect(explicit.verify(key, exp, sig)).toBe(false);
  });
});
