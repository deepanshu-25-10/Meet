import { Message, Room, User } from '../types';

const envApi = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '') : '';
const API_BASE = envApi ? `${envApi}/api` : '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('deepnav_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('deepnav_token', token);
  } else {
    localStorage.removeItem('deepnav_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      `Request failed with status ${response.status}`;
    throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
  }

  return data as T;
}

export const api = {
  // One-Click Entry & Access Passwords
  getAccessStatus: () =>
    request<{
      hasPasswordSet: boolean;
      guestPasscode?: string;
      roomSlug: string;
      roomName: string;
      adminName?: string;
      adminEmail?: string;
      isOwner?: boolean;
    }>('/auth/access-status'),

  adminLogin: (password: string) =>
    request<{ user: User; token: string; roomSlug: string }>('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  setAdminPassword: (payload: { newPassword: string; currentPassword?: string }) =>
    request<{ success: boolean; message: string }>('/auth/set-admin-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setGuestPasscode: (payload: { passcode?: string | null; generateRandom?: boolean }) =>
    request<{ success: boolean; passcode: string | null; hasPasswordSet: boolean; message: string }>(
      '/auth/set-guest-passcode',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  setAccessPassword: (payload: { newPassword: string; currentPassword?: string }) =>
    request<{ success: boolean; message: string; hasPasswordSet: boolean }>('/auth/set-access-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  oneClickEntry: (payload: { password?: string; name?: string; isAdmin?: boolean }) =>
    request<{ user: User; token: string; roomSlug: string }>('/auth/one-click-entry', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Auth
  register: (payload: { email: string; name: string; password: string; avatarUrl?: string }) =>
    request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<User>('/auth/me'),

  updateProfile: (payload: { name?: string; avatarUrl?: string; status?: string; bio?: string }) =>
    request<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Rooms
  getRooms: () => request<Room[]>('/rooms'),

  getLobbyInfo: (slug: string) =>
    request<{
      id: string;
      slug: string;
      name: string;
      description?: string;
      hasPasscode: boolean;
      isHost: boolean;
      passcode?: string;
      activeParticipants: Array<{
        userId: string;
        name: string;
        avatarUrl?: string;
        isMuted: boolean;
        isCameraOff: boolean;
        joinedAt: string;
      }>;
      activeCount: number;
    }>(`/rooms/${slug}/lobby-info`),

  verifyPasscode: (
    slug: string,
    payload: { passcode: string; attemptCount?: number; photoBase64?: string },
  ) =>
    request<{
      valid: boolean;
      isHost?: boolean;
      isCritical?: boolean;
      canRetry?: boolean;
      attemptsRemaining?: number;
      message?: string;
    }>(`/rooms/${slug}/verify-passcode`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRoom: (slug: string) => request<Room>(`/rooms/${slug}`),

  createRoom: (payload: {
    name: string;
    slug?: string;
    description?: string;
    isPrivate?: boolean;
    passcode?: string;
    maxParticipants?: number;
  }) =>
    request<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  joinRoom: (slug: string, passcode?: string) =>
    request<Room>(`/rooms/${slug}/join`, {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  updateRoom: (
    id: string,
    payload: {
      name?: string;
      description?: string;
      isPrivate?: boolean;
      passcode?: string;
      maxParticipants?: number;
    },
  ) =>
    request<Room>(`/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteRoom: (id: string) =>
    request<{ message: string }>(`/rooms/${id}`, {
      method: 'DELETE',
    }),

  createInvite: (roomId: string, payload: { maxUses?: number; expiresInHours?: number }) =>
    request<{ code: string; expiresAt?: string }>(`/rooms/${roomId}/invites`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  joinByInvite: (code: string) =>
    request<Room>(`/rooms/join-invite/${code}`, {
      method: 'POST',
    }),

  updateMemberRole: (roomId: string, userId: string, role: string) =>
    request<any>(`/rooms/${roomId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  revokeMember: (roomId: string, userId: string) =>
    request<any>(`/rooms/${roomId}/members/${userId}`, {
      method: 'DELETE',
    }),

  banMember: (roomId: string, userId: string) =>
    request<any>(`/rooms/${roomId}/members/${userId}/ban`, {
      method: 'POST',
    }),

  // Chat
  getMessages: (roomId: string, params?: { limit?: number; cursor?: string; search?: string; pinnedOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', params.limit.toString());
    if (params?.cursor) q.set('cursor', params.cursor);
    if (params?.search) q.set('search', params.search);
    if (params?.pinnedOnly) q.set('pinnedOnly', 'true');
    return request<{ messages: Message[]; nextCursor: string | null; totalCount: number }>(
      `/chat/rooms/${roomId}/messages?${q.toString()}`,
    );
  },

  sendMessage: (roomId: string, payload: { content: string; replyToId?: string; attachmentIds?: string[] }) =>
    request<Message>(`/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  editMessage: (messageId: string, content: string) =>
    request<Message>(`/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (messageId: string) =>
    request<Message>(`/chat/messages/${messageId}`, {
      method: 'DELETE',
    }),

  toggleReaction: (messageId: string, emoji: string) =>
    request<any>(`/chat/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  togglePin: (messageId: string) =>
    request<Message>(`/chat/messages/${messageId}/pin`, {
      method: 'POST',
    }),

  exportChat: (roomId: string) => request<any[]>(`/chat/rooms/${roomId}/export`),

  clearRoomMessages: (roomId: string) =>
    request<{ success: boolean; message: string; clearedCount: number }>(`/chat/rooms/${roomId}/messages`, {
      method: 'DELETE',
    }),

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ fileName: string; fileSize: number; mimeType: string; url: string }>('/chat/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // LiveKit
  getLiveKitConfig: () => request<{ isLiveKitEnabled: boolean; livekitUrl: string | null }>('/livekit/config'),

  getLiveKitToken: (roomSlug: string) =>
    request<{ enabled: boolean; token: string | null; url: string | null }>(`/livekit/token?room=${roomSlug}`),
};
