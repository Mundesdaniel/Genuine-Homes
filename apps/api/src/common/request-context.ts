import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Per-request context propagated via AsyncLocalStorage, so deep call sites
 * (audit trail, exception filter) can attach the correlation id without every
 * service having to thread it through explicitly.
 */
export interface RequestContext {
  requestId: string;
  ip?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Express middleware: honour an incoming `X-Request-Id` (from a proxy / load
 * balancer) or mint one, echo it on the response, and run the rest of the
 * request inside the AsyncLocalStorage scope. Must be mounted before the
 * pino-http logger so both share the same id.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId, ip: req.ip }, next);
}
