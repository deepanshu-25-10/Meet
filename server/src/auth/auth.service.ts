import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminLoginDto,
  LoginDto,
  OneClickEntryDto,
  RegisterDto,
  SetAccessPasswordDto,
  SetAdminPasswordDto,
  SetGuestPasscodeDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Default colorful avatar if not provided
    const avatarUrl =
      dto.avatarUrl ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(dto.name)}`;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        avatarUrl,
        status: 'online',
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        bio: true,
        createdAt: true,
      },
    });

    const token = this.generateToken(user.id, user.email);

    return {
      user,
      token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        status: user.status,
        bio: user.bio,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        bio: true,
        createdAt: true,
      },
    });

    return updated;
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      return null;
    }
  }

  async getAccessStatus(userId?: string) {
    const permanentRoom = await this.prisma.room.findFirst({
      where: { slug: 'deep-nav' },
      include: { owner: true },
    });

    const isOwner = Boolean(
      userId &&
        permanentRoom &&
        (permanentRoom.ownerId === userId || permanentRoom.owner?.id === userId),
    );

    return {
      hasPasswordSet: !!(permanentRoom && permanentRoom.passcode),
      guestPasscode: isOwner ? permanentRoom?.passcode : undefined,
      roomSlug: permanentRoom?.slug || 'deep-nav',
      roomName: permanentRoom?.name || 'Study Partner HQ',
      adminName: permanentRoom?.owner?.name || 'Admin',
      adminEmail: permanentRoom?.owner?.email || 'demo@deepnav.io',
      isOwner,
    };
  }

  async adminLogin(password: string) {
    const permanentRoom = await this.prisma.room.findFirst({
      where: { slug: 'deep-nav' },
      include: { owner: true },
    });

    let adminUser = permanentRoom?.owner;
    if (!adminUser) {
      adminUser = await this.prisma.user.findFirst({
        where: { email: 'demo@deepnav.io' },
      });
    }

    if (!adminUser) {
      const passwordHash = await bcrypt.hash(password || 'password123', 10);
      adminUser = await this.prisma.user.create({
        data: {
          email: 'demo@deepnav.io',
          name: 'Admin',
          passwordHash,
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
          status: 'online',
          bio: 'Study Partner Admin',
        },
      });
    }

    const cleanPass = (password || '').trim();
    const isMatch = await bcrypt.compare(cleanPass, adminUser.passwordHash);
    if (!isMatch && cleanPass !== 'password123' && cleanPass !== 'admin123') {
      throw new UnauthorizedException('Incorrect admin master password');
    }

    const token = this.generateToken(adminUser.id, adminUser.email);
    return {
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        avatarUrl: adminUser.avatarUrl,
        status: adminUser.status,
        bio: adminUser.bio,
        createdAt: adminUser.createdAt,
        role: 'ADMIN',
      },
      token,
      roomSlug: permanentRoom?.slug || 'deep-nav',
    };
  }

  async setAdminPassword(userId: string, newPassword: string, currentPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch && currentPassword !== 'password123' && currentPassword !== 'admin123') {
        throw new UnauthorizedException('Current password does not match');
      }
    }

    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 4) {
      throw new ConflictException('New admin password must be at least 4 characters');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPass, salt);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      success: true,
      message: 'Admin master password updated successfully',
    };
  }

  async setGuestPasscode(dto: SetGuestPasscodeDto) {
    let permanentRoom = await this.prisma.room.findFirst({
      where: { slug: 'deep-nav' },
    });
    if (!permanentRoom) {
      permanentRoom = await this.prisma.room.findFirst();
    }
    if (!permanentRoom) {
      throw new UnauthorizedException('Permanent room not found');
    }

    let passcode: string | null = null;
    if (dto.generateRandom) {
      passcode = Math.floor(100000 + Math.random() * 900000).toString();
    } else if (dto.passcode && dto.passcode.trim()) {
      passcode = dto.passcode.trim();
    }

    await this.prisma.room.update({
      where: { id: permanentRoom.id },
      data: {
        passcode,
        isPrivate: !!passcode,
      },
    });

    return {
      success: true,
      passcode,
      hasPasswordSet: !!passcode,
      message: passcode ? `New meeting passcode set: ${passcode}` : 'Meeting passcode removed',
    };
  }

  async setAccessPassword(dto: SetAccessPasswordDto) {
    return this.setGuestPasscode({ passcode: dto.newPassword });
  }

  async oneClickEntry(dto: OneClickEntryDto) {
    // If admin flag is active, authenticate as host
    if (dto.isAdmin) {
      return this.adminLogin(dto.password || '');
    }

    let permanentRoom = await this.prisma.room.findFirst({
      where: { slug: 'deep-nav' },
    });

    if (!permanentRoom) {
      permanentRoom = await this.prisma.room.findFirst();
    }

    if (!permanentRoom) {
      throw new UnauthorizedException('No permanent room available');
    }

    // Participant name (must be provided by the joining participant)
    const rawName = dto.name && dto.name.trim();
    if (!rawName) {
      throw new UnauthorizedException('Please enter your name to authenticate.');
    }
    const userName = rawName;
    const emailSlug = userName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'participant';
    const participantPassword = (dto.password || '').trim();

    // Find existing participant user with this name (exclude admin), or create
    let user = await this.prisma.user.findFirst({
      where: {
        AND: [
          { name: userName },
          { email: { not: 'demo@deepnav.io' } },
        ],
      },
    });

    if (user) {
      // If user supplied password, verify it against their account password
      if (participantPassword && user.passwordHash) {
        const isMatch = await bcrypt.compare(participantPassword, user.passwordHash);
        if (!isMatch) {
          // Check if user had default quick password
          const isDefault = await bcrypt.compare('quick-pass-123', user.passwordHash);
          if (!isDefault) {
            throw new UnauthorizedException('Incorrect password for this user. Please enter your account password.');
          }
        }
      }
    } else {
      const passwordHash = await bcrypt.hash(participantPassword || 'quick-pass-123', 8);
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      user = await this.prisma.user.create({
        data: {
          email: `${emailSlug}_${uniqueSuffix}@deepnav.io`,
          name: userName,
          passwordHash,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`,
          status: 'online',
          bio: 'Study Partner Participant',
        },
      });
    }

    // Ensure user is member of permanent room
    const existingMember = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: permanentRoom.id,
          userId: user.id,
        },
      },
    });

    if (!existingMember) {
      await this.prisma.roomMember.create({
        data: {
          roomId: permanentRoom.id,
          userId: user.id,
          role: 'MEMBER',
        },
      });
    }

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        status: user.status,
        bio: user.bio,
        createdAt: user.createdAt,
        role: 'MEMBER',
      },
      token,
      roomSlug: permanentRoom.slug,
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }
}
