import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ChatService } from './chat.service';
import {
  EditMessageDto,
  GetMessagesQueryDto,
  SendMessageDto,
  ToggleReactionDto,
} from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('api/chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Get('rooms/:roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatService.getMessages(roomId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('rooms/:roomId/messages')
  async clearRoomMessages(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.clearRoomMessages(roomId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:roomId/messages')
  async sendMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.saveMessage(roomId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('messages/:id')
  async editMessage(
    @Param('id') messageId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(messageId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('messages/:id')
  async deleteMessage(
    @Param('id') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.deleteMessage(messageId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages/:id/react')
  async toggleReaction(
    @Param('id') messageId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.chatService.toggleReaction(messageId, userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('messages/:id/pin')
  async togglePin(
    @Param('id') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.togglePin(messageId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms/:roomId/export')
  async exportChat(@Param('roomId') roomId: string) {
    return this.chatService.exportChatHistory(roomId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB max
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const fileUrl = `/uploads/${file.filename}`;
    return {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      url: fileUrl,
    };
  }
}
