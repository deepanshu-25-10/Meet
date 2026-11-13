import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChatModule } from './chat/chat.module';
import { LiveKitModule } from './livekit/livekit.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RoomsModule,
    ChatModule,
    LiveKitModule,
    GatewayModule,
  ],
})
export class AppModule {}
