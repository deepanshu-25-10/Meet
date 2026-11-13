import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { MeetingProvider } from './context/MeetingContext';
import { OneClickEntryPage } from './pages/OneClickEntryPage';
import { DashboardPage } from './pages/DashboardPage';
import { MeetingLobbyPage } from './pages/MeetingLobbyPage';
import { MeetingPage } from './pages/MeetingPage';
import { api } from './services/api';
import { Loader2 } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeRoomSlug, setActiveRoomSlug] = useState<string | null>(null);
  const [isJoinedMeeting, setIsJoinedMeeting] = useState<boolean>(false);
  const [joinedMediaConfig, setJoinedMediaConfig] = useState<{
    isMuted: boolean;
    isCameraOff: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    passcode?: string;
  } | null>(null);

  // Sync with browser URL path (e.g. /room/deep-nav, /join/code)
  useEffect(() => {
    const handleLocationChange = async () => {
      const path = window.location.pathname;

      if (path.startsWith('/room/')) {
        const slug = path.replace('/room/', '').trim();
        if (slug) {
          setActiveRoomSlug(slug);
        }
      } else if (path.startsWith('/join/')) {
        const code = path.replace('/join/', '').trim();
        if (code && user) {
          try {
            const room = await api.joinByInvite(code);
            window.history.pushState({}, '', `/room/${room.slug}`);
            setActiveRoomSlug(room.slug);
          } catch (e: any) {
            alert(e.message || 'Invalid invite link');
            window.history.pushState({}, '', '/');
            setActiveRoomSlug(null);
          }
        }
      } else {
        setActiveRoomSlug(null);
        setIsJoinedMeeting(false);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [user]);

  const handleJoinRoom = (slug: string) => {
    window.history.pushState({}, '', `/room/${slug}`);
    setActiveRoomSlug(slug);
    setIsJoinedMeeting(false);
  };

  const handleLeaveRoom = () => {
    setIsJoinedMeeting(false);
    setJoinedMediaConfig(null);
    window.history.pushState({}, '', '/');
    setActiveRoomSlug(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Not authenticated: Prompt for user authentication (Create username & password, or Admin login)
  if (!user) {
    return (
      <OneClickEntryPage
        onEnterRoom={handleJoinRoom}
        targetSlug={activeRoomSlug || 'deep-nav'}
      />
    );
  }

  // In a room route:
  // Step 1: Show Google Meet-style Device Config & Lobby (Green Room) with live occupancy & welcome msg
  // Step 2: Once passcode is verified or Join clicked, transition to MeetingPage
  if (activeRoomSlug) {
    if (!isJoinedMeeting) {
      return (
        <MeetingLobbyPage
          slug={activeRoomSlug}
          onJoin={(mediaConfig) => {
            setJoinedMediaConfig(mediaConfig);
            setIsJoinedMeeting(true);
          }}
          onLeave={handleLeaveRoom}
        />
      );
    }

    return (
      <MeetingProvider>
        <MeetingPage
          slug={activeRoomSlug}
          initialMediaConfig={joinedMediaConfig || undefined}
          onLeave={handleLeaveRoom}
        />
      </MeetingProvider>
    );
  }

  // Main Dashboard
  return (
    <MeetingProvider>
      <DashboardPage onJoinRoom={handleJoinRoom} />
    </MeetingProvider>
  );
};
