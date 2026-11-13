import React, { useEffect, useState } from 'react';
import { useMeeting } from '../../context/MeetingContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Users,
  Info,
  Settings,
  Smile,
  MousePointer,
  ChevronUp,
  Hand,
  PictureInPicture2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ControlBarProps {
  onOpenSettings: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({ onOpenSettings }) => {
  const {
    room,
    isMuted,
    isCameraOff,
    isScreenSharing,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    leaveMeeting,
    participants,
    unreadMessagesCount,
    activeSidePanelTab,
    setActiveSidePanelTab,
    remoteControlState,
    activePresenter,
    requestRemoteControl,
    releaseRemoteControl,
    revokeRemoteControl,
    isHandRaised,
    toggleHandRaise,
    isPipActive,
    togglePip,
  } = useMeeting();

  const [currentTime, setCurrentTime] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalParticipants = participants.length + 1; // + self

  const handleEmojiClick = (emoji: string) => {
    setShowEmojiPicker(false);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.85 },
    });
  };

  return (
    <footer className="h-20 bg-[#0d1321]/95 backdrop-blur-md px-6 flex items-center justify-between border-t border-slate-800/80 z-30 select-none">
      {/* Left: Meeting Info & Clock */}
      <div className="hidden sm:flex items-center space-x-3 text-slate-300">
        <span className="font-semibold text-sm text-white tracking-wide">{currentTime}</span>
        <span className="text-slate-600">|</span>
        <div className="flex items-center space-x-1.5">
          <span className="font-medium text-sm text-slate-200">{room?.name || 'Meeting'}</span>
          <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
            /{room?.slug}
          </span>
        </div>
      </div>

      {/* Center: Main Media Action Buttons */}
      <div className="flex items-center space-x-2.5 sm:space-x-3 mx-auto sm:mx-0">
        {/* Microphone Toggle */}
        <button
          onClick={toggleMic}
          title={isMuted ? 'Turn on microphone' : 'Turn off microphone'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={toggleCamera}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isCameraOff
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          title={isScreenSharing ? 'Stop presenting' : 'Present screen'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/50'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
        >
          <ScreenShare className="w-5 h-5" />
        </button>

        {/* Remote Desktop Control Shortcut (if presentation active) */}
        {activePresenter && (
          <button
            onClick={() => {
              if (remoteControlState === 'controlling') {
                releaseRemoteControl();
              } else if (remoteControlState === 'controlled') {
                revokeRemoteControl();
              } else if (remoteControlState === 'idle' && !isScreenSharing) {
                requestRemoteControl(activePresenter.socketId);
              }
            }}
            disabled={isScreenSharing && remoteControlState === 'idle'}
            title={
              remoteControlState === 'controlling'
                ? 'Release remote control'
                : remoteControlState === 'controlled'
                ? 'Revoke remote control (Take back screen)'
                : isScreenSharing
                ? 'You are presenting (Remote control available when requested)'
                : 'Request remote desktop control'
            }
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              remoteControlState === 'controlling' || remoteControlState === 'controlled'
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-400/50'
                : isScreenSharing
                ? 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-default'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
            }`}
          >
            <MousePointer className="w-5 h-5" />
          </button>
        )}

        {/* Hand Raise */}
        <button
          onClick={toggleHandRaise}
          title={isHandRaised ? 'Lower your hand' : 'Raise hand (✋)'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isHandRaised
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Emoji Reactions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Send reaction"
            className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center transition"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#141b2d] border border-slate-700 rounded-2xl p-2 shadow-2xl flex items-center space-x-1.5 z-50 animate-in fade-in zoom-in-95">
              {['👍', '❤️', '👏', '🚀', '🔥', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Picture-in-Picture Toggle */}
        <button
          onClick={() => togglePip()}
          title={isPipActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture mode'}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isPipActive
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
          }`}
        >
          <PictureInPicture2 className="w-5 h-5" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="Audio & Video Settings"
          className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center transition"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* End Call / Leave Meeting Button */}
        <button
          onClick={leaveMeeting}
          title="Leave call"
          className="px-6 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center space-x-2 transition shadow-lg shadow-red-600/30"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden md:inline text-sm">Leave</span>
        </button>
      </div>

      {/* Right: Side Panel Toggles */}
      <div className="flex items-center space-x-2">
        {/* Room Info */}
        <button
          onClick={() => setActiveSidePanelTab(activeSidePanelTab === 'info' ? null : 'info')}
          title="Meeting Details"
          className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
            activeSidePanelTab === 'info'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Participants */}
        <button
          onClick={() => setActiveSidePanelTab(activeSidePanelTab === 'people' ? null : 'people')}
          title="People in meeting"
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition ${
            activeSidePanelTab === 'people'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {totalParticipants}
          </span>
        </button>

        {/* Chat Toggle with Unread Badge */}
        <button
          onClick={() => setActiveSidePanelTab(activeSidePanelTab === 'chat' ? null : 'chat')}
          title="Persistent Room Chat"
          className={`relative w-11 h-11 rounded-full flex items-center justify-center transition ${
            activeSidePanelTab === 'chat'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {unreadMessagesCount}
            </span>
          )}
        </button>
      </div>
    </footer>
  );
};
