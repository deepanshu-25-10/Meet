import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  content: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsArray()
  attachmentIds?: string[];
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  content: string;
}

export class ToggleReactionDto {
  @IsString()
  @IsNotEmpty({ message: 'Emoji is required' })
  emoji: string;
}

export class GetMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  pinnedOnly?: string | boolean;
}
