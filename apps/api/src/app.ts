import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { json } from 'express';
import type { NextFunction, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErrorFilter } from './common/errors';
import { SETTINGS, type Settings } from './common/config';
import type { AppRequest } from './modules/authorization/actor';

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet(), json({ limit: '32kb' }), cookieParser());
  app.use((req: AppRequest, res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    const started = Date.now();
    if (process.env.NODE_ENV !== 'test')
      res.on('finish', () =>
        console.log(
          JSON.stringify({
            event: 'http.request',
            requestId: req.requestId,
            method: req.method,
            status: res.statusCode,
            durationMs: Date.now() - started,
          }),
        ),
      );
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  const settings = app.get<Settings>(SETTINGS);
  if (settings.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SHOWORA — Sprint 1 API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  app.enableShutdownHooks();
  return app;
}
