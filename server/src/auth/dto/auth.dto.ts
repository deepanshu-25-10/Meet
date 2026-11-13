import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  status?: string; // 'online' | 'busy' | 'away' | 'offline'

  @IsOptional()
  @IsString()
  bio?: string;
}

export class OneClickEntryDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  isAdmin?: boolean;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Admin password is required' })
  password: string;
}

export class SetAdminPasswordDto {
  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  newPassword: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;
}

export class SetGuestPasscodeDto {
  @IsOptional()
  @IsString()
  passcode?: string | null;

  @IsOptional()
  generateRandom?: boolean;
}

export class SetAccessPasswordDto {
  @IsString()
  newPassword: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;
}
