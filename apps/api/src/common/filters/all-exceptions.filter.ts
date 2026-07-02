import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';
import { requestContext } from '../request-context';

/**
 * Catch-all HTTP exception filter.
 *
 *  - Known `HttpException`s keep their status/body (so validation errors etc.
 *    look exactly like Nest defaults) but gain a `requestId` for support.
 *  - Anything else is logged with its stack and returned as an opaque 500 —
 *    internals (SQL, file paths, provider responses) never leak to clients.
 *
 * Non-HTTP contexts (the chat WebSocket gateway) are rethrown so their own
 * exception handling applies.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = requestContext.getStore()?.requestId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : (body as Record<string, unknown>);
      if (status >= 500) {
        this.logger.error(
          `${req.method} ${req.url} → ${status}: ${exception.message}`,
          exception.stack,
        );
        this.captureToSentry(exception, req, requestId);
      }
      res.status(status).json({ ...payload, requestId });
      return;
    }

    // Unknown error: full details to the log (and Sentry), nothing to the client.
    const message = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(
      `Unhandled exception on ${req.method} ${req.url}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    this.captureToSentry(exception, req, requestId);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      requestId,
    });
  }

  // No-op unless SENTRY_DSN was configured at boot.
  private captureToSentry(
    exception: unknown,
    req: Request,
    requestId: string | undefined,
  ): void {
    Sentry.captureException(exception, {
      tags: { requestId: requestId ?? 'none' },
      extra: { method: req.method, url: req.url },
    });
  }
}
