import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: (origin, callback) => {
      // Allow local development ports and web requests
      callback(null, true);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Static uploads directory serving
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  app.use('/uploads', express.static(uploadDir));

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`===============================================`);
  logger.log(`Study Partner Backend running on: http://localhost:${port}`);
  logger.log(`WebSocket Gateway initialized on port: ${port}`);
  logger.log(`Serving uploads from: ${uploadDir}`);
  logger.log(`===============================================`);
}

bootstrap();
