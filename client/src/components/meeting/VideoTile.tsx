import React, { useEffect, useRef } from 'react';
import { Participant } from '../../types';
import { useMeeting } from '../../context/MeetingContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Crown,
  Shield,
  Pin,
  Hand,
  PictureInPicture2,
} from 'lucide-react';

interface VideoTileProps {
  participant: Participant;
  isSelf?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isSelf = false,
  isPinned = false,
  onTogglePin,
}) => {
  const {
    toggleMic,
    toggleCamera,
    remoteToggleParticipantMic,
    remoteToggleParticipantCamera,
    togglePip,
  } = useMeeting();

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const attachVideo = (el: HTMLVideoElement | null) => {
    (videoRef as any).current = el;
    if (!el || !participant.stream) return;

    if (el.srcObject !== participant.stream) {
      el.srcObject = participant.stream;
    }
    const play = () => el.play().catch(() => {});
    play();
    el.onloadedmetadata = play;
    el.oncanplay = play;
    participant.stream.getVideoTracks().forEach((track) => {
      track.onunmute = play;
    });
  };

  const attachAudio = (el: HTMLAudioElement | null) => {
    (audioRef as any).current = el;
    if (!el || !participant.stream || isSelf) return;

    if (el.srcObject !== participant.stream) {
      el.srcObject = participant.stream;
    }
    el.muted = false;
    const play = () => {
      el.play().catch((err) => {
        console.warn('Remote audio autoplay waiting for user interaction:', err);
      });
    };
    play();
    el.onloadedmetadata = play;
    el.oncanplay = play;
    participant.stream.getAudioTracks().forEach((track) => {
      track.onunmute = play;
    });
  };

  // Attach media stream & listen for video track unmute
  useEffect(() => {
    const el = videoRef.current;
    if (el && participant.stream) {
      if (el.srcObject !== participant.stream) {
        el.srcObject = participant.stream;
      }
      const play = () => el.play().catch(() => {});
      play();
      el.onloadedmetadata = play;
      el.oncanplay = play;
      participant.stream.getVideoTracks().forEach((track) => {
        track.onunmute = play;
      });
    }
  }, [participant.stream, participant.isCameraOff]);

  // Attach remote audio & ensure playback
  useEffect(() => {
    const el = audioRef.current;
    if (!isSelf && el && participant.stream) {
      if (el.srcObject !== participant.stream) {
        el.srcObject = participant.stream;
      }
      const play = () => {
        el.play().catch(() => {});
      };
      play();
      el.onloadedmetadata = play;
      el.oncanplay = play;
      participant.stream.getAudioTracks().forEach((track) => {
        track.onunmute = play;
      });
    }
  }, [participant.stream, isSelf, participant.isMuted]);

  const videoTrack = participant.stream?.getVideoTracks()[0];
  const hasLiveTrack = Boolean(
    videoTrack &&
      videoTrack.readyState === 'live' &&
      (!isSelf || videoTrack.enabled !== false),
  );
  const hasVideo = !participant.isCameraOff && hasLiveTrack;

  return (
    <div
      className={`group relative w-full h-full rounded-2xl overflow-hidden bg-[#121929] border transition-all duration-300 flex items-center justify-center select-none ${
        participant.isSpeaking
          ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.35)] ring-2 ring-blue-500/50'
          : 'border-slate-800/90 hover:border-slate-700'
      }`}
    >
      {/* Remote Audio Element */}
      {!isSelf && <audio ref={attachAudio} autoPlay playsInline />}

      {/* Video Element (Kept mounted to maintain track listeners & media decoder pipeline) */}
      <video
        ref={attachVideo}
        autoPlay
        playsInline
        muted={true} // Audio is played through dedicated <audio> element to prevent video autoplay block
        className={`w-full h-full object-cover transition-transform duration-300 ${
          isSelf ? '-scale-x-100' : ''
        } ${hasVideo ? 'block' : 'hidden'}`}
      />

      {/* Camera Off Fallback: Avatar with Speaking Ripple Glow */}
      {!hasVideo && (
        <div className="relative flex flex-col items-center justify-center p-4 w-full h-full">
          {/* Animated speaking ripples */}
          {participant.isSpeaking && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-blue-500/20 animate-ping" />
              <div className="absolute w-36 h-36 rounded-full bg-blue-500/10 animate-pulse" />
            </>
          )}

          <div
            className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 transition-all flex items-center justify-center ${
              participant.isSpeaking
                ? 'bg-gradient-to-tr from-blue-500 to-emerald-400 ring-4 ring-blue-500/30'
                : 'bg-slate-800'
            }`}
          >
            <img
              src={
                participant.avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(participant.name)}`
              }
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(participant.name)}`;
              }}
              alt={participant.name}
              className="w-full h-full rounded-full object-cover bg-slate-900"
            />
          </div>
          <span className="mt-3 text-sm font-semibold text-slate-300 truncate max-w-[160px]">
            {participant.name}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 font-medium">Camera off</span>
        </div>
      )}

      {/* Hand Raised Badge */}
      {participant.isHandRaised && (
        <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-amber-500 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black shadow-lg shadow-amber-500/30 animate-bounce z-20">
          <Hand className="w-3.5 h-3.5" />
          <span>Hand Raised</span>
        </div>
      )}

      {/* Top Controls Overlay */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto">
        <button
          onClick={() => togglePip(videoRef.current)}
          title="Picture-in-Picture mode"
          className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white backdrop-blur-md transition"
        >
          <PictureInPicture2 className="w-3.5 h-3.5" />
        </button>

        {onTogglePin && (
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Unpin' : 'Pin to spotlight'}
            className={`p-1.5 rounded-lg backdrop-blur-md transition ${
              isPinned
                ? 'bg-blue-600 text-white'
                : 'bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 max-w-[65%]">
          {/* Active Speaking Indicator */}
          {participant.isSpeaking && (
            <div className="flex items-center space-x-0.5 mr-0.5">
              <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse delay-75" />
              <span className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse delay-150" />
            </div>
          )}

          <span className="text-xs font-medium text-white truncate">{participant.name}</span>
        </div>

        {/* Media Controls: Interactive remote toggle of mic and camera */}
        <div className="flex items-center space-x-1.5 pointer-events-auto">
          {/* Remote Camera Toggle Button */}
          <button
            onClick={() => {
              if (isSelf) {
                toggleCamera();
              } else {
                remoteToggleParticipantCamera(participant.socketId, participant.isCameraOff);
              }
            }}
            title={
              isSelf
                ? participant.isCameraOff
                  ? 'Turn on camera'
                  : 'Turn off camera'
                : participant.isCameraOff
                ? `Turn ON ${participant.name}'s camera`
                : `Turn OFF ${participant.name}'s camera`
            }
            className={`p-1.5 rounded-xl backdrop-blur-md border transition ${
              participant.isCameraOff
                ? 'bg-red-500/80 hover:bg-red-500 text-white border-red-500/50'
                : 'bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border-white/10'
            }`}
          >
            {participant.isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          </button>

          {/* Remote Mic Toggle Button */}
          <button
            onClick={() => {
              if (isSelf) {
                toggleMic();
              } else {
                remoteToggleParticipantMic(participant.socketId, participant.isMuted);
              }
            }}
            title={
              isSelf
                ? participant.isMuted
                  ? 'Unmute microphone'
                  : 'Mute microphone'
                : participant.isMuted
                ? `Unmute ${participant.name}'s mic`
                : `Mute ${participant.name}'s mic`
            }
            className={`p-1.5 rounded-xl backdrop-blur-md border transition ${
              participant.isMuted
                ? 'bg-red-500/80 hover:bg-red-500 text-white border-red-500/50'
                : 'bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border-white/10'
            }`}
          >
            {participant.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          {/* Connection Quality */}
          <div
            className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-slate-300"
            title={`Connection quality: ${participant.connectionQuality || 'good'}`}
          >
            <Wifi
              className={`w-3.5 h-3.5 ${
                participant.connectionQuality === 'poor'
                  ? 'text-red-400'
                  : participant.connectionQuality === 'good'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
