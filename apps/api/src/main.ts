import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/request-context';
import type { Env } from './config/env.validation';
import { UPLOADS_DIR, UPLOADS_ROUTE } from './uploads/uploads.constants';

async function bootstrap(): Promise<void> {
  // bufferLogs: hold early logs until pino takes over as the app logger.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));
  const config = app.get(ConfigService<Env, true>);

  // Correlation id + AsyncLocalStorage context — must precede the request
  // logger and everything else that reads the id.
  app.use(requestContextMiddleware);

  // Security headers (HSTS, no-sniff, etc.) — financial platform = high standards.
  // crossOriginResourcePolicy is relaxed so the web app (a different dev origin)
  // can load locally-served property images via <img>.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Serve locally-stored property images. Mounted outside the /api prefix, so
  // URLs look like http://localhost:3100/uploads/<file>. Unused in production
  // when Cloudinary is the active storage strategy.
  app.useStaticAssets(UPLOADS_DIR, { prefix: `${UPLOADS_ROUTE}/` });

  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });

  // All routes live under /api.
  app.setGlobalPrefix('api');

  // Reject unknown/invalid input before it reaches business logic.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  // Interactive API docs (disabled in production).
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Genuine Homes API')
      .setDescription('Real estate rental & ownership platform for East Africa.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(
    `Genuine Homes API listening on http://localhost:${port}/api`,
    'Bootstrap',
  );
}

void bootstrap();
