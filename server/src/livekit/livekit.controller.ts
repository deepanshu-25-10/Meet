import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/livekit')
export class LiveKitController {
  constructor(private livekitService: LiveKitService) {}

  @Get('config')
  getConfig() {
    return this.livekitService.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Get('token')
  async getToken(
    @Query('room') roomSlug: string,
    @CurrentUser() user: any,
  ) {
    return this.livekitService.generateToken(roomSlug, user);
  }
}
