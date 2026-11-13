import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
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
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('access-status')
  async getAccessStatus(@Req() req: any) {
    // Extract optional token from auth header if present
    const authHeader = req.headers?.authorization;
    let userId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = this.authService.verifyToken(token);
        userId = decoded?.sub;
      } catch (e) {}
    }
    return this.authService.getAccessStatus(userId);
  }

  @Post('admin-login')
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('set-admin-password')
  async setAdminPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: SetAdminPasswordDto,
  ) {
    return this.authService.setAdminPassword(userId, dto.newPassword, dto.currentPassword);
  }

  @Post('set-guest-passcode')
  async setGuestPasscode(@Body() dto: SetGuestPasscodeDto) {
    return this.authService.setGuestPasscode(dto);
  }

  @Post('set-access-password')
  async setAccessPassword(@Body() dto: SetAccessPasswordDto) {
    return this.authService.setAccessPassword(dto);
  }

  @Post('one-click-entry')
  async oneClickEntry(@Body() dto: OneClickEntryDto) {
    return this.authService.oneClickEntry(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }
}
