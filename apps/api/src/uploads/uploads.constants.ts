import { join } from 'path';

/** DI token for the active file-storage strategy (Strategy pattern, mirroring
 *  the payment-gateway setup). Resolved to local disk or Cloudinary at boot. */
export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Public URL path — and the Express static mount point — for images written
 *  by the local storage strategy. Served outside the `/api` global prefix. */
export const UPLOADS_ROUTE = '/uploads';

/** Filesystem directory the local strategy writes images to. Resolved from the
 *  API process working directory (apps/api when started via `pnpm dev:api`).
 *  Git-ignored — see the repo root `.gitignore`. */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** Private documents (land titles, IDs). A SIBLING of UPLOADS_DIR on purpose:
 *  anything under UPLOADS_DIR is served publicly by the static mount, so
 *  private files must never live inside it. Only the signed-URL controller
 *  route reads from here. */
export const PRIVATE_UPLOADS_DIR = join(process.cwd(), 'uploads-private');

/** Where signed document links point. The controller route is `uploads/documents`
 *  under the global `/api` prefix; browsers reach it through the web app's
 *  `/api` proxy (Vite in dev, nginx in prod), so a relative path works in both. */
export const DOCUMENTS_PATH = '/api/uploads/documents';

/** How long a signed document link stays valid. Long enough for an admin to
 *  review a submission, short enough that a leaked link goes stale quickly. */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;
