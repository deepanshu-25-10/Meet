export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  bio?: string;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  isBanned: boolean;
  joinedAt: string;
  user: User;
}

export interface ActivityLog {
  id: string;
  roomId: string;
  userId?: string;
  type: string;
  details?: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  hasPasscode?: boolean;
  passcode?: string | null;
  maxParticipants: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner?: User;
  members: RoomMember[];
  activities?: ActivityLog[];
  isOwner?: boolean;
  isMember?: boolean;
  _count?: {
    members: number;
    messages: number;
  };
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
  };
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  replyTo?: {
    id: string;
    content: string;
    sender: {
      id: string;
      name: string;
    };
  };
  attachments: Attachment[];
  reactions: Reaction[];
}

export interface Participant {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isHandRaised?: boolean;
  presentationAudioEnabled?: boolean;
  presentationSilenced?: boolean;
  audioLevel?: number;
  stream?: MediaStream;
  screenStream?: MediaStream;
  screenStreamId?: string;
  screenTrackId?: string;
  connectionQuality?: 'excellent' | 'good' | 'poor';
}

export interface MeetingNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'hand' | 'media';
  timestamp: number;
}

export interface ChatToast {
  id: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
}

export interface RemoteControlRequest {
  requesterSocketId: string;
  requesterUserId: string;
  requesterName: string;
  requesterAvatar?: string;
}

export interface RemoteInputEvent {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'keydown' | 'keyup' | 'wheel';
  x?: number; // 0.0 to 1.0
  y?: number; // 0.0 to 1.0
  button?: number;
  key?: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  deltaX?: number;
  deltaY?: number;
}
