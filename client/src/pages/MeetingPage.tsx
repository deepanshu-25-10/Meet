import React, { useEffect, useState } from 'react';
import { useMeeting } from '../context/MeetingContext';
import { useAuth } from '../context/AuthContext';
import { VideoGrid } from '../components/meeting/VideoGrid';
import { PresentationArea } from '../components/meeting/PresentationArea';
import { ControlBar } from '../components/meeting/ControlBar';
import { SidePanel } from '../components/meeting/SidePanel';
import { RemoteApprovalModal } from '../components/meeting/RemoteApprovalModal';
import { DeviceSettingsModal } from '../components/common/DeviceSettingsModal';
import { VideoTile } from '../components/meeting/VideoTile';
import { Participant } from '../types';
import { getSocket } from '../services/socket';
import { Loader2, AlertCircle, ArrowLeft, Lock, X, Grid, Monitor, Maximize2 } from 'lucide-react';

interface MeetingPageProps {
  slug: string;
  onLeave: () => void;
  initialMediaConfig?: {
    isMuted?: boolean;
    isCameraOff?: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    passcode?: string;
  };
}

export const MeetingPage: React.FC<MeetingPageProps> = ({ slug, onLeave, initialMediaConfig }) => {
  const { user } = useAuth();
  const {
    room,
    isLoadingRoom,
    isInCall,
    joinMeeting,
    leaveMeeting,
    participants,
    localStream,
    isMuted,
    isCameraOff,
    isSpeaking,
    isScreenSharing,
    activePresenter,
    activePresenters,
    isHandRaised,
    notifications,
    dismissNotification,
    chatToasts,
    dismissChatToast,
    setIsChatOpen,
  } = useMeeting();

  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [spotlightPresenterId, setSpotlightPresenterId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [passcodePrompt, setPasscodePrompt] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');

  // Handle joining room on mount
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setJoinError(null);
        const savedPass =
          initialMediaConfig?.passcode ||
          localStorage.getItem('deepnav_saved_password') ||
          undefined;
        await joinMeeting(slug, savedPass, {
          isMuted: initialMediaConfig?.isMuted,
          isCameraOff: initialMediaConfig?.isCameraOff,
          audioDeviceId: initialMediaConfig?.audioDeviceId,
          videoDeviceId: initialMediaConfig?.videoDeviceId,
        });
      } catch (err: any) {
        if (!isMounted) return;
        if (err.message && err.message.toLowerCase().includes('passcode')) {
          setPasscodePrompt(true);
        } else {
          setJoinError(err.message || 'Failed to join meeting room');
        }
      }
    };

    if (!isInCall) {
      init();
    }

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // User gesture listener to unblock/resume any audio blocked by browser autoplay policy
  useEffect(() => {
    const resumeAudio = () => {
      document.querySelectorAll('audio, video').forEach((el: any) => {
        if (el.paused && el.srcObject && !el.muted) {
          el.play().catch(() => {});
        }
      });
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, []);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setJoinError(null);
      await joinMeeting(slug, passcodeInput);
      if (passcodeInput) {
        localStorage.setItem('deepnav_saved_password', passcodeInput);
      }
      setPasscodePrompt(false);
    } catch (err: any) {
      setJoinError(err.message || 'Invalid passcode');
    }
  };

  const handleExitCall = () => {
    leaveMeeting();
    onLeave();
  };

  const selfParticipant: Participant = {
    socketId: 'self',
    userId: user?.id || 'self',
    name: `${user?.name || 'You'} (You)`,
    avatarUrl: user?.avatarUrl,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isSpeaking,
    isHandRaised,
    stream: localStream || undefined,
    connectionQuality: 'excellent',
  };

  // Presenter is strictly self ONLY if this local tab is actively screen sharing
  const isSelfPresenter = isScreenSharing;

  // Loading state
  if (isLoadingRoom) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-200">
          Connecting to permanent room <span className="text-blue-400 font-mono">/{slug}</span>...
        </p>
      </div>
    );
  }

  // Passcode Required Modal
  if (passcodePrompt) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#131b2e] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
          <div className="flex items-center space-x-3 text-amber-400">
            <Lock className="w-6 h-6" />
            <h3 className="text-lg font-bold text-white">Private Room Passcode</h3>
          </div>
          <p className="text-xs text-slate-300">
            This permanent room is protected. Please enter the passcode to enter.
          </p>

          {joinError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              {joinError}
            </div>
          )}

          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Enter passcode"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              className="w-full bg-[#182337] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleExitCall}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
              >
                Enter Room
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Error state
  if (joinError) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-4 space-y-4">
        <div className="p-4 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-bold text-white">Could not join room</h3>
        <p className="text-xs text-slate-400 max-w-sm text-center">{joinError}</p>
        <button
          onClick={handleExitCall}
          className="mt-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    );
  }

  const otherParticipants = [selfParticipant, ...participants];

  const spotlightPresenter = activePresenters.find((p) => p.socketId === spotlightPresenterId);

  return (
    <div className="h-screen w-screen bg-[#0b0f19] flex flex-col overflow-hidden select-none">
      {/* Central Interactive Content Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Main Stage: Presentation or Video Grid */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {activePresenters.length > 0 ? (
            /* Screen Sharing Multi-Presentation Layout */
            <div className="w-full h-full flex flex-col lg:flex-row gap-3 overflow-hidden">
              {/* Presentations Canvas & Multi-screen Switcher */}
              <div className="flex-1 h-full min-h-[300px] flex flex-col gap-2 overflow-hidden">
                {/* Switcher bar when 2+ people are presenting simultaneously */}
                {activePresenters.length > 1 && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#121929]/95 border border-slate-800 rounded-xl flex-shrink-0 shadow-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/25">
                        {activePresenters.length} Screens Sharing Simultaneously
                      </span>
                      <span className="text-xs text-slate-300 hidden sm:inline">
                        Split view active • Click to spotlight any screen
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setSpotlightPresenterId(null)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 ${
                          !spotlightPresenterId || !spotlightPresenter
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Grid className="w-3.5 h-3.5" />
                        <span>Split View</span>
                      </button>
                      {activePresenters.map((p) => {
                        const isSelected = spotlightPresenterId === p.socketId;
                        const isSelf = p.socketId === 'self';
                        return (
                          <button
                            key={p.socketId}
                            onClick={() => setSpotlightPresenterId(p.socketId)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Monitor className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[120px]">{isSelf ? 'Your Screen' : p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Presentations Viewport */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {spotlightPresenterId && spotlightPresenter ? (
                    /* Single Spotlighted Presentation */
                    <div className="w-full h-full">
                      <PresentationArea
                        presenter={spotlightPresenter}
                        isSelf={spotlightPresenter.socketId === 'self'}
                        isFocused={true}
                        totalPresenters={activePresenters.length}
                        onToggleFocus={() => setSpotlightPresenterId(null)}
                      />
                    </div>
                  ) : (
                    /* Multi-Screen Split Grid (e.g. 2 screens side-by-side or responsive grid) */
                    <div
                      className={`w-full h-full grid gap-3 ${
                        activePresenters.length === 1
                          ? 'grid-cols-1'
                          : activePresenters.length === 2
                          ? 'grid-cols-1 xl:grid-cols-2'
                          : 'grid-cols-1 md:grid-cols-2'
                      }`}
                    >
                      {activePresenters.map((p) => (
                        <div key={p.socketId} className="w-full h-full min-h-0">
                          <PresentationArea
                            presenter={p}
                            isSelf={p.socketId === 'self'}
                            isFocused={false}
                            totalPresenters={activePresenters.length}
                            onToggleFocus={() => setSpotlightPresenterId(p.socketId)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Side Participant Filmstrip */}
              <div className="lg:w-64 flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-y-auto max-h-full">
                {otherParticipants.map((p) => (
                  <div key={p.socketId} className="w-44 lg:w-full h-32 flex-shrink-0">
                    <VideoTile
                      participant={p}
                      isSelf={p.socketId === 'self'}
                      isPinned={pinnedId === p.socketId}
                      onTogglePin={() => setPinnedId(pinnedId === p.socketId ? null : p.socketId)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Standard Responsive Video Grid */
            <VideoGrid
              selfParticipant={selfParticipant}
              remoteParticipants={participants}
              pinnedId={pinnedId}
              onTogglePin={(id) => setPinnedId(pinnedId === id ? null : id)}
            />
          )}
        </div>

        {/* Collapsible Persistent Chat / People / Info Panel */}
        <SidePanel />
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center space-y-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto px-4 py-2 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center space-x-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 ${
              n.type === 'hand'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200 shadow-amber-500/10'
                : n.type === 'warning'
                ? 'bg-red-950/90 border-red-500/50 text-red-200 shadow-red-500/10'
                : 'bg-blue-950/90 border-blue-500/50 text-blue-200 shadow-blue-500/10'
            }`}
          >
            <span>{n.message}</span>
            <button
              onClick={() => dismissNotification(n.id)}
              className="text-slate-400 hover:text-white ml-2 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Chat Message Pop Toast Notification on Side */}
      <div className="fixed bottom-24 left-6 z-40 flex flex-col space-y-2.5 pointer-events-none max-w-sm sm:max-w-md">
        {chatToasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => {
              setIsChatOpen(true);
              dismissChatToast(toast.id);
            }}
            className="pointer-events-auto cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-[#141d30]/95 hover:bg-[#18233a] border border-blue-500/40 hover:border-blue-400 shadow-2xl shadow-black/80 backdrop-blur-md flex items-start space-x-3 transition-all transform hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-3 duration-200 group ring-1 ring-blue-500/20"
          >
            <img
              src={
                toast.senderAvatar ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(toast.senderName)}`
              }
              alt={toast.senderName}
              className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex-shrink-0 mt-0.5 object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between space-x-2">
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition truncate">
                  {toast.senderName}
                </span>
                <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/15 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  Chat
                </span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 mt-0.5 break-words font-medium">
                {toast.content}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissChatToast(toast.id);
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition -mr-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Floating Bottom Control Bar */}
      <ControlBar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Remote Desktop Control Approval Modal (for Presenter) */}
      <RemoteApprovalModal />

      {/* Hardware Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
