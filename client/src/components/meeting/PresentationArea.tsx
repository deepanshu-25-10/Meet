import React, { useEffect, useRef, useState } from 'react';
import { Participant } from '../../types';
import { useMeeting } from '../../context/MeetingContext';
import {
  Monitor,
  MousePointer,
  StopCircle,
  X,
  ShieldAlert,
  Loader2,
  Hand,
  Keyboard,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface PresentationAreaProps {
  presenter: Participant;
  isSelf: boolean;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  totalPresenters?: number;
}

export const PresentationArea: React.FC<PresentationAreaProps> = ({
  presenter,
  isSelf,
  isFocused = false,
  onToggleFocus,
  totalPresenters = 1,
}) => {
  const {
    screenStream,
    stopScreenShare,
    remoteControlState,
    requestRemoteControl,
    releaseRemoteControl,
    revokeRemoteControl,
    activeControllerName,
    remoteCursor,
    sendRemoteInput,
    isPresentationAudioEnabled,
    togglePresentationAudio,
    isPresentationSilencedLocally,
    toggleSilencePresentation,
    togglePip,
  } = useMeeting();

  const videoRef = useRef<HTMLVideoElement>(null);
  const presentationAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMouseMoveRef = useRef<number>(0);
  const [isContainerFocused, setIsContainerFocused] = useState(false);

  // Screen presentation audio should ONLY play on remote viewers when:
  // 1. Current user is not self (presenter already hears their local desktop audio)
  // 2. Viewer has not silenced presentation audio
  // 3. presenter.screenStream exists and has active audio tracks
  const isScreenAudioPlaying =
    !isSelf &&
    !isPresentationSilencedLocally &&
    Boolean(presenter.screenStream && presenter.screenStream.getAudioTracks().length > 0);

  const getScreenVideoStream = () => {
    if (isSelf) return screenStream;
    if (presenter.screenStream && presenter.screenStream.getVideoTracks().length > 0) {
      return presenter.screenStream;
    }
    if (presenter.stream && presenter.stream.getVideoTracks().length > 0) {
      return presenter.stream;
    }
    return null;
  };

  const getScreenAudioStream = () => {
    if (isSelf) return null;
    if (presenter.screenStream && presenter.screenStream.getAudioTracks().length > 0) {
      return presenter.screenStream;
    }
    return null;
  };

  // Attach presenter's screen stream
  const attachVideo = (el: HTMLVideoElement | null) => {
    (videoRef as any).current = el;
    const stream = getScreenVideoStream();
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      const play = () => el.play().catch(() => {});
      play();
      el.onloadedmetadata = play;
      el.oncanplay = play;
      stream.getVideoTracks().forEach((track) => {
        track.onunmute = play;
      });
    }
  };

  useEffect(() => {
    const el = videoRef.current;
    const stream = getScreenVideoStream();
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      const play = () => el.play().catch(() => {});
      play();
      el.onloadedmetadata = play;
      el.oncanplay = play;
      stream.getVideoTracks().forEach((track) => {
        track.onunmute = play;
      });
    }
  }, [screenStream, presenter.screenStream, presenter.stream, isSelf]);

  // Attach presenter's screen audio stream to dedicated audio element
  useEffect(() => {
    const audioEl = presentationAudioRef.current;
    const audioStream = getScreenAudioStream();
    if (audioEl && audioStream) {
      if (audioEl.srcObject !== audioStream) {
        audioEl.srcObject = audioStream;
      }
      if (isScreenAudioPlaying) {
        audioEl.play().catch((err) => console.warn('Presentation audio autoplay:', err));
      } else {
        audioEl.pause();
      }
    }
  }, [presenter.screenStream, isSelf, isScreenAudioPlaying]);

  // Emergency Escape hotkey to revoke control for presenter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelf && remoteControlState === 'controlled') {
        revokeRemoteControl();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelf, remoteControlState, revokeRemoteControl]);

  // Auto-focus container when remote control is granted to capture keystrokes
  useEffect(() => {
    if (remoteControlState === 'controlling') {
      containerRef.current?.focus();
    }
  }, [remoteControlState]);

  // Window-level keydown listener when controlling to forward keyboard typing
  useEffect(() => {
    if (remoteControlState !== 'controlling') return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      sendRemoteInput({
        type: 'keydown',
        key: e.key,
        code: e.code,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [remoteControlState, sendRemoteInput]);

  // Capture Mouse and Keyboard input when remote control is active (as controller)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (remoteControlState !== 'controlling') return;
    const now = Date.now();
    if (now - lastMouseMoveRef.current < 25) return;
    lastMouseMoveRef.current = now;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendRemoteInput({
      type: 'mousemove',
      x,
      y,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (remoteControlState !== 'controlling') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendRemoteInput({
      type: 'mousedown',
      x,
      y,
      button: e.button,
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (remoteControlState !== 'controlling') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendRemoteInput({
      type: 'mouseup',
      x,
      y,
      button: e.button,
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (remoteControlState !== 'controlling') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    sendRemoteInput({
      type: 'click',
      x,
      y,
      button: e.button,
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (remoteControlState !== 'controlling') return;
    sendRemoteInput({
      type: 'wheel',
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (remoteControlState !== 'controlling') return;
    sendRemoteInput({
      type: 'keydown',
      key: e.key,
      code: e.code,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0b0f19] rounded-2xl overflow-hidden border border-slate-800">
      {/* Top Presentation Bar */}
      <div className="h-12 bg-[#121929]/95 backdrop-blur-md px-4 flex items-center justify-between border-b border-slate-800 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
            <Monitor className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-white">
            {isSelf ? 'You are sharing your screen' : `${presenter.name} is presenting`}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Multi-screen Focus / Split toggle */}
          {totalPresenters > 1 && onToggleFocus && (
            <button
              onClick={onToggleFocus}
              title={isFocused ? 'Restore split view' : 'Focus this screen full size'}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition ${
                isFocused
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
              }`}
            >
              {isFocused ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFocused ? 'Split View' : 'Focus'}</span>
            </button>
          )}

          {/* Picture-in-Picture Button */}
          <button
            onClick={() => togglePip(videoRef.current)}
            title="Pop presentation into Picture-in-Picture"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </button>

          {/* If Presenter is self */}
          {isSelf ? (
            <div className="flex items-center space-x-2">
              {/* Audio Share Toggle after presenting */}
              <button
                onClick={togglePresentationAudio}
                title={isPresentationAudioEnabled ? 'Turn off presentation audio' : 'Turn on presentation audio'}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  isPresentationAudioEnabled
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {isPresentationAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{isPresentationAudioEnabled ? 'Audio Shared' : 'Audio Off'}</span>
              </button>

              {remoteControlState === 'controlled' && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-300 font-medium">
                    {activeControllerName || 'Participant'} has remote control
                  </span>
                  <button
                    onClick={revokeRemoteControl}
                    className="ml-2 px-2.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg transition"
                  >
                    Revoke (Esc)
                  </button>
                </div>
              )}
              <button
                onClick={stopScreenShare}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-red-600/20"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop Presenting</span>
              </button>
            </div>
          ) : (
            /* If Presenter is remote participant */
            <div className="flex items-center space-x-2">
              {/* Silence Presentation Audio Button for viewers */}
              <button
                onClick={() => toggleSilencePresentation(presenter.socketId)}
                title={isPresentationSilencedLocally ? 'Unmute presentation audio' : 'Silence presentation audio'}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  isPresentationSilencedLocally
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {isPresentationSilencedLocally ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isPresentationSilencedLocally ? 'Unsilence' : 'Silent Audio'}</span>
              </button>

              {remoteControlState === 'idle' && (
                <button
                  onClick={() => requestRemoteControl(presenter.socketId)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Request Remote Control</span>
                </button>
              )}

              {remoteControlState === 'requesting' && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium border border-slate-700">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Awaiting Presenter Consent...</span>
                </div>
              )}

              {remoteControlState === 'controlling' && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Controlling Desktop</span>
                  </span>
                  <button
                    onClick={releaseRemoteControl}
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Release</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Presentation Viewport & Interactive Surface */}
      <div
        ref={containerRef}
        tabIndex={remoteControlState === 'controlling' ? 0 : undefined}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsContainerFocused(true)}
        onBlur={() => setIsContainerFocused(false)}
        className={`relative flex-1 flex items-center justify-center bg-black overflow-hidden select-none outline-none ${
          remoteControlState === 'controlling' ? 'cursor-crosshair' : ''
        }`}
      >
        <video
          ref={attachVideo}
          autoPlay
          playsInline
          muted={true}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Dedicated Presentation Audio Element (Separated so video autoplay is 100% reliable) */}
        {!isSelf && (
          <audio
            ref={presentationAudioRef}
            autoPlay
            playsInline
            muted={!isScreenAudioPlaying}
          />
        )}

        {/* Presenter View: Controlled Alert Banner on Top */}
        {isSelf && remoteControlState === 'controlled' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-950/95 border-2 border-amber-500/80 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center space-x-3 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.35)] z-30 animate-in fade-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-xs font-semibold">
              <strong className="text-white">{activeControllerName || 'A participant'}</strong> is remotely controlling your screen.
            </span>
            <button
              onClick={revokeRemoteControl}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg transition shadow"
            >
              Revoke (Esc)
            </button>
          </div>
        )}

        {/* Remote Controller Banner Overlay (Viewer side) */}
        {remoteControlState === 'controlling' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-900/95 backdrop-blur-md border border-blue-400/50 px-5 py-2.5 rounded-2xl flex items-center space-x-3 text-white shadow-2xl z-30">
            <MousePointer className="w-4 h-4 text-blue-300 animate-pulse flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Controlling {presenter.name}&apos;s Screen:</span> Move mouse &amp; type to interact.
            </div>
            <button
              onClick={releaseRemoteControl}
              className="ml-2 px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition border border-blue-400/40"
            >
              Release
            </button>
          </div>
        )}

        {/* Presenter View: Remote Cursor & Typing Overlay */}
        {isSelf && remoteCursor && (
          <div
            className="absolute z-30 pointer-events-none transition-all duration-75"
            style={{
              left: `${remoteCursor.x * 100}%`,
              top: `${remoteCursor.y * 100}%`,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Remote Mouse Pointer with Glowing Drop Shadow */}
            <div className="relative">
              <svg
                className={`w-7 h-7 drop-shadow-[0_2px_10px_rgba(245,158,11,0.9)] text-amber-400 transition-transform ${
                  remoteCursor.isClicking ? 'scale-90' : 'scale-100'
                }`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M4 0l16 12-7 1.5 4 8.5-3.5 1.5-4-8.5-5.5 5.5z" />
              </svg>

              {/* Controller Name Tag */}
              <div className="absolute top-5 left-5 bg-amber-500 text-slate-950 text-[11px] font-black px-2 py-0.5 rounded-md shadow-lg border border-amber-300 whitespace-nowrap flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                <span>{remoteCursor.controllerName}</span>
              </div>

              {/* Click Ripple Indicator */}
              {remoteCursor.isClicking && (
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full border-2 border-amber-400 bg-amber-400/20 animate-ping" />
              )}

              {/* Key Typed Badge */}
              {remoteCursor.lastKey && (
                <div className="absolute top-11 left-5 bg-slate-900/95 text-amber-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-amber-500/50 shadow-2xl flex items-center space-x-1.5 whitespace-nowrap">
                  <Keyboard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Key: <strong className="text-white">{remoteCursor.lastKey}</strong></span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
