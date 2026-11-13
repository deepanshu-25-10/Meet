import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import {
  CreateInviteDto,
  CreateRoomDto,
  JoinRoomDto,
  UpdateMemberRoleDto,
  UpdateRoomDto,
  VerifyPasscodeDto,
} from './dto/rooms.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':slug/lobby-info')
  async getLobbyInfo(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.roomsService.getLobbyInfo(slug, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug/verify-passcode')
  async verifyPasscode(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPasscodeDto,
  ) {
    return this.roomsService.verifyPasscode(slug, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createRoom(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.roomsService.createRoom(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getRooms(@CurrentUser('id') userId: string) {
    return this.roomsService.getRoomsForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':slug')
  async getRoomBySlug(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.roomsService.getRoomBySlug(slug, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':slug/join')
  async joinRoom(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
    @Body() dto: JoinRoomDto,
  ) {
    return this.roomsService.joinRoom(slug, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateRoom(
    @Param('id') roomId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(roomId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteRoom(
    @Param('id') roomId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.roomsService.deleteRoom(roomId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invites')
  async createInvite(
    @Param('id') roomId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.roomsService.createInvite(roomId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join-invite/:code')
  async joinByInvite(
    @Param('code') code: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.roomsService.joinByInvite(code, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Param('id') roomId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.roomsService.updateMemberRole(
      roomId,
      currentUserId,
      targetUserId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:userId')
  async revokeMember(
    @Param('id') roomId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.roomsService.revokeMemberAccess(
      roomId,
      currentUserId,
      targetUserId,
      false,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/members/:userId/ban')
  async banMember(
    @Param('id') roomId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.roomsService.revokeMemberAccess(
      roomId,
      currentUserId,
      targetUserId,
      true,
    );
  }
}
