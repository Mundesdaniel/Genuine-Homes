import type {
  IdentityVerificationResponse,
  SubmitIdentityVerificationInput,
  VerificationDocument,
} from '@genuine-homes/shared';
import { useAuthStore } from '@/store/authStore';

/**
 * Prototype (demo) mode.
 *
 * When on, the identity-verification flow runs entirely in the browser with no
 * API: document "uploads" are faked and submissions are reviewed by a simulated
 * admin after a short delay. This lets the whole flow be clicked through on a
 * static deploy (e.g. Vercel) where the backend isn't running — purely to show
 * how the website behaves, not for real verification.
 *
 * Toggle with `VITE_PROTOTYPE=true` at build time. Everything here is a no-op
 * when the flag is off, so production builds are unaffected.
 */
export const PROTOTYPE = import.meta.env.VITE_PROTOTYPE === 'true';

/** How long the simulated admin "takes" to review a submission. */
const REVIEW_DELAY_MS = 3000;

const STORAGE_KEY = 'gh-prototype-identity';

/** Stored record = the API response shape plus the simulated review time. */
interface StoredRecord extends IdentityVerificationResponse {
  _verifyAt: number;
}

function maskNin(nin: string): string {
  const upper = nin.trim().toUpperCase();
  const last4 = upper.slice(-4);
  return `${'*'.repeat(Math.max(0, upper.length - 4))}${last4}`;
}

function load(): StoredRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredRecord) : null;
  } catch {
    return null;
  }
}

function save(record: StoredRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/** Mirror the verified flag onto the session user so the rest of the app
 *  (dashboard banner, publish gate) treats this seller as verified too. */
function markUserVerified(at: string): void {
  const { user, setUser } = useAuthStore.getState();
  if (user && !user.identityVerifiedAt) {
    setUser({ ...user, identityVerifiedAt: at });
  }
}

export const prototypeIdentity = {
  /** Current status, auto-advancing from `pending` to `verified` once the
   *  simulated review window has elapsed. */
  me(): IdentityVerificationResponse | null {
    const record = load();
    if (!record) return null;

    if (record.status === 'pending' && Date.now() >= record._verifyAt) {
      const now = new Date().toISOString();
      const verified: StoredRecord = {
        ...record,
        status: 'verified',
        reviewerId: 'prototype-admin',
        updatedAt: now,
      };
      save(verified);
      markUserVerified(now);
    }

    const current = load();
    if (current?.status === 'verified') markUserVerified(current.updatedAt);

    // Strip the internal field before handing the record to the UI.
    if (!current) return null;
    const { _verifyAt, ...response } = current;
    void _verifyAt;
    return response;
  },

  /** Record a submission in `pending`; it flips to `verified` on its own. */
  submit(input: SubmitIdentityVerificationInput): IdentityVerificationResponse {
    const now = new Date().toISOString();
    const record: StoredRecord = {
      id: `proto-${Date.now()}`,
      userId: useAuthStore.getState().user?.id ?? 'prototype-user',
      legalName: input.legalName,
      ninMasked: maskNin(input.nin),
      organizationName: input.organizationName ?? null,
      registrationNumber: input.registrationNumber ?? null,
      tin: input.tin ?? null,
      status: 'pending',
      documents: input.documents as unknown as VerificationDocument[],
      notes: null,
      reviewerId: null,
      createdAt: now,
      updatedAt: now,
      _verifyAt: Date.now() + REVIEW_DELAY_MS,
    };
    save(record);
    const { _verifyAt, ...response } = record;
    void _verifyAt;
    return response;
  },

  /** Clear the demo submission so the flow can be run again. */
  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
