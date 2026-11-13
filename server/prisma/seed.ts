import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with default user and permanent room...');

  // 1. Create or find demo user
  const demoEmail = 'demo@deepnav.io';
  let demoUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  });

  if (!demoUser) {
    const passwordHash = await bcrypt.hash('password123', 10);
    demoUser = await prisma.user.create({
      data: {
        email: demoEmail,
        name: 'Admin',
        passwordHash,
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
        status: 'online',
        bio: 'Host / Admin @ deep-nav',
      },
    });
    console.log(`Created demo user: ${demoUser.email} (password: password123)`);
  }

  // 2. Create second user for testing
  const sarahEmail = 'sarah@deepnav.io';
  let sarahUser = await prisma.user.findUnique({
    where: { email: sarahEmail },
  });

  if (!sarahUser) {
    const passwordHash = await bcrypt.hash('password123', 10);
    sarahUser = await prisma.user.create({
      data: {
        email: sarahEmail,
        name: 'Sarah Chen',
        passwordHash,
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah',
        status: 'online',
        bio: 'Design Lead @ deep-nav',
      },
    });
    console.log(`Created second test user: ${sarahUser.email} (password: password123)`);
  }

  // 3. Create the permanent room "deep-nav"
  let permanentRoom = await prisma.room.findUnique({
    where: { slug: 'deep-nav' },
  });

  if (!permanentRoom) {
    permanentRoom = await prisma.room.create({
      data: {
        slug: 'deep-nav',
        name: 'deep-nav HQ',
        description: 'Permanent executive conference room with persistent chat and remote control',
        isPrivate: false,
        maxParticipants: 10,
        ownerId: demoUser.id,
        members: {
          create: [
            { userId: demoUser.id, role: 'OWNER' },
            { userId: sarahUser.id, role: 'ADMIN' },
          ],
        },
        activities: {
          create: {
            userId: demoUser.id,
            type: 'ROOM_CREATED',
            details: 'Permanent room created',
          },
        },
      },
    });
    console.log(`Created permanent room: /room/${permanentRoom.slug}`);

    // Seed initial messages to prove persistence
    const welcomeMsg = await prisma.message.create({
      data: {
        roomId: permanentRoom.id,
        senderId: demoUser.id,
        content: 'Welcome to deep-nav! This room is permanent—feel free to leave, return anytime, share your screen, or collaborate with remote desktop control.',
        isPinned: true,
      },
    });

    await prisma.message.create({
      data: {
        roomId: permanentRoom.id,
        senderId: sarahUser.id,
        content: 'Excited to test out screen sharing and persistent chat across sessions!',
        replyToId: welcomeMsg.id,
      },
    });

    // Add reaction
    await prisma.reaction.create({
      data: {
        messageId: welcomeMsg.id,
        userId: sarahUser.id,
        emoji: '🚀',
      },
    });

    console.log('Seeded persistent chat history.');
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
