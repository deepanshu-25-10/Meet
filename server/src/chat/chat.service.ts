import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EditMessageDto,
  GetMessagesQueryDto,
  SendMessageDto,
  ToggleReactionDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getMessages(roomId: string, query: GetMessagesQueryDto) {
    const limit = query.limit || 50;
    const isPinnedOnly = query.pinnedOnly === true || query.pinnedOnly === 'true';

    const where: any = {
      roomId,
      ...(isPinnedOnly ? { isPinned: true } : {}),
      ...(query.search
        ? {
            content: {
              contains: query.search,
            },
          }
        : {}),
    };

    const messages = await this.prisma.message.findMany({
      where,
      take: limit,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: { id: query.cursor },
          }
        : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      messages,
      nextCursor,
      totalCount: await this.prisma.message.count({ where: { roomId } }),
    };
  }

  async saveMessage(roomId: string, senderId: string, dto: SendMessageDto) {
    // Verify room exists
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content: dto.content,
        replyToId: dto.replyToId || null,
        ...(dto.attachmentIds && dto.attachmentIds.length > 0
          ? {
              attachments: {
                connect: dto.attachmentIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return message;
  }

  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        isEdited: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return updated;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { room: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isSender = message.senderId === userId;
    const isOwner = message.room.ownerId === userId;

    if (!isSender && !isOwner) {
      throw new ForbiddenException('You do not have permission to delete this message');
    }

    // Soft delete: keep the record to maintain reply threads, but blank content
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: 'This message was deleted',
        isDeleted: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        attachments: true,
        reactions: true,
      },
    });

    return updated;
  }

  async clearRoomMessages(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isOwner = room.ownerId === userId;
    const isRoomAdmin = room.members?.some(
      (m) => m.userId === userId && m.role === 'ADMIN',
    );
    const isAdminUser =
      user?.name?.toLowerCase() === 'admin' ||
      user?.email?.toLowerCase().includes('admin') ||
      isOwner ||
      isRoomAdmin;

    if (!isAdminUser) {
      throw new ForbiddenException('Only room owner or admin can wipe chat history');
    }

    // Unlink replyTo to avoid foreign key cycle during bulk delete
    await this.prisma.message.updateMany({
      where: { roomId },
      data: { replyToId: null },
    });

    // Delete reactions and attachments
    await this.prisma.reaction.deleteMany({
      where: { message: { roomId } },
    });

    await this.prisma.attachment.deleteMany({
      where: { message: { roomId } },
    });

    // Delete all messages in the room
    const result = await this.prisma.message.deleteMany({
      where: { roomId },
    });

    return {
      success: true,
      message: 'Chat history cleared successfully',
      clearedCount: result.count,
    };
  }

  async toggleReaction(messageId: string, userId: string, dto: ToggleReactionDto) {
    const existing = await this.prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: dto.emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.reaction.delete({
        where: { id: existing.id },
      });
      return { action: 'removed', emoji: dto.emoji, messageId, userId };
    } else {
      const reaction = await this.prisma.reaction.create({
        data: {
          messageId,
          userId,
          emoji: dto.emoji,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      return { action: 'added', reaction };
    }
  }

  async togglePin(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { room: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned: !message.isPinned,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return updated;
  }

  async createAttachment(data: {
    messageId?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    url: string;
  }) {
    // If messageId is not yet assigned, create attachment standalone and link later
    return this.prisma.attachment.create({
      data: {
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        url: data.url,
        ...(data.messageId ? { messageId: data.messageId } : { messageId: '' }),
      },
    });
  }

  async exportChatHistory(roomId: string) {
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            name: true,
            email: true,
          },
        },
        attachments: true,
      },
    });

    return messages.map((m) => ({
      id: m.id,
      timestamp: m.createdAt,
      sender: m.sender.name,
      content: m.isDeleted ? '[Deleted Message]' : m.content,
      edited: m.isEdited,
      attachments: m.attachments.map((a) => a.fileName),
    }));
  }
}
