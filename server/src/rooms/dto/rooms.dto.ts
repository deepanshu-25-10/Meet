import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'Room name is required' })
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  passcode?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  maxParticipants?: number;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  passcode?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(10)
  maxParticipants?: number;
}

export class JoinRoomDto {
  @IsOptional()
  @IsString()
  passcode?: string;
}

export class VerifyPasscodeDto {
  @IsString()
  passcode: string;

  @IsOptional()
  @IsInt()
  attemptCount?: number;

  @IsOptional()
  @IsString()
  photoBase64?: string;
}

export class UpdateMemberRoleDto {
  @IsString()
  @Matches(/^(ADMIN|MEMBER|GUEST)$/, {
    message: 'Role must be ADMIN, MEMBER, or GUEST',
  })
  role: string;
}

export class CreateInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;
}
