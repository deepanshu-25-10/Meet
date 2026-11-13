import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInviteDto,
  CreateRoomDto,
  JoinRoomDto,
  UpdateMemberRoleDto,
  UpdateRoomDto,
  VerifyPasscodeDto,
} from './dto/rooms.dto';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  // Helper to generate a URL slug
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async createRoom(ownerId: string, dto: CreateRoomDto) {
    let slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    if (!slug) {
      slug = `room-${crypto.randomBytes(3).toString('hex')}`;
    }

    // Check if slug exists; if so and not explicitly supplied, append random suffix
    const existing = await this.prisma.room.findUnique({
      where: { slug },
    });

    if (existing) {
      if (dto.slug) {
        throw new ConflictException(
          `Room slug "${slug}" is already taken. Please choose another.`,
        );
      }
      slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const room = await this.prisma.room.create({
      data: {
        slug,
        name: dto.name,
        description: dto.description,
        isPrivate: dto.isPrivate || false,
        passcode: dto.passcode || null,
        maxParticipants: dto.maxParticipants ? Math.min(dto.maxParticipants, 10) : 10,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
        activities: {
          create: {
            userId: ownerId,
            type: 'ROOM_CREATED',
            details: `Permanent room "${dto.name}" created`,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    });

    return room;
  }

  async getRoomsForUser(userId: string) {
    // Return rooms where user is owner or member, plus public rooms
    const rooms = await this.prisma.room.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, isBanned: false } } },
          { isPrivate: false },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            status: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rooms;
  }

  async getRoomBySlug(slug: string, userId?: string) {
    const room = await this.prisma.room.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            status: true,
          },
        },
        members: {
          where: { isBanned: false },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
        activities: {
          take: 15,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
            members: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room "${slug}" not found`);
    }

    // Check if user is banned
    if (userId) {
      const bannedMember = await this.prisma.roomMember.findFirst({
        where: { roomId: room.id, userId, isBanned: true },
      });
      if (bannedMember) {
        throw new ForbiddenException('You have been banned from this room');
      }
    }

    const isMember = userId
      ? room.members.some((m) => m.userId === userId)
      : false;
    const isOwner = userId ? room.ownerId === userId : false;

    // Mask passcode
    return {
      ...room,
      hasPasscode: !!room.passcode,
      passcode: undefined, // never expose raw passcode
      isMember,
      isOwner,
    };
  }

  async joinRoom(slug: string, userId: string, dto: JoinRoomDto) {
    const room = await this.prisma.room.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new NotFoundException(`Room "${slug}" not found`);
    }

    // Check ban
    const member = room.members.find((m) => m.userId === userId);
    if (member && member.isBanned) {
      throw new ForbiddenException('You are banned from this room');
    }

    // Check passcode if room is private or has passcode and user is not member
    if (room.passcode && (!member || member.role === 'GUEST')) {
      if (room.ownerId !== userId && (!dto.passcode || dto.passcode !== room.passcode)) {
        throw new ForbiddenException('Invalid room passcode');
      }
    }

    // Check max participants limit (10)
    if (room.members.length >= room.maxParticipants && !member) {
      throw new BadRequestException(
        `Room has reached maximum limit of ${room.maxParticipants} participants`,
      );
    }

    // If not already a member, add as member
    if (!member) {
      await this.prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          role: 'MEMBER',
        },
      });

      await this.prisma.activityLog.create({
        data: {
          roomId: room.id,
          userId,
          type: 'USER_JOINED',
          details: 'Joined the permanent room',
        },
      });
    }

    return this.getRoomBySlug(room.slug, userId);
  }

  async updateRoom(roomId: string, userId: string, dto: UpdateRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Check permission: Owner or Admin
    const member = room.members.find((m) => m.userId === userId);
    const isOwner = room.ownerId === userId;
    const isAdmin = member?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only room owner or admin can update room settings');
    }

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isPrivate !== undefined ? { isPrivate: dto.isPrivate } : {}),
        ...(dto.passcode !== undefined ? { passcode: dto.passcode || null } : {}),
        ...(dto.maxParticipants ? { maxParticipants: Math.min(dto.maxParticipants, 10) } : {}),
      },
    });

    return updated;
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only the room owner can delete this room');
    }

    await this.prisma.room.delete({
      where: { id: roomId },
    });

    return { message: 'Room deleted successfully' };
  }

  async createInvite(roomId: string, userId: string, dto: CreateInviteDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isOwner = room.ownerId === userId;
    const isAdmin = room.members.some((m) => m.userId === userId && m.role === 'ADMIN');

    if (!isOwner && !isAdmin && room.isPrivate) {
      throw new ForbiddenException('You do not have permission to invite users to this private room');
    }

    const code = crypto.randomBytes(6).toString('hex');
    const expiresAt = dto.expiresInHours
      ? new Date(Date.now() + dto.expiresInHours * 3600 * 1000)
      : null;

    const invite = await this.prisma.roomInvite.create({
      data: {
        roomId,
        code,
        createdBy: userId,
        maxUses: dto.maxUses || null,
        expiresAt,
      },
    });

    return invite;
  }

  async joinByInvite(code: string, userId: string) {
    const invite = await this.prisma.roomInvite.findUnique({
      where: { code },
      include: { room: { include: { members: true } } },
    });

    if (!invite) {
      throw new NotFoundException('Invite code not found or expired');
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite has expired');
    }

    if (invite.maxUses && invite.usesCount >= invite.maxUses) {
      throw new BadRequestException('This invite has reached its maximum usage limit');
    }

    const room = invite.room;

    // Check if user is banned
    const existing = room.members.find((m) => m.userId === userId);
    if (existing && existing.isBanned) {
      throw new ForbiddenException('You have been banned from this room');
    }

    if (!existing) {
      if (room.members.length >= room.maxParticipants) {
        throw new BadRequestException('Room has reached its maximum participant limit (10)');
      }

      await this.prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          role: 'MEMBER',
        },
      });

      // Increment invite use count
      await this.prisma.roomInvite.update({
        where: { id: invite.id },
        data: { usesCount: { increment: 1 } },
      });

      await this.prisma.activityLog.create({
        data: {
          roomId: room.id,
          userId,
          type: 'USER_JOINED_INVITE',
          details: 'Joined via invite link',
        },
      });
    }

    return this.getRoomBySlug(room.slug, userId);
  }

  async updateMemberRole(roomId: string, currentUserId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.ownerId !== currentUserId) {
      throw new ForbiddenException('Only the room owner can change participant roles');
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException('Cannot change the role of the room owner');
    }

    const member = await this.prisma.roomMember.update({
      where: {
        roomId_userId: {
          roomId,
          userId: targetUserId,
        },
      },
      data: {
        role: dto.role,
      },
    });

    return member;
  }

  async revokeMemberAccess(roomId: string, currentUserId: string, targetUserId: string, ban = false) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { members: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isOwner = room.ownerId === currentUserId;
    const currentMember = room.members.find((m) => m.userId === currentUserId);
    const isAdmin = currentMember?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only room owner or admin can revoke room access');
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException('Cannot revoke access for the room owner');
    }

    if (ban) {
      await this.prisma.roomMember.update({
        where: {
          roomId_userId: {
            roomId,
            userId: targetUserId,
          },
        },
        data: {
          isBanned: true,
        },
      });
    } else {
      await this.prisma.roomMember.delete({
        where: {
          roomId_userId: {
            roomId,
            userId: targetUserId,
          },
        },
      });
    }

    return { message: ban ? 'User has been banned from this room' : 'User access revoked' };
  }

  async getLobbyInfo(slug: string, userId?: string) {
    const room = await this.prisma.room.findUnique({
      where: { slug },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with slug "${slug}" not found`);
    }

    const isHost = userId ? room.ownerId === userId : false;
    const activeParticipants = this.eventsGateway.getRoomActiveParticipants(room.id);

    return {
      id: room.id,
      slug: room.slug,
      name: room.name,
      description: room.description,
      hasPasscode: !!room.passcode,
      isHost,
      passcode: isHost ? room.passcode : undefined,
      activeParticipants,
      activeCount: activeParticipants.length,
    };
  }

  async verifyPasscode(slug: string, userId: string, dto: VerifyPasscodeDto) {
    const room = await this.prisma.room.findUnique({
      where: { slug },
      include: { owner: true },
    });

    if (!room) {
      throw new NotFoundException(`Room "${slug}" not found`);
    }

    const isHost = room.ownerId === userId;
    if (isHost) {
      return { valid: true, isHost: true, message: 'Host verified' };
    }

    if (!room.passcode) {
      return { valid: true, message: 'Room has no passcode requirement' };
    }

    const cleanInput = (dto.passcode || '').trim();
    const cleanRoomPass = (room.passcode || '').trim();
    const isMatch = cleanInput === cleanRoomPass;

    if (isMatch) {
      return { valid: true, message: 'Passcode verified successfully' };
    }

    const attemptCount = dto.attemptCount || 1;

    // Helper: Save silent camera snapshot if provided
    let photoUrl: string | null = null;
    if (dto.photoBase64 && dto.photoBase64.startsWith('data:image/')) {
      try {
        const matches = dto.photoBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filename = `security-snapshot-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, buffer);
          photoUrl = `/uploads/${filename}`;
        }
      } catch (err) {
        console.warn('Failed to save security snapshot photo:', err);
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    const userName = user?.name || 'Participant';

    // Requirement: After 1 wrong password, send image of person trying to enter in chat (do NOT notify him/her)
    if (attemptCount === 1) {
      const noticeContent = photoUrl
        ? `📷 **Security Notice**: User "${userName}" entered an incorrect meeting passcode.\n\n![Security Snapshot](${photoUrl})`
        : `📷 **Security Notice**: User "${userName}" entered an incorrect meeting passcode.`;

      const noticeMsg = await this.prisma.message.create({
        data: {
          roomId: room.id,
          senderId: room.ownerId,
          content: noticeContent,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      this.eventsGateway.broadcastChatMessage(room.id, noticeMsg);

      // Do NOT notify the participant about the photo or notice sent to host
      return {
        valid: false,
        isCritical: false,
        canRetry: true,
        message: 'Incorrect meeting passcode. Please try again.',
      };
    }

    // Requirement: After 3 failed attempts, send critical alert message to host, but allow user to retry
    if (attemptCount >= 3) {
      const alertContent = photoUrl
        ? `🚨 CRITICAL SECURITY ALERT: User "${userName}" failed meeting passcode 3 times in a row!\n\n![Security Snapshot](${photoUrl})`
        : `🚨 CRITICAL SECURITY ALERT: User "${userName}" failed meeting passcode 3 times in a row!`;

      // Persist in room messages table so host sees in permanent chat history
      const criticalMsg = await this.prisma.message.create({
        data: {
          roomId: room.id,
          senderId: room.ownerId,
          content: alertContent,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Broadcast immediately via socket to in-meeting chat and critical alert handler
      this.eventsGateway.broadcastChatMessage(room.id, criticalMsg);
      this.eventsGateway.broadcastCriticalAlert(room.id, {
        userName,
        attemptCount,
        photoUrl,
        timestamp: new Date().toISOString(),
        message: alertContent,
      });

      return {
        valid: false,
        isCritical: true,
        canRetry: true,
        message: 'Incorrect meeting passcode. Please check with the host and try again.',
      };
    }

    // Other failed attempts (e.g. attempt 2, or retry after 3)
    return {
      valid: false,
      isCritical: false,
      canRetry: true,
      message: 'Incorrect meeting passcode. Please try again.',
    };
  }
}
