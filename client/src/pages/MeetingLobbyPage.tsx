import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  Shield,
  Users,
  Lock,
  Unlock,
  KeyRound,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Sparkles,
  CheckCircle2,
  Copy,
  ChevronDown,
  Volume2,
  RefreshCw,
} from 'lucide-react';

interface MeetingLobbyPageProps {
  slug: string;
  onJoin: (mediaConfig: {
    isMuted: boolean;
    isCameraOff: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    passcode?: string;
  }) => void;
  onLeave: () => void;
}

export const MeetingLobbyPage: React.FC<MeetingLobbyPageProps> = ({
  slug,
  onJoin,
  onLeave,
}) => {
  const { user, logout } = useAuth();

  // Local media preview states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Lobby & Room Info states
  const [roomInfo, setRoomInfo] = useState<{
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
  } | null>(null);
  const [isLoadingLobby, setIsLoadingLobby] = useState(true);

  // Passcode modal states
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Host passcode management states
  const [hostNewPasscode, setHostNewPasscode] = useState('');
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);
  const [hostPasscodeSuccess, setHostPasscodeSuccess] = useState<string | null>(null);
  const [copiedPasscode, setCopiedPasscode] = useState(false);

  // Welcome state (first visit vs returning visit)
  const [isReturningUser, setIsReturningUser] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Detect returning visit vs first visit
  useEffect(() => {
    const visitKey = `sp_visited_${slug}_${user?.id || 'guest'}`;
    const hasVisited = localStorage.getItem(visitKey);
    if (hasVisited) {
      setIsReturningUser(true);
    } else {
      localStorage.setItem(visitKey, 'true');
      setIsReturningUser(false);
    }
  }, [slug, user]);

  // Fetch Lobby Info
  const fetchLobby = async () => {
    try {
      const data = await api.getLobbyInfo(slug);
      setRoomInfo(data);
      if (data.isHost && data.passcode !== undefined) {
        setHostNewPasscode(data.passcode || '');
      }
    } catch (err: any) {
      console.warn('Failed to fetch lobby info:', err);
    } finally {
      setIsLoadingLobby(false);
    }
  };

  useEffect(() => {
    fetchLobby();
    const interval = setInterval(fetchLobby, 3500);
    return () => clearInterval(interval);
  }, [slug]);

  // Initialize Media Devices & Stream for Green Room Preview
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    const startMedia = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedAudioDevice
            ? { deviceId: { exact: selectedAudioDevice } }
            : true,
          video: selectedVideoDevice
            ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Enumerate devices for selector
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === 'audioinput');
        const videos = devices.filter((d) => d.kind === 'videoinput');
        setAudioDevices(audios);
        setVideoDevices(videos);

        // Setup Audio Analyser for volume wave meter
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (analyserRef.current) {
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              }
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch (e) {
          console.warn('Audio analyser error:', e);
        }
      } catch (err) {
        console.warn('Failed to access media devices:', err);
      }
    };

    startMedia();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedAudioDevice, selectedVideoDevice]);

  // Toggle Microphone
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const nextMuted = !isMuted;
      audioTracks.forEach((t) => (t.enabled = !nextMuted));
      setIsMuted(nextMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const nextCameraOff = !isCameraOff;
      videoTracks.forEach((t) => (t.enabled = !nextCameraOff));
      setIsCameraOff(nextCameraOff);
    } else {
      setIsCameraOff(!isCameraOff);
    }
  };

  // Handle Join click
  const handleJoinClick = () => {
    // If Host, bypass passcode modal completely
    if (roomInfo?.isHost) {
      enterMeeting();
      return;
    }

    // If Room has passcode, open verification dialog
    if (roomInfo?.hasPasscode) {
      setIsPasscodeModalOpen(true);
      return;
    }

    // Otherwise join directly
    enterMeeting();
  };

  // Final join transition
  const enterMeeting = (verifiedPasscode?: string) => {
    // Cleanup local preview stream so MeetingPage can acquire media smoothly
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }

    onJoin({
      isMuted,
      isCameraOff,
      audioDeviceId: selectedAudioDevice,
      videoDeviceId: selectedVideoDevice,
      passcode: verifiedPasscode,
    });
  };

  // Verify Passcode Submit
  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;

    setPasscodeError(null);
    setIsVerifying(true);

    const nextAttempt = consecutiveFailures + 1;

    // Silently capture camera snapshot if video is active
    let photoBase64: string | undefined = undefined;
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(640, videoRef.current.videoWidth);
        canvas.height = Math.min(480, videoRef.current.videoHeight);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          photoBase64 = canvas.toDataURL('image/jpeg', 0.65);
        }
      } catch (err) {
        console.warn('Silent snapshot capture error:', err);
      }
    }

    try {
      const res = await api.verifyPasscode(slug, {
        passcode: passcodeInput.trim(),
        attemptCount: nextAttempt,
        photoBase64,
      });

      if (res.valid) {
        setConsecutiveFailures(0);
        setIsPasscodeModalOpen(false);
        enterMeeting(passcodeInput.trim());
      } else {
        setConsecutiveFailures(nextAttempt);
        // Requirement: Do NOT block user after 3 failed attempts, allow retry
        // Requirement: Do NOT notify him/her that an image was sent
        setPasscodeError(
          res.message || 'Incorrect meeting passcode. Please try again.',
        );
      }
    } catch (err: any) {
      setConsecutiveFailures(nextAttempt);
      setPasscodeError(
        err.message || 'Incorrect meeting passcode. Please try again.',
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // Host updates room passcode
  const handleHostSavePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInfo?.id) return;
    setIsUpdatingPasscode(true);
    setHostPasscodeSuccess(null);

    try {
      const trimmed = hostNewPasscode.trim();
      await api.updateRoom(roomInfo.id, {
        passcode: trimmed || undefined,
      });
      setHostPasscodeSuccess(
        trimmed ? 'Meeting passcode updated!' : 'Passcode removed (open meeting).',
      );
      await fetchLobby();
      setTimeout(() => setHostPasscodeSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update passcode');
    } finally {
      setIsUpdatingPasscode(false);
    }
  };

  const copyPasscodeToClipboard = () => {
    if (roomInfo?.passcode) {
      navigator.clipboard.writeText(roomInfo.passcode);
      setCopiedPasscode(true);
      setTimeout(() => setCopiedPasscode(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col justify-between selection:bg-blue-600/30">
      {/* Top Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-[#0d1322]/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1.5px] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-[#0d1322] rounded-[10px] flex items-center justify-center">
              <Video className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center space-x-2">
              <span>{roomInfo?.name || 'Study Partner Meeting'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {slug}
              </span>
            </h1>
            <p className="text-xs text-slate-400">Audio & Video Readiness Lobby</p>
          </div>
        </div>

        {/* User Identity pill */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1.5 shadow-sm">
            <img
              src={
                user?.avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                  user?.name || 'User',
                )}`
              }
              alt={user?.name}
              className="w-6 h-6 rounded-full bg-slate-800 object-cover"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-200">{user?.name}</span>
              {roomInfo?.isHost && (
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                  Host / Admin
                </span>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            title="Log out or switch identity"
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left: Camera Preview */}
        <div className="w-full lg:w-3/5 max-w-2xl flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/90 shadow-2xl flex items-center justify-center">
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
                isCameraOff ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Camera Off Placeholder */}
            {isCameraOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#070b13]">
                <img
                  src={
                    user?.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                      user?.name || 'User',
                    )}`
                  }
                  alt={user?.name}
                  className="w-24 h-24 rounded-full border-4 border-slate-800 bg-slate-900 shadow-xl object-cover mb-3"
                />
                <span className="text-base font-semibold text-slate-300">{user?.name}</span>
                <span className="text-xs text-slate-500 mt-1">Camera is turned off</span>
              </div>
            )}

            {/* Audio volume indicator visualizer ring on avatar/video */}
            {!isMuted && audioLevel > 5 && (
              <div
                className="absolute top-4 left-4 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs backdrop-blur-md animate-pulse"
                title={`Microphone input level: ${audioLevel}%`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Mic Active</span>
              </div>
            )}

            {/* Bottom media controls pill */}
            <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 shadow-2xl z-10">
              {/* Mic Toggle */}
              <button
                onClick={toggleMute}
                title={isMuted ? 'Turn on microphone' : 'Mute microphone'}
                className={`p-3 rounded-full transition duration-150 relative ${
                  isMuted
                    ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Camera Toggle */}
              <button
                onClick={toggleCamera}
                title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
                className={`p-3 rounded-full transition duration-150 ${
                  isCameraOff
                    ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Device Selection Pickers */}
          <div className="w-full mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Audio Device Selector */}
            <div className="flex items-center space-x-2 bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <Mic className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <select
                value={selectedAudioDevice}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                className="bg-transparent text-slate-200 outline-none w-full truncate cursor-pointer"
              >
                {audioDevices.length === 0 ? (
                  <option value="">Default Microphone</option>
                ) : (
                  audioDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} className="bg-[#0e1628] text-white">
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Video Device Selector */}
            <div className="flex items-center space-x-2 bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <Video className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <select
                value={selectedVideoDevice}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                className="bg-transparent text-slate-200 outline-none w-full truncate cursor-pointer"
              >
                {videoDevices.length === 0 ? (
                  <option value="">Default Camera</option>
                ) : (
                  videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId} className="bg-[#0e1628] text-white">
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Welcome, Occupancy & Join Action */}
        <div className="w-full lg:w-2/5 max-w-md flex flex-col justify-center space-y-6">
          {/* Welcome Banner */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>{isReturningUser ? 'Welcome back' : 'Ready to collaborate'}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {isReturningUser ? `Welcome back, ${user?.name}!` : `Welcome, ${user?.name}!`}
            </h2>
            <p className="text-sm text-slate-400">
              Configure your mic and camera before stepping into the room.
            </p>
          </div>

          {/* Live Occupancy Prompt */}
          <div className="p-4 rounded-2xl bg-[#0f172a]/90 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Room Presence
                </span>
              </div>
              <button
                onClick={fetchLobby}
                title="Refresh occupancy"
                className="text-slate-500 hover:text-slate-300 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingLobby ? (
              <div className="text-xs text-slate-500 flex items-center space-x-2 py-2">
                <div className="w-2 h-2 rounded-full bg-slate-500 animate-ping" />
                <span>Checking room occupancy...</span>
              </div>
            ) : roomInfo && roomInfo.activeParticipants.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center space-x-2 text-xs text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {roomInfo.activeParticipants.length === 1
                      ? `1 person is in this call:`
                      : `${roomInfo.activeParticipants.length} people are in this call:`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {roomInfo.activeParticipants.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center space-x-1.5 bg-[#182337] border border-slate-700/80 rounded-full px-2.5 py-1 text-xs text-slate-200"
                    >
                      <img
                        src={
                          p.avatarUrl ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                            p.name,
                          )}`
                        }
                        alt={p.name}
                        className="w-4 h-4 rounded-full bg-slate-800"
                      />
                      <span className="font-medium text-slate-200">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5 py-2 text-slate-400 text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                <span>No one else is here yet. You'll be the first to join!</span>
              </div>
            )}
          </div>

          {/* Host Passcode Controls (Only visible to Room Host) */}
          {roomInfo?.isHost && (
            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Host Passcode Controls
                  </span>
                </div>
                {roomInfo.passcode && (
                  <button
                    onClick={copyPasscodeToClipboard}
                    className="flex items-center space-x-1 text-[11px] text-amber-400 hover:text-amber-200 font-semibold"
                  >
                    {copiedPasscode ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-xs text-amber-300/80">
                You control the meeting passcode that participants must enter to join.
              </p>

              <form onSubmit={handleHostSavePasscode} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Set meeting passcode (or leave blank)"
                  value={hostNewPasscode}
                  onChange={(e) => setHostNewPasscode(e.target.value)}
                  className="flex-1 bg-black/40 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-100 placeholder:text-amber-400/40 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={isUpdatingPasscode}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl text-xs transition disabled:opacity-50"
                >
                  {isUpdatingPasscode ? 'Saving...' : 'Save'}
                </button>
              </form>

              {hostPasscodeSuccess && (
                <p className="text-xs text-emerald-400 font-medium">{hostPasscodeSuccess}</p>
              )}
            </div>
          )}

          {/* Join Meeting Action Button */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleJoinClick}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-blue-600/30 transition flex items-center justify-center space-x-2 group"
            >
              <span>{roomInfo?.isHost ? 'Join Meeting as Host' : 'Join Meeting'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition duration-150" />
            </button>

            {roomInfo?.hasPasscode && !roomInfo.isHost && (
              <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Protected call · Requires passcode set by host</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        Study Partner · Private Collaborative Audio & Video Workspace
      </footer>

      {/* Passcode Verification Modal */}
      {isPasscodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Enter Meeting Passcode</h3>
                <p className="text-xs text-slate-400">Host has locked this call with a passcode</p>
              </div>
            </div>

            {passcodeError && (
              <div className="mb-4 p-3 rounded-2xl text-xs flex items-start space-x-2.5 bg-amber-950/40 border border-amber-500/40 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{passcodeError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Meeting Passcode
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    autoFocus
                    required
                    placeholder="Enter passcode from host..."
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    className="w-full bg-[#182337] border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
                  >
                    {showPasscode ? <Lock className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
                  </button>
                </div>
                {consecutiveFailures > 0 && (
                  <p className="text-[11px] text-amber-400 mt-1.5 flex items-center space-x-1">
                    <span>Passcode incorrect. Please check with host and try again.</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasscodeModalOpen(false);
                    setPasscodeError(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !passcodeInput.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 'Unlock & Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
