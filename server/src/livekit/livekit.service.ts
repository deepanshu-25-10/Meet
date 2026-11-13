import { Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private apiKey = process.env.LIVEKIT_API_KEY || '';
  private apiSecret = process.env.LIVEKIT_API_SECRET || '';
  private livekitUrl = process.env.LIVEKIT_URL || '';

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret && this.livekitUrl);
  }

  getConfig() {
    return {
      isLiveKitEnabled: this.isConfigured(),
      livekitUrl: this.livekitUrl || null,
    };
  }

  async generateToken(
    roomSlug: string,
    user: { id: string; name: string; avatarUrl?: string },
  ) {
    if (!this.isConfigured()) {
      return {
        enabled: false,
        token: null,
        url: null,
      };
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: user.id,
      name: user.name,
      metadata: JSON.stringify({
        avatarUrl: user.avatarUrl,
        userId: user.id,
      }),
      ttl: '24h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomSlug,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      enabled: true,
      token,
      url: this.livekitUrl,
    };
  }
}
