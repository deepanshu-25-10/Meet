import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface UserPresence {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  roomId: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  screenStreamId?: string;
  screenTrackId?: string;
  isSpeaking: boolean;
  isHandRaised?: boolean;
  presentationAudioMuted?: boolean;
  joinedAt: Date;
}

interface RemoteControlSession {
  presenterSocketId: string;
  presenterUserId: string;
  controllerSocketId: string;
  controllerUserId: string;
  controllerName: string;
  startedAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');

  // Map of socketId -> UserPresence
  private socketUserMap = new Map<string, UserPresence>();

  // Map of roomId -> Map<socketId, UserPresence>
  private roomParticipants = new Map<string, Map<string, UserPresence>>();

  // Active remote control sessions: presenterSocketId -> RemoteControlSession
  private remoteSessions = new Map<string, RemoteControlSession>();

  constructor(private prisma: PrismaService) {}

  public getRoomActiveParticipants(roomIdOrSlug: string) {
    const roomMap =
      this.roomParticipants.get(roomIdOrSlug) ||
      Array.from(this.roomParticipants.entries()).find(
        ([key]) => key === roomIdOrSlug,
      )?.[1];
    if (!roomMap) return [];
    return Array.from(roomMap.values()).map((p) => ({
      userId: p.userId,
      name: p.name,
      avatarUrl: p.avatarUrl,
      isMuted: p.isMuted,
      isCameraOff: p.isCameraOff,
      joinedAt: p.joinedAt,
    }));
  }

  public broadcastChatMessage(roomId: string, message: any) {
    if (this.server) {
      this.server.to(roomId).emit('chat:new_message', message);
    }
  }

  public broadcastCriticalAlert(roomId: string, alertData: any) {
    if (this.server) {
      this.server.to(roomId).emit('room:critical-alert', alertData);
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.handleUserLeave(client);
  }

  private handleUserLeave(client: Socket) {
    const presence = this.socketUserMap.get(client.id);
    if (!presence) return;

    const { roomId, userId, name } = presence;
    const roomMap = this.roomParticipants.get(roomId);

    if (roomMap) {
      roomMap.delete(client.id);
      if (roomMap.size === 0) {
        this.roomParticipants.delete(roomId);
      } else {
        // Broadcast participant left to remaining
        this.server.to(roomId).emit('call:participant-left', {
          socketId: client.id,
          userId,
          name,
          remainingParticipants: Array.from(roomMap.values()),
        });
      }
    }

    // Terminate any active remote control sessions involving this client
    if (this.remoteSessions.has(client.id)) {
      // Client was presenter
      const session = this.remoteSessions.get(client.id);
      if (session) {
        this.server.to(session.controllerSocketId).emit('remote:revoked', {
          reason: 'Presenter disconnected',
        });
      }
      this.remoteSessions.delete(client.id);
    } else {
      // Check if client was controller
      for (const [presId, session] of this.remoteSessions.entries()) {
        if (session.controllerSocketId === client.id) {
          this.server.to(presId).emit('remote:released', {
            reason: 'Controller disconnected',
          });
          this.remoteSessions.delete(presId);
        }
      }
    }

    this.socketUserMap.delete(client.id);
    client.leave(roomId);

    // Activity log entry (non-blocking)
    this.prisma.activityLog
      .create({
        data: {
          roomId,
          userId,
          type: 'USER_LEFT_SESSION',
          details: `${name} left the meeting session`,
        },
      })
      .catch(() => {});
  }

  // ================= ROOM PRESENCE & PARTICIPANTS =================

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      userId: string;
      name: string;
      avatarUrl?: string;
      isMuted?: boolean;
      isCameraOff?: boolean;
    },
  ) {
    const { roomId, userId, name, avatarUrl } = data;

    // Check if room has hit max participant limit (10)
    let roomMap = this.roomParticipants.get(roomId);
    if (!roomMap) {
      roomMap = new Map();
      this.roomParticipants.set(roomId, roomMap);
    }

    if (roomMap.size >= 10 && !roomMap.has(client.id)) {
      client.emit('room:error', {
        message: 'Room capacity reached (maximum 10 participants)',
      });
      return;
    }

    await client.join(roomId);

    const presence: UserPresence = {
      socketId: client.id,
      userId,
      name,
      avatarUrl,
      roomId,
      isMuted: data.isMuted ?? false,
      isCameraOff: data.isCameraOff ?? false,
      isScreenSharing: false,
      isSpeaking: false,
      joinedAt: new Date(),
    };

    this.socketUserMap.set(client.id, presence);
    roomMap.set(client.id, presence);

    // Send the current participants to the joining client
    const existingParticipants = Array.from(roomMap.values()).filter(
      (p) => p.socketId !== client.id,
    );
    client.emit('room:joined', {
      self: presence,
      existingParticipants,
    });

    // Notify other room members that someone joined
    client.to(roomId).emit('call:participant-joined', {
      participant: presence,
    });

    this.logger.log(`User ${name} (${userId}) joined room ${roomId}`);
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    this.handleUserLeave(client);
  }

  @SubscribeMessage('call:state-update')
  handleStateUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    update: Partial<
      Pick<
        UserPresence,
        'isMuted' | 'isCameraOff' | 'isScreenSharing' | 'screenStreamId' | 'screenTrackId' | 'isSpeaking' | 'isHandRaised'
      >
    >,
  ) {
    const presence = this.socketUserMap.get(client.id);
    if (!presence) return;

    Object.assign(presence, update);

    this.server.to(presence.roomId).emit('call:participant-state-updated', {
      socketId: client.id,
      userId: presence.userId,
      ...update,
    });
  }

  // Hand Raise
  @SubscribeMessage('call:raise-hand')
  handleRaiseHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isRaised: boolean },
  ) {
    const presence = this.socketUserMap.get(client.id);
    if (!presence) return;

    presence.isHandRaised = data.isRaised;
    this.logger.log(`Hand raise updated for ${presence.name} in ${presence.roomId}: ${data.isRaised}`);

    this.server.to(presence.roomId).emit('call:hand-raise-updated', {
      socketId: client.id,
      userId: presence.userId,
      name: presence.name,
      isRaised: data.isRaised,
    });
  }

  // Remote Toggle of anyone's mic or camera
  @SubscribeMessage('call:remote-toggle-media')
  handleRemoteToggleMedia(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      targetSocketId: string;
      mediaType: 'mic' | 'camera';
      enabled: boolean;
    },
  ) {
    const requester = this.socketUserMap.get(client.id);
    const target = this.socketUserMap.get(data.targetSocketId);
    if (!requester || !target) return;

    this.logger.log(
      `${requester.name} remotely set ${data.mediaType} of ${target.name} to ${data.enabled ? 'ON' : 'OFF'}`,
    );

    if (data.mediaType === 'mic') {
      target.isMuted = !data.enabled;
    } else if (data.mediaType === 'camera') {
      target.isCameraOff = !data.enabled;
    }

    // Direct event to the target client to toggle their physical track
    this.server.to(data.targetSocketId).emit('call:force-media-state', {
      mediaType: data.mediaType,
      enabled: data.enabled,
      triggeredByName: requester.name,
    });

    // Broadcast updated state to room
    this.server.to(target.roomId).emit('call:participant-state-updated', {
      socketId: target.socketId,
      userId: target.userId,
      isMuted: target.isMuted,
      isCameraOff: target.isCameraOff,
    });
  }

  // Presentation Audio Toggle (by presenter)
  @SubscribeMessage('call:presentation-audio-toggle')
  handlePresentationAudioToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isAudioEnabled: boolean },
  ) {
    const presence = this.socketUserMap.get(client.id);
    if (!presence) return;

    this.server.to(presence.roomId).emit('call:presentation-audio-updated', {
      presenterSocketId: client.id,
      isAudioEnabled: data.isAudioEnabled,
    });
  }

  // Silence Presentation (by viewers or anyone)
  @SubscribeMessage('call:silence-presentation')
  handleSilencePresentation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { presenterSocketId: string; isSilenced: boolean },
  ) {
    const requester = this.socketUserMap.get(client.id);
    if (!requester) return;

    this.logger.log(`${requester.name} set presentation audio silenced: ${data.isSilenced}`);

    this.server.to(requester.roomId).emit('call:presentation-silenced', {
      presenterSocketId: data.presenterSocketId,
      isSilenced: data.isSilenced,
      triggeredByName: requester.name,
    });
  }

  // ================= PEER MEDIA MESH SIGNALING =================

  @SubscribeMessage('webrtc:offer')
  handleWebRtcOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; offer: any },
  ) {
    const callerPresence = this.socketUserMap.get(client.id);
    this.server.to(data.targetSocketId).emit('webrtc:offer', {
      callerSocketId: client.id,
      callerInfo: callerPresence,
      offer: data.offer,
    });
  }

  @SubscribeMessage('webrtc:answer')
  handleWebRtcAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; answer: any },
  ) {
    this.server.to(data.targetSocketId).emit('webrtc:answer', {
      responderSocketId: client.id,
      answer: data.answer,
    });
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleWebRtcIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; candidate: any },
  ) {
    this.server.to(data.targetSocketId).emit('webrtc:ice-candidate', {
      senderSocketId: client.id,
      candidate: data.candidate,
    });
  }

  // ================= PERSISTENT CHAT & TYPING =================

  @SubscribeMessage('chat:send')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: any,
  ) {
    const presence = this.socketUserMap.get(client.id);
    const roomId = presence?.roomId || message.roomId;
    if (!roomId) return;

    // Broadcast the full saved message object to everyone in the room
    this.server.to(roomId).emit('chat:new_message', message);
  }

  @SubscribeMessage('chat:typing')
  handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    const presence = this.socketUserMap.get(client.id);
    if (!presence) return;

    client.to(data.roomId).emit('chat:user_typing', {
      userId: presence.userId,
      name: presence.name,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('chat:reaction_updated')
  handleChatReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; result: any },
  ) {
    this.server.to(data.roomId).emit('chat:reaction_updated', data.result);
  }

  @SubscribeMessage('chat:message_edited')
  handleChatMessageEdited(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: any },
  ) {
    this.server.to(data.roomId).emit('chat:message_edited', data.message);
  }

  @SubscribeMessage('chat:message_deleted')
  handleChatMessageDeleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: any },
  ) {
    this.server.to(data.roomId).emit('chat:message_deleted', data.message);
  }

  @SubscribeMessage('chat:message_pinned')
  handleChatMessagePinned(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: any },
  ) {
    this.server.to(data.roomId).emit('chat:message_pinned', data.message);
  }

  @SubscribeMessage('chat:clear')
  handleChatClear(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; clearedBy: string },
  ) {
    this.server.to(data.roomId).emit('chat:cleared', {
      roomId: data.roomId,
      clearedBy: data.clearedBy,
      clearedAt: new Date().toISOString(),
    });
  }

  // ================= PERMISSION-BASED REMOTE DESKTOP CONTROL =================

  @SubscribeMessage('remote:request')
  handleRemoteControlRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { presenterSocketId: string },
  ) {
    const requester = this.socketUserMap.get(client.id);
    if (!requester) return;

    this.logger.log(
      `Remote control requested by ${requester.name} for presenter ${data.presenterSocketId}`,
    );

    // Send request ONLY to the presenter
    this.server.to(data.presenterSocketId).emit('remote:incoming-request', {
      requesterSocketId: client.id,
      requesterUserId: requester.userId,
      requesterName: requester.name,
      requesterAvatar: requester.avatarUrl,
    });
  }

  @SubscribeMessage('remote:respond')
  handleRemoteControlResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      requesterSocketId: string;
      approved: boolean;
    },
  ) {
    const presenter = this.socketUserMap.get(client.id);
    const requester = this.socketUserMap.get(data.requesterSocketId);
    if (!presenter || !requester) return;

    if (data.approved) {
      // Record active session
      this.remoteSessions.set(client.id, {
        presenterSocketId: client.id,
        presenterUserId: presenter.userId,
        controllerSocketId: data.requesterSocketId,
        controllerUserId: requester.userId,
        controllerName: requester.name,
        startedAt: new Date(),
      });

      this.logger.log(
        `Remote control APPROVED: ${requester.name} controlling ${presenter.name}`,
      );

      // Notify the requester that they have control
      this.server.to(data.requesterSocketId).emit('remote:granted', {
        presenterSocketId: client.id,
        presenterName: presenter.name,
      });

      // Broadcast to room that presenter granted remote control
      this.server.to(presenter.roomId).emit('remote:status-changed', {
        presenterSocketId: client.id,
        controllerName: requester.name,
        isActive: true,
      });
    } else {
      this.server.to(data.requesterSocketId).emit('remote:denied', {
        presenterName: presenter.name,
      });
    }
  }

  @SubscribeMessage('remote:input')
  handleRemoteInput(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      presenterSocketId: string;
      event: {
        type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'keydown' | 'keyup' | 'wheel';
        x?: number;
        y?: number;
        button?: number;
        key?: string;
        code?: string;
        altKey?: boolean;
        ctrlKey?: boolean;
        shiftKey?: boolean;
        deltaX?: number;
        deltaY?: number;
      };
    },
  ) {
    // Verify session
    const session = this.remoteSessions.get(data.presenterSocketId);
    if (!session || session.controllerSocketId !== client.id) {
      // Unauthorized input attempt
      return;
    }

    // Forward input event to the presenter's socket
    this.server.to(data.presenterSocketId).emit('remote:forwarded-input', {
      controllerName: session.controllerName,
      event: data.event,
    });
  }

  @SubscribeMessage('remote:revoke')
  handleRemoteRevoke(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { reason?: string },
  ) {
    const session = this.remoteSessions.get(client.id);
    if (session) {
      this.server.to(session.controllerSocketId).emit('remote:revoked', {
        reason: data?.reason || 'Presenter revoked remote control',
      });

      const presenter = this.socketUserMap.get(client.id);
      if (presenter) {
        this.server.to(presenter.roomId).emit('remote:status-changed', {
          presenterSocketId: client.id,
          isActive: false,
        });
      }

      this.remoteSessions.delete(client.id);
    }
  }

  @SubscribeMessage('remote:release')
  handleRemoteRelease(@ConnectedSocket() client: Socket) {
    for (const [presId, session] of this.remoteSessions.entries()) {
      if (session.controllerSocketId === client.id) {
        this.server.to(presId).emit('remote:released', {
          reason: `${session.controllerName} released remote control`,
        });

        const presenter = this.socketUserMap.get(presId);
        if (presenter) {
          this.server.to(presenter.roomId).emit('remote:status-changed', {
            presenterSocketId: presId,
            isActive: false,
          });
        }

        this.remoteSessions.delete(presId);
        break;
      }
    }
  }
}
