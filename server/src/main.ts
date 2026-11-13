import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma/prisma.service';

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

  // Auto-verify default permanent room on startup
  try {
    const prisma = app.get(PrismaService);
    let admin = await prisma.user.findFirst({
      where: {
        OR: [{ name: 'Admin' }, { email: 'admin@studypartner.com' }],
      },
    });

    if (!admin) {
      const passwordHash = await bcrypt.hash('password123', 10);
      admin = await prisma.user.create({
        data: {
          email: 'admin@studypartner.com',
          name: 'Admin',
          passwordHash,
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
          status: 'online',
          bio: 'Host / Admin',
        },
      });
    }

    const room = await prisma.room.findUnique({
      where: { slug: 'deep-nav' },
    });

    if (!room) {
      await prisma.room.create({
        data: {
          slug: 'deep-nav',
          name: 'Study Partner HQ',
          description: 'Permanent collaborative study and meeting room',
          isPrivate: false,
          maxParticipants: 10,
          ownerId: admin.id,
          members: {
            create: [{ userId: admin.id, role: 'OWNER' }],
          },
        },
      });
      logger.log('Default room "/room/deep-nav" auto-created.');
    }
  } catch (err: any) {
    logger.warn('Default room bootstrap note: ' + err.message);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`===============================================`);
  logger.log(`Study Partner Backend running on: http://localhost:${port}`);
  logger.log(`WebSocket Gateway initialized on port: ${port}`);
  logger.log(`Serving uploads from: ${uploadDir}`);
  logger.log(`===============================================`);
}

bootstrap();
