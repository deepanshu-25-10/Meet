import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ChatToast,
  MeetingNotification,
  Message,
  Participant,
  RemoteControlRequest,
  RemoteInputEvent,
  Room,
} from '../types';
import { useAuth } from './AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import { api } from '../services/api';
import { audioAlerts } from '../utils/audioAlerts';

interface DeviceItem {
  deviceId: string;
  label: string;
}

interface RemoteCursorState {
  x: number; // 0..1
  y: number; // 0..1
  controllerName: string;
  isClicking: boolean;
  lastKey?: string;
}

interface MeetingContextType {
  room: Room | null;
  isLoadingRoom: boolean;
  isInCall: boolean;
  participants: Participant[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Media toggles
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;

  // Devices
  audioInputs: DeviceItem[];
  videoInputs: DeviceItem[];
  audioOutputs: DeviceItem[];
  selectedAudioInput: string;
  selectedVideoInput: string;
  selectedAudioOutput: string;
  selectAudioInput: (deviceId: string) => Promise<void>;
  selectVideoInput: (deviceId: string) => Promise<void>;
  selectAudioOutput: (deviceId: string) => Promise<void>;

  // Call actions
  joinMeeting: (
    slug: string,
    passcode?: string,
    options?: {
      isMuted?: boolean;
      isCameraOff?: boolean;
      audioDeviceId?: string;
      videoDeviceId?: string;
    },
  ) => Promise<void>;
  leaveMeeting: () => void;

  // Chat
  messages: Message[];
  unreadMessagesCount: number;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  typingUsers: string[];
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  sendMessage: (content: string, attachmentIds?: string[]) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  togglePin: (messageId: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  clearChat: () => Promise<void>;

  // Remote Desktop Control
  remoteControlState: 'idle' | 'requesting' | 'controlling' | 'controlled';
  incomingRemoteRequest: RemoteControlRequest | null;
  activeControllerName: string | null;
  remoteCursor: RemoteCursorState | null;
  requestRemoteControl: (presenterSocketId: string) => void;
  respondRemoteRequest: (approved: boolean) => void;
  revokeRemoteControl: () => void;
  releaseRemoteControl: () => void;
  sendRemoteInput: (event: RemoteInputEvent) => void;

  // Presenter detection
  activePresenter: Participant | null;
  activePresenters: Participant[];
  activeSpeaker: Participant | null;

  // Hand Raise
  isHandRaised: boolean;
  toggleHandRaise: () => void;

  // Presentation Audio Toggle (Presenter)
  isPresentationAudioEnabled: boolean;
  togglePresentationAudio: () => void;

  // Presentation Silence (Viewers)
  isPresentationSilencedLocally: boolean;
  toggleSilencePresentation: (targetPresenterSocketId?: string) => void;

  // Remote Media Control (Anyone can toggle anyone's mic & camera)
  remoteToggleParticipantMic: (targetSocketId: string, currentMuted: boolean) => void;
  remoteToggleParticipantCamera: (targetSocketId: string, currentCameraOff: boolean) => void;

  // Picture in Picture mode
  isPipActive: boolean;
  togglePip: (targetVideoEl?: HTMLVideoElement | null) => Promise<void>;

  // Meeting Notifications
  notifications: MeetingNotification[];
  dismissNotification: (id: string) => void;

  // Real-time Chat Pop-up Toasts
  chatToasts: ChatToast[];
  dismissChatToast: (id: string) => void;

  // Side Panel
  activeSidePanelTab: 'chat' | 'people' | 'info' | null;
  setActiveSidePanelTab: (tab: 'chat' | 'people' | 'info' | null) => void;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.openrelay.metered.ca:80' },
];

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState<boolean>(false);
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Local media tracks
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Devices
  const [audioInputs, setAudioInputs] = useState<DeviceItem[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceItem[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceItem[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');

  // Side Panel & Chat
  const [activeSidePanelTab, setActiveSidePanelTab] = useState<'chat' | 'people' | 'info' | null>(null);
  const isChatOpen = activeSidePanelTab === 'chat';
  const setIsChatOpen = (open: boolean) => {
    setActiveSidePanelTab(open ? 'chat' : null);
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Remote Control
  const [remoteControlState, setRemoteControlState] = useState<'idle' | 'requesting' | 'controlling' | 'controlled'>('idle');
  const [incomingRemoteRequest, setIncomingRemoteRequest] = useState<RemoteControlRequest | null>(null);
  const [activeControllerName, setActiveControllerName] = useState<string | null>(null);
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursorState | null>(null);
  const controlledPresenterSocketIdRef = useRef<string | null>(null);

  // Hand Raise & Audio Presentation & PiP & Notifications
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [isPresentationAudioEnabled, setIsPresentationAudioEnabled] = useState<boolean>(true);
  const [isPresentationSilencedLocally, setIsPresentationSilencedLocally] = useState<boolean>(false);
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<MeetingNotification[]>([]);
  const [chatToasts, setChatToasts] = useState<ChatToast[]>([]);

  const dismissChatToast = useCallback((id: string) => {
    setChatToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback((notif: Omit<MeetingNotification, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newNotif: MeetingNotification = {
      ...notif,
      id,
      timestamp: Date.now(),
    };
    setNotifications((prev) => [...prev.slice(-4), newNotif]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Peer Connections: socketId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Enumerate Audio/Video Devices
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const aInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      const vInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      const aOutputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }));

      setAudioInputs(aInputs);
      setVideoInputs(vInputs);
      setAudioOutputs(aOutputs);

      if (aInputs.length && !selectedAudioInput) setSelectedAudioInput(aInputs[0].deviceId);
      if (vInputs.length && !selectedVideoInput) setSelectedVideoInput(vInputs[0].deviceId);
      if (aOutputs.length && !selectedAudioOutput) setSelectedAudioOutput(aOutputs[0].deviceId);
    } catch (err) {
      console.warn('Could not enumerate media devices:', err);
    }
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  // Audio Level & Active Speaker Monitoring
  const startAudioMonitoring = useCallback((stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speakingFrames = 0;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isCurrentlySpeaking = avg > 15;

        if (isCurrentlySpeaking) {
          speakingFrames++;
          if (speakingFrames > 3) {
            setIsSpeaking(true);
            const socket = getSocket();
            if (socket.connected) {
              socket.emit('call:state-update', { isSpeaking: true });
            }
          }
        } else {
          speakingFrames = 0;
          setIsSpeaking(false);
          const socket = getSocket();
          if (socket.connected) {
            socket.emit('call:state-update', { isSpeaking: false });
          }
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      animFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn('Web Audio API not supported or error:', e);
    }
  }, []);

  const stopAudioMonitoring = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Peer Connection Helper
  const createPeerConnection = useCallback((targetSocketId: string) => {
    if (peerConnections.current.has(targetSocketId)) {
      return peerConnections.current.get(targetSocketId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });
    peerConnections.current.set(targetSocketId, pc);

    // Add local media tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Add screen tracks if already sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStreamRef.current!);
      });
    }

    // Pre-negotiate audio and video transceivers with sendrecv
    // so SDP always has m=audio and m=video sections and can receive remote video immediately
    const transceivers = pc.getTransceivers();
    if (!transceivers.some((t) => t.receiver.track.kind === 'audio')) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
    if (!transceivers.some((t) => t.receiver.track.kind === 'video')) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit('webrtc:ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.socketId === targetSocketId) {
            // Screen stream detection:
            // 1. Matches explicit screenTrackId or screenStreamId
            // 2. Matches already known screenStream ID
            // 3. Or participant is screen sharing and incoming stream ID differs from mic/cam stream
            // 4. Or participant is screen sharing and incoming track is video and has no screen video yet
            // 5. Or participant already has camera video, so a second video track is unequivocally the screen track
            const isScreen =
              Boolean(p.screenTrackId && event.track.id === p.screenTrackId) ||
              Boolean(p.screenStreamId && incomingStream.id === p.screenStreamId) ||
              Boolean(p.screenStream && incomingStream.id === p.screenStream.id) ||
              Boolean(p.isScreenSharing && p.stream && incomingStream.id !== p.stream.id) ||
              Boolean(p.isScreenSharing && event.track.kind === 'video' && (!p.screenStream || !p.screenStream.getVideoTracks().length)) ||
              Boolean(event.track.kind === 'video' && p.stream && p.stream.getVideoTracks().length > 0 && p.stream.getVideoTracks()[0].id !== event.track.id);

            if (isScreen) {
              const prevTracks = p.screenStream ? p.screenStream.getTracks() : [];
              const isVideo = event.track.kind === 'video';
              const filtered = prevTracks.filter((t) => (isVideo ? t.kind !== 'video' : t.id !== event.track.id));
              const updatedScreenStream = new MediaStream([...filtered, event.track]);
              return {
                ...p,
                isScreenSharing: true,
                screenStream: updatedScreenStream,
              };
            }

            const isCameraVideo = event.track.kind === 'video';
            const isAudio = event.track.kind === 'audio';

            // Filter out older/ended video tracks or older audio tracks to ensure index 0 is live
            const otherTracks = p.stream
              ? p.stream.getTracks().filter((t) => {
                  if (isCameraVideo) return t.kind !== 'video';
                  if (isAudio) return t.kind !== 'audio';
                  return t.id !== event.track.id;
                })
              : [];
            const mergedStream = new MediaStream([...otherTracks, event.track]);

            if (isCameraVideo) {
              event.track.onunmute = () => {
                setParticipants((curr) =>
                  curr.map((item) =>
                    item.socketId === targetSocketId ? { ...item, isCameraOff: false } : item,
                  ),
                );
              };
            }

            return {
              ...p,
              stream: mergedStream,
              isCameraOff: isCameraVideo ? false : p.isCameraOff,
            };
          }
          return p;
        }),
      );
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      let quality: 'excellent' | 'good' | 'poor' = 'good';
      if (state === 'connected') quality = 'excellent';
      else if (state === 'connecting') quality = 'good';
      else quality = 'poor';

      setParticipants((prev) =>
        prev.map((p) => (p.socketId === targetSocketId ? { ...p, connectionQuality: quality } : p)),
      );
    };

    return pc;
  }, []);

  // Initialize Local Media Stream with Hardware Echo Cancellation and Noise Suppression
  const initLocalMedia = useCallback(async (audioDevId?: string, videoDevId?: string) => {
    let audioStream: MediaStream | null = null;
    let videoStream: MediaStream | null = null;

    // 1. Acquire Microphone independently
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(audioDevId ? { deviceId: { exact: audioDevId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (audioErr) {
      console.warn('Microphone with constraints failed, trying basic audio:', audioErr);
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (fallbackErr) {
        console.warn('Microphone completely denied or unavailable:', fallbackErr);
      }
    }

    // 2. Acquire Camera independently
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: videoDevId
          ? { deviceId: { exact: videoDevId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (videoErr) {
      console.warn('Camera with constraints failed, trying basic video:', videoErr);
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (fallbackErr) {
        console.warn('Camera completely denied or unavailable:', fallbackErr);
      }
    }

    const combinedTracks: MediaStreamTrack[] = [];
    if (audioStream) {
      combinedTracks.push(...audioStream.getAudioTracks());
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }

    if (videoStream) {
      combinedTracks.push(...videoStream.getVideoTracks());
      setIsCameraOff(false);
    } else {
      setIsCameraOff(true);
    }

    const stream = new MediaStream(combinedTracks);
    setLocalStream(stream);
    localStreamRef.current = stream;

    if (audioStream) {
      startAudioMonitoring(stream);
    }

    return stream;
  }, [startAudioMonitoring]);

  // Select Devices
  const selectAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (localStreamRef.current) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const newTrack = newStream.getAudioTracks()[0];
        const oldTrack = localStreamRef.current.getAudioTracks()[0];

        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);

        // Replace track on all peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
          if (sender) sender.replaceTrack(newTrack);
        });

        startAudioMonitoring(localStreamRef.current);
      } catch (e) {
        console.error('Failed to switch audio input:', e);
      }
    }
  };

  const selectVideoInput = async (deviceId: string) => {
    setSelectedVideoInput(deviceId);
    // Only query hardware if camera is currently enabled to avoid opening camera when off
    if (localStreamRef.current && !isCameraOff) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = newStream.getVideoTracks()[0];
        const oldTracks = localStreamRef.current.getVideoTracks();

        oldTracks.forEach((track) => {
          localStreamRef.current?.removeTrack(track);
          track.stop();
        });
        localStreamRef.current.addTrack(newTrack);

        const updatedStream = new MediaStream(localStreamRef.current.getTracks());
        localStreamRef.current = updatedStream;
        setLocalStream(updatedStream);

        // Replace track on all peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(newTrack);
        });
      } catch (e) {
        console.error('Failed to switch video input:', e);
      }
    }
  };

  const selectAudioOutput = async (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
    // Find all audio elements and setSinkId if supported
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach((el: any) => {
      if (typeof el.setSinkId === 'function') {
        el.setSinkId(deviceId).catch(console.warn);
      }
    });
  };

  // Toggle Mic
  const toggleMic = async () => {
    let audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const nextMuted = !isMuted;

    // If unmuting and no active audio track exists, re-acquire from getUserMedia
    if (!nextMuted && (!audioTrack || audioTrack.readyState === 'ended')) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioInput
            ? { deviceId: { exact: selectedAudioInput }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const newTrack = stream.getAudioTracks()[0];
        if (newTrack) {
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }
          if (audioTrack) localStreamRef.current.removeTrack(audioTrack);
          localStreamRef.current.addTrack(newTrack);
          const updated = new MediaStream(localStreamRef.current.getTracks());
          localStreamRef.current = updated;
          setLocalStream(updated);
          startAudioMonitoring(updated);

          peerConnections.current.forEach(async (pc, targetSocketId) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
            const transceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
            if (sender) {
              sender.replaceTrack(newTrack).catch(() => {});
            } else if (transceiver && transceiver.sender) {
              transceiver.sender.replaceTrack(newTrack).catch(() => {});
            } else {
              pc.addTrack(newTrack, updated);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const socket = getSocket();
                if (socket.connected) {
                  socket.emit('webrtc:offer', { targetSocketId, offer });
                }
              } catch (e) {
                console.warn('Renegotiation failed on mic enable:', e);
              }
            }
          });
          audioTrack = newTrack;
        }
      } catch (err) {
        console.warn('Could not re-acquire audio track on unmute:', err);
        return;
      }
    }

    if (audioTrack) {
      audioTrack.enabled = !nextMuted;
    }

    setIsMuted(nextMuted);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('call:state-update', { isMuted: nextMuted });
    }
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (!localStreamRef.current) return;
    let videoTrack = localStreamRef.current.getVideoTracks()[0];
    const nextOff = !isCameraOff;

    if (!nextOff && (!videoTrack || videoTrack.readyState === 'ended')) {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: selectedVideoInput
              ? { deviceId: { exact: selectedVideoInput }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        const newTrack = stream.getVideoTracks()[0];
        if (newTrack) {
          if (videoTrack) localStreamRef.current.removeTrack(videoTrack);
          localStreamRef.current.addTrack(newTrack);
          const updatedStream = new MediaStream(localStreamRef.current.getTracks());
          localStreamRef.current = updatedStream;
          setLocalStream(updatedStream);

          peerConnections.current.forEach(async (pc, targetSocketId) => {
            const screenVideoTrack = screenStreamRef.current?.getVideoTracks()[0];
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video' && s.track !== screenVideoTrack);
            const videoTransceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');

            if (sender) {
              sender.replaceTrack(newTrack).catch(() => {});
            } else if (videoTransceiver && videoTransceiver.sender) {
              videoTransceiver.sender.replaceTrack(newTrack).catch(() => {});
            } else {
              pc.addTrack(newTrack, updatedStream);
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                const socket = getSocket();
                if (socket.connected) {
                  socket.emit('webrtc:offer', {
                    targetSocketId,
                    offer,
                  });
                }
              } catch (e) {
                console.warn('Renegotiation failed on camera enable:', e);
              }
            }
          });
          videoTrack = newTrack;
        }
      } catch (err) {
        console.warn('Could not acquire video track:', err);
        return;
      }
    }

    if (videoTrack) {
      videoTrack.enabled = !nextOff;
      if (!nextOff) {
        // Force keyframe refresh on peer connection senders to immediately wake up remote decoders
        peerConnections.current.forEach((pc) => {
          const screenVideoTrack = screenStreamRef.current?.getVideoTracks()[0];
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video' && s.track !== screenVideoTrack);
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack).catch(() => {});
          }
        });
      }
    }

    setIsCameraOff(nextOff);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('call:state-update', { isCameraOff: nextOff });
    }
  };

  // Start Screen Share
  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: true,
      });

      setScreenStream(displayStream);
      screenStreamRef.current = displayStream;
      setIsScreenSharing(true);

      const screenTrack = displayStream.getVideoTracks()[0];
      const screenAudioTracks = displayStream.getAudioTracks();
      const hasAudio = screenAudioTracks.length > 0;
      setIsPresentationAudioEnabled(hasAudio);

      // Update room presence FIRST with stream ID and track ID so remote peers know it's a screen share
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('call:state-update', {
          isScreenSharing: true,
          screenStreamId: displayStream.id,
          screenTrackId: screenTrack.id,
        });
      }

      // Add track to all peers and renegotiate offer so remote peers receive ontrack
      peerConnections.current.forEach(async (pc, targetSocketId) => {
        pc.addTrack(screenTrack, displayStream);
        if (hasAudio) {
          pc.addTrack(screenAudioTracks[0], displayStream);
        }
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socket.connected) {
            socket.emit('webrtc:offer', {
              targetSocketId,
              offer,
            });
          }
        } catch (e) {
          console.warn('Renegotiation failed on screen share:', e);
        }
      });

      // Handle user clicking "Stop Sharing" in browser chrome
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn('Screen share cancelled or failed:', err);
    }
  };

  // Toggle Presentation Audio (Presenter)
  const togglePresentationAudio = () => {
    if (!screenStreamRef.current) return;
    const audioTracks = screenStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const nextEnabled = !isPresentationAudioEnabled;
      audioTracks.forEach((t) => (t.enabled = nextEnabled));
      setIsPresentationAudioEnabled(nextEnabled);

      const socket = getSocket();
      if (socket.connected) {
        socket.emit('call:presentation-audio-toggle', { isAudioEnabled: nextEnabled });
      }

      addNotification({
        message: nextEnabled ? 'Presentation audio sharing turned ON' : 'Presentation audio sharing turned OFF',
        type: 'media',
      });
    } else {
      addNotification({
        message: 'No system/tab audio captured. When presenting, ensure "Share audio" is checked in browser screen picker.',
        type: 'warning',
      });
    }
  };

  // Silence Presentation (Viewers)
  const toggleSilencePresentation = (targetPresenterSocketId?: string) => {
    const next = !isPresentationSilencedLocally;
    setIsPresentationSilencedLocally(next);
    const targetSocketId = targetPresenterSocketId || (activePresenter ? activePresenter.socketId : undefined);
    if (targetSocketId) {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('call:silence-presentation', {
          presenterSocketId: targetSocketId,
          isSilenced: next,
        });
      }
    }
    addNotification({
      message: next ? 'You silenced presentation audio' : 'You un-silenced presentation audio',
      type: 'media',
    });
  };

  // Hand Raise Toggle
  const toggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('call:raise-hand', { isRaised: next });
    }
    if (next) {
      audioAlerts.playHandRaiseDingDong();
    }
    addNotification({
      message: next ? 'You raised your hand ✋' : 'You lowered your hand',
      type: 'hand',
    });
  };

  // Remote Toggle of Anyone's Mic and Camera
  const remoteToggleParticipantMic = (targetSocketId: string, currentMuted: boolean) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('call:remote-toggle-media', {
        targetSocketId,
        mediaType: 'mic',
        enabled: currentMuted,
      });
    }
  };

  const remoteToggleParticipantCamera = (targetSocketId: string, currentCameraOff: boolean) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('call:remote-toggle-media', {
        targetSocketId,
        mediaType: 'camera',
        enabled: currentCameraOff,
      });
    }
  };

  // Picture in Picture
  const togglePip = async (targetVideoEl?: HTMLVideoElement | null) => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else {
        const video = targetVideoEl || (document.querySelector('video') as HTMLVideoElement);
        if (video && document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
          setIsPipActive(true);
        } else {
          addNotification({
            message: 'Picture-in-Picture is not supported in this browser or no active video tile found.',
            type: 'warning',
          });
        }
      }
    } catch (err: any) {
      console.warn('PiP error:', err);
    }
  };

  // Stop Screen Share
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      const tracks = screenStreamRef.current.getTracks();
      peerConnections.current.forEach(async (pc, targetSocketId) => {
        const senders = pc.getSenders().filter((s) => s.track && tracks.includes(s.track));
        senders.forEach((s) => {
          try { pc.removeTrack(s); } catch (e) {}
        });
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const socket = getSocket();
          if (socket.connected) {
            socket.emit('webrtc:offer', { targetSocketId, offer });
          }
        } catch (e) {}
      });

      tracks.forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // If currently presenting and remote control was active, revoke it
    if (remoteControlState === 'controlled') {
      revokeRemoteControl();
    }

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('call:state-update', { isScreenSharing: false, screenStreamId: null });
    }
  };

  // Join Meeting Session
  const joinMeeting = async (
    slug: string,
    passcode?: string,
    options?: {
      isMuted?: boolean;
      isCameraOff?: boolean;
      audioDeviceId?: string;
      videoDeviceId?: string;
    },
  ) => {
    if (!user) return;
    setIsLoadingRoom(true);

    try {
      // 1. Fetch Room from DB & verify/join
      const roomData = await api.joinRoom(slug, passcode);
      setRoom(roomData);

      // 2. Load persistent chat history from DB
      const chatRes = await api.getMessages(roomData.id, { limit: 100 });
      setMessages(chatRes.messages);

      // 3. Initialize local media
      const targetAudioDev = options?.audioDeviceId || selectedAudioInput;
      const targetVideoDev = options?.videoDeviceId || selectedVideoInput;
      const mediaStream = await initLocalMedia(targetAudioDev, targetVideoDev);
      const hasAudio = mediaStream.getAudioTracks().length > 0;
      const hasVideo = mediaStream.getVideoTracks().length > 0;

      const shouldMute = options?.isMuted !== undefined ? options.isMuted : !hasAudio;
      const shouldCameraOff = options?.isCameraOff !== undefined ? options.isCameraOff : !hasVideo;

      if (shouldMute) {
        mediaStream.getAudioTracks().forEach((t) => (t.enabled = false));
        setIsMuted(true);
      } else {
        setIsMuted(false);
      }

      if (shouldCameraOff) {
        mediaStream.getVideoTracks().forEach((t) => (t.enabled = false));
        setIsCameraOff(true);
      } else {
        setIsCameraOff(false);
      }

      // 4. Connect Socket.IO
      const socket = connectSocket();

      // Emit room:join with actual acquired media state
      socket.emit('room:join', {
        roomId: roomData.id,
        userId: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isMuted: shouldMute,
        isCameraOff: shouldCameraOff,
      });

      setIsInCall(true);
      audioAlerts.playConnectChime();
    } catch (err) {
      console.error('Failed to join meeting room:', err);
      throw err;
    } finally {
      setIsLoadingRoom(false);
    }
  };

  // Leave Meeting
  const leaveMeeting = () => {
    audioAlerts.playDisconnectChime();
    stopScreenShare();
    stopAudioMonitoring();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingIceCandidates.current.clear();

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('room:leave');
    }

    setParticipants([]);
    setIsInCall(false);
    setRemoteControlState('idle');
    setIncomingRemoteRequest(null);
    setActiveControllerName(null);
    setRemoteCursor(null);
  };

  // Socket.IO Events Registration
  useEffect(() => {
    const socket = getSocket();

    const handleRoomJoined = async (data: { self: any; existingParticipants: any[] }) => {
      // Create peer connections and offers for existing participants
      const remoteParts: Participant[] = data.existingParticipants.map((p) => ({
        ...p,
        connectionQuality: 'good',
      }));
      setParticipants(remoteParts);

      // Connect to each existing peer
      for (const p of data.existingParticipants) {
        const pc = createPeerConnection(p.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', {
          targetSocketId: p.socketId,
          offer,
        });
      }
    };

    const handleParticipantJoined = (data: { participant: any }) => {
      audioAlerts.playConnectChime();
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === data.participant.socketId)) return prev;
        return [...prev, { ...data.participant, connectionQuality: 'good' }];
      });
      addNotification({
        message: `${data.participant.name} joined the meeting`,
        type: 'info',
      });
    };

    const handleParticipantLeft = (data: { socketId: string }) => {
      audioAlerts.playDisconnectChime();
      // Close peer connection
      const pc = peerConnections.current.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(data.socketId);
      }
      pendingIceCandidates.current.delete(data.socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));

      if (incomingRemoteRequest?.requesterSocketId === data.socketId) {
        setIncomingRemoteRequest(null);
      }
      if (controlledPresenterSocketIdRef.current === data.socketId) {
        controlledPresenterSocketIdRef.current = null;
        setRemoteControlState('idle');
      }
    };

    const handleStateUpdated = (data: any) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.socketId === data.socketId) {
            const updated = { ...p, ...data };
            if (data.isScreenSharing === false) {
              updated.screenStream = undefined;
            } else if (data.isScreenSharing === true && !updated.screenStream && updated.stream) {
              // Rescue screen track if it was routed to main stream before state update arrived
              const videoTracks = updated.stream.getVideoTracks();
              if (videoTracks.length > 0) {
                const screenTrack =
                  (data.screenTrackId && videoTracks.find((t: any) => t.id === data.screenTrackId)) ||
                  (videoTracks.length > 1 ? videoTracks[videoTracks.length - 1] : null);
                if (screenTrack) {
                  updated.screenStream = new MediaStream([screenTrack]);
                }
              }
            }
            return updated;
          }
          return p;
        }),
      );
    };

    const flushPendingIceCandidates = async (socketId: string, pc: RTCPeerConnection) => {
      const candidates = pendingIceCandidates.current.get(socketId);
      if (candidates && candidates.length > 0) {
        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error adding queued ice candidate:', e);
          }
        }
        pendingIceCandidates.current.delete(socketId);
      }
    };

    // Media Signaling Handlers
    const handleWebRtcOffer = async (data: { callerSocketId: string; callerInfo: any; offer: any }) => {
      try {
        const pc = createPeerConnection(data.callerSocketId);
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushPendingIceCandidates(data.callerSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          targetSocketId: data.callerSocketId,
          answer,
        });
      } catch (err) {
        console.error('Error handling media offer:', err);
      }
    };

    const handleWebRtcAnswer = async (data: { responderSocketId: string; answer: any }) => {
      try {
        const pc = peerConnections.current.get(data.responderSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushPendingIceCandidates(data.responderSocketId, pc);
        }
      } catch (err) {
        console.error('Error handling media answer:', err);
      }
    };

    const handleWebRtcIceCandidate = async (data: { senderSocketId: string; candidate: any }) => {
      if (!data.candidate) return;
      const pc = peerConnections.current.get(data.senderSocketId);
      if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        const queued = pendingIceCandidates.current.get(data.senderSocketId) || [];
        queued.push(data.candidate);
        pendingIceCandidates.current.set(data.senderSocketId, queued);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('Error adding received ice candidate:', e);
      }
    };

    // Chat Events
    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      const isCritical = msg.content?.includes('🚨 CRITICAL SECURITY ALERT');

      if (isCritical) {
        audioAlerts.playCriticalSiren();
        setIsChatOpen(true); // Automatically open chat for security alerts
      } else if (msg.senderId !== user?.id) {
        // Play message pop chime
        audioAlerts.playMessagePop();
      }

      if (msg.senderId !== user?.id || isCritical) {
        if (!isChatOpen || isCritical) {
          if (!isChatOpen) {
            setUnreadMessagesCount((prev) => prev + 1);
          }

          const toastId = `${Date.now()}-${Math.random()}`;
          const newToast: ChatToast = {
            id: toastId,
            senderName: isCritical ? '🚨 CRITICAL ALERT' : (msg.sender?.name || 'Participant'),
            senderAvatar: msg.sender?.avatarUrl,
            content: msg.content,
            timestamp: Date.now(),
          };
          setChatToasts((prev) => [...prev.slice(-3), newToast]);
          setTimeout(() => {
            setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, isCritical ? 10000 : 6000);
        }
      }
    };

    const handleCriticalAlert = (data: any) => {
      audioAlerts.playCriticalSiren();
      setIsChatOpen(true);
    };

    const handleUserTyping = (data: { name: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        if (data.isTyping) {
          if (!prev.includes(data.name)) return [...prev, data.name];
          return prev;
        } else {
          return prev.filter((n) => n !== data.name);
        }
      });
    };

    const handleReactionUpdated = (data: any) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== data.messageId && m.id !== data.reaction?.messageId) return m;
          if (data.action === 'removed') {
            return {
              ...m,
              reactions: m.reactions.filter(
                (r) => !(r.userId === data.userId && r.emoji === data.emoji),
              ),
            };
          } else if (data.action === 'added') {
            return {
              ...m,
              reactions: [...m.reactions.filter((r) => r.id !== data.reaction.id), data.reaction],
            };
          }
          return m;
        }),
      );
    };

    const handleMessageEdited = (editedMsg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === editedMsg.id ? editedMsg : m)));
    };

    const handleMessageDeleted = (deletedMsg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === deletedMsg.id ? deletedMsg : m)));
    };

    const handleMessagePinned = (pinnedMsg: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === pinnedMsg.id ? pinnedMsg : m)));
    };

    const handleChatCleared = (data: { roomId: string; clearedBy: string }) => {
      setMessages([]);
      setUnreadMessagesCount(0);
      addNotification({
        message: `Chat history was wiped clean by ${data.clearedBy}`,
        type: 'info',
      });
    };

    // Remote Desktop Control Events
    const handleIncomingRemoteRequest = (req: RemoteControlRequest) => {
      setIncomingRemoteRequest(req);
      audioAlerts.playMessagePop();
    };

    const handleRemoteGranted = (data: { presenterSocketId: string; presenterName: string }) => {
      controlledPresenterSocketIdRef.current = data.presenterSocketId;
      setRemoteControlState('controlling');
      addNotification({
        message: `Remote control granted by ${data.presenterName}! Click and type to interact.`,
        type: 'info',
      });
    };

    const handleRemoteDenied = () => {
      controlledPresenterSocketIdRef.current = null;
      setRemoteControlState('idle');
      addNotification({
        message: 'The presenter declined your remote desktop control request.',
        type: 'warning',
      });
    };

    const handleRemoteRevoked = (data: { reason?: string }) => {
      setRemoteControlState('idle');
      controlledPresenterSocketIdRef.current = null;
      addNotification({
        message: `Remote control ended: ${data?.reason || 'Control revoked'}`,
        type: 'warning',
      });
    };

    const handleRemoteReleased = (data: { reason?: string }) => {
      setRemoteControlState('idle');
      setActiveControllerName(null);
      setRemoteCursor(null);
      addNotification({
        message: data?.reason || 'Remote participant released control',
        type: 'info',
      });
    };

    const handleForwardedInput = (data: { controllerName: string; event: RemoteInputEvent }) => {
      const { controllerName, event } = data;
      setRemoteCursor((prev) => {
        const x = event.x !== undefined ? event.x : (prev?.x ?? 0.5);
        const y = event.y !== undefined ? event.y : (prev?.y ?? 0.5);
        return {
          x,
          y,
          controllerName,
          isClicking: event.type === 'mousedown' || event.type === 'click',
          lastKey: event.key || (event.type === 'keydown' ? prev?.lastKey : undefined),
        };
      });

      if (event.type === 'mouseup' || event.type === 'click') {
        setTimeout(() => {
          setRemoteCursor((prev) => (prev ? { ...prev, isClicking: false } : null));
        }, 300);
      }
      if (event.type === 'keydown') {
        setTimeout(() => {
          setRemoteCursor((prev) => (prev ? { ...prev, lastKey: undefined } : null));
        }, 1500);
      }
    };

    const handleRemoteStatusChanged = (data: {
      presenterSocketId: string;
      controllerName?: string;
      isActive: boolean;
    }) => {
      if (data.isActive) {
        if (socket.id === data.presenterSocketId) {
          setRemoteControlState('controlled');
          setActiveControllerName(data.controllerName || 'Remote Participant');
        }
      } else {
        if (socket.id === data.presenterSocketId) {
          setRemoteControlState('idle');
          setActiveControllerName(null);
          setRemoteCursor(null);
        }
      }
    };

    // Hand Raise Event Handler
    const handleHandRaiseUpdated = (data: {
      socketId: string;
      userId: string;
      name: string;
      isRaised: boolean;
    }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === data.socketId ? { ...p, isHandRaised: data.isRaised } : p,
        ),
      );

      if (data.isRaised && data.socketId !== socket.id) {
        audioAlerts.playHandRaiseDingDong();
      }

      if (data.socketId !== socket.id) {
        addNotification({
          message: `${data.name} ${data.isRaised ? 'raised their hand ✋' : 'lowered their hand'}`,
          type: 'hand',
        });
      }
    };

    // Force Media State (Anyone can turn on or off anyone's mic and camera)
    const handleForceMediaState = (data: {
      mediaType: 'mic' | 'camera';
      enabled: boolean;
      triggeredByName: string;
    }) => {
      if (data.mediaType === 'mic') {
        let audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (data.enabled && (!audioTrack || audioTrack.readyState === 'ended')) {
          navigator.mediaDevices
            .getUserMedia({
              audio: selectedAudioInput
                ? { deviceId: { exact: selectedAudioInput }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            })
            .then((stream) => {
              const newTrack = stream.getAudioTracks()[0];
              if (newTrack && localStreamRef.current) {
                if (audioTrack) localStreamRef.current.removeTrack(audioTrack);
                localStreamRef.current.addTrack(newTrack);
                const updated = new MediaStream(localStreamRef.current.getTracks());
                localStreamRef.current = updated;
                setLocalStream(updated);
                startAudioMonitoring(updated);

                peerConnections.current.forEach(async (pc, targetSocketId) => {
                  const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
                  const transceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
                  if (sender) {
                    sender.replaceTrack(newTrack).catch(() => {});
                  } else if (transceiver && transceiver.sender) {
                    transceiver.sender.replaceTrack(newTrack).catch(() => {});
                  } else {
                    pc.addTrack(newTrack, updated);
                    try {
                      const offer = await pc.createOffer();
                      await pc.setLocalDescription(offer);
                      if (socket.connected) {
                        socket.emit('webrtc:offer', { targetSocketId, offer });
                      }
                    } catch (e) {}
                  }
                });
              }
            })
            .catch(console.warn);
        } else if (audioTrack) {
          audioTrack.enabled = data.enabled;
        }
        setIsMuted(!data.enabled);
        socket.emit('call:state-update', { isMuted: !data.enabled });
        addNotification({
          message: `${data.triggeredByName} turned your microphone ${data.enabled ? 'ON' : 'OFF'}`,
          type: 'media',
        });
      } else if (data.mediaType === 'camera') {
        const nextOff = !data.enabled;
        let videoTrack = localStreamRef.current?.getVideoTracks()[0];

        if (data.enabled && (!videoTrack || videoTrack.readyState === 'ended')) {
          navigator.mediaDevices
            .getUserMedia({
              video: selectedVideoInput
                ? { deviceId: { exact: selectedVideoInput }, width: { ideal: 1280 }, height: { ideal: 720 } }
                : { width: { ideal: 1280 }, height: { ideal: 720 } },
            })
            .then((stream) => {
              const newTrack = stream.getVideoTracks()[0];
              if (newTrack && localStreamRef.current) {
                if (videoTrack) localStreamRef.current.removeTrack(videoTrack);
                localStreamRef.current.addTrack(newTrack);
                const updatedStream = new MediaStream(localStreamRef.current.getTracks());
                localStreamRef.current = updatedStream;
                setLocalStream(updatedStream);

                peerConnections.current.forEach(async (pc, targetSocketId) => {
                  const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
                  const sender = pc.getSenders().find((s) => s.track?.kind === 'video' && s.track !== screenTrack);
                  const videoTransceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');

                  if (sender) {
                    sender.replaceTrack(newTrack).catch(() => {});
                  } else if (videoTransceiver && videoTransceiver.sender) {
                    videoTransceiver.sender.replaceTrack(newTrack).catch(() => {});
                  } else {
                    pc.addTrack(newTrack, updatedStream);
                    try {
                      const offer = await pc.createOffer();
                      await pc.setLocalDescription(offer);
                      if (socket.connected) {
                        socket.emit('webrtc:offer', {
                          targetSocketId,
                          offer,
                        });
                      }
                    } catch (e) {
                      console.warn('Renegotiation failed on remote turn on camera:', e);
                    }
                  }
                });
              }
            })
            .catch((err) => console.warn('Could not re-acquire video track:', err));
        } else if (videoTrack) {
          videoTrack.enabled = data.enabled;
          if (data.enabled) {
            peerConnections.current.forEach((pc) => {
              const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video' && s.track !== screenTrack);
              if (sender && videoTrack) {
                sender.replaceTrack(videoTrack).catch(() => {});
              }
            });
          }
        }

        setIsCameraOff(nextOff);
        socket.emit('call:state-update', { isCameraOff: nextOff });
        addNotification({
          message: `${data.triggeredByName} turned your camera ${data.enabled ? 'ON' : 'OFF'}`,
          type: 'media',
        });
      }
    };

    // Presentation Audio Updates
    const handlePresentationAudioUpdated = (data: {
      presenterSocketId: string;
      isAudioEnabled: boolean;
    }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === data.presenterSocketId
            ? { ...p, presentationAudioEnabled: data.isAudioEnabled }
            : p,
        ),
      );
    };

    const handlePresentationSilenced = (data: {
      presenterSocketId: string;
      isSilenced: boolean;
      triggeredByName: string;
    }) => {
      if (socket.id === data.presenterSocketId) {
        addNotification({
          message: `${data.triggeredByName} ${data.isSilenced ? 'silenced' : 'un-silenced'} your presentation audio`,
          type: 'media',
        });
      }
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('call:participant-joined', handleParticipantJoined);
    socket.on('call:participant-left', handleParticipantLeft);
    socket.on('call:participant-state-updated', handleStateUpdated);

    socket.on('call:hand-raise-updated', handleHandRaiseUpdated);
    socket.on('call:force-media-state', handleForceMediaState);
    socket.on('call:presentation-audio-updated', handlePresentationAudioUpdated);
    socket.on('call:presentation-silenced', handlePresentationSilenced);

    socket.on('webrtc:offer', handleWebRtcOffer);
    socket.on('webrtc:answer', handleWebRtcAnswer);
    socket.on('webrtc:ice-candidate', handleWebRtcIceCandidate);

    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:user_typing', handleUserTyping);
    socket.on('chat:reaction_updated', handleReactionUpdated);
    socket.on('chat:message_edited', handleMessageEdited);
    socket.on('chat:message_deleted', handleMessageDeleted);
    socket.on('chat:message_pinned', handleMessagePinned);
    socket.on('chat:cleared', handleChatCleared);
    socket.on('room:critical-alert', handleCriticalAlert);

    socket.on('remote:incoming-request', handleIncomingRemoteRequest);
    socket.on('remote:granted', handleRemoteGranted);
    socket.on('remote:denied', handleRemoteDenied);
    socket.on('remote:revoked', handleRemoteRevoked);
    socket.on('remote:released', handleRemoteReleased);
    socket.on('remote:forwarded-input', handleForwardedInput);
    socket.on('remote:status-changed', handleRemoteStatusChanged);

    return () => {
      socket.off('room:joined', handleRoomJoined);
      socket.off('call:participant-joined', handleParticipantJoined);
      socket.off('call:participant-left', handleParticipantLeft);
      socket.off('call:participant-state-updated', handleStateUpdated);

      socket.off('call:hand-raise-updated', handleHandRaiseUpdated);
      socket.off('call:force-media-state', handleForceMediaState);
      socket.off('call:presentation-audio-updated', handlePresentationAudioUpdated);
      socket.off('call:presentation-silenced', handlePresentationSilenced);

      socket.off('webrtc:offer', handleWebRtcOffer);
      socket.off('webrtc:answer', handleWebRtcAnswer);
      socket.off('webrtc:ice-candidate', handleWebRtcIceCandidate);

      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:user_typing', handleUserTyping);
      socket.off('chat:reaction_updated', handleReactionUpdated);
      socket.off('chat:message_edited', handleMessageEdited);
      socket.off('chat:message_deleted', handleMessageDeleted);
      socket.off('chat:message_pinned', handleMessagePinned);
      socket.off('chat:cleared', handleChatCleared);
      socket.off('room:critical-alert', handleCriticalAlert);

      socket.off('remote:incoming-request', handleIncomingRemoteRequest);
      socket.off('remote:granted', handleRemoteGranted);
      socket.off('remote:denied', handleRemoteDenied);
      socket.off('remote:revoked', handleRemoteRevoked);
      socket.off('remote:released', handleRemoteReleased);
      socket.off('remote:forwarded-input', handleForwardedInput);
      socket.off('remote:status-changed', handleRemoteStatusChanged);
    };
  }, [createPeerConnection, isChatOpen, incomingRemoteRequest]);

  // Clear unread count when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setUnreadMessagesCount(0);
    }
  }, [isChatOpen]);

  // Chat Actions
  const sendMessage = async (content: string, attachmentIds?: string[]) => {
    if (!room) return;
    const newMsg = await api.sendMessage(room.id, {
      content,
      replyToId: replyingTo?.id,
      attachmentIds,
    });
    setReplyingTo(null);

    // Broadcast over socket
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:send', newMsg);
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!room) return;
    const updated = await api.editMessage(messageId, content);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:message_edited', { roomId: room.id, message: updated });
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!room) return;
    const deleted = await api.deleteMessage(messageId);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:message_deleted', { roomId: room.id, message: deleted });
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!room) return;
    const res = await api.toggleReaction(messageId, emoji);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:reaction_updated', { roomId: room.id, result: res });
    }
  };

  const togglePin = async (messageId: string) => {
    if (!room) return;
    const updated = await api.togglePin(messageId);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:message_pinned', { roomId: room.id, message: updated });
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (!room) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:typing', { roomId: room.id, isTyping });
    }
  };

  const clearChat = async () => {
    if (!room) return;
    await api.clearRoomMessages(room.id);
    setMessages([]);
    setUnreadMessagesCount(0);
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('chat:clear', {
        roomId: room.id,
        clearedBy: user?.name || 'Admin',
      });
    }
  };

  // Remote Control Actions
  const requestRemoteControl = (presenterSocketId: string) => {
    const socket = getSocket();
    if (socket.connected) {
      controlledPresenterSocketIdRef.current = presenterSocketId;
      setRemoteControlState('requesting');
      socket.emit('remote:request', { presenterSocketId });
    }
  };

  const respondRemoteRequest = (approved: boolean) => {
    if (!incomingRemoteRequest) return;
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('remote:respond', {
        requesterSocketId: incomingRemoteRequest.requesterSocketId,
        approved,
      });

      if (approved) {
        setRemoteControlState('controlled');
        setActiveControllerName(incomingRemoteRequest.requesterName);
      }
    }
    setIncomingRemoteRequest(null);
  };

  const revokeRemoteControl = () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('remote:revoke', { reason: 'Presenter revoked remote control' });
    }
    setRemoteControlState('idle');
    setActiveControllerName(null);
    setRemoteCursor(null);
  };

  const releaseRemoteControl = () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('remote:release');
    }
    setRemoteControlState('idle');
    controlledPresenterSocketIdRef.current = null;
  };

  const sendRemoteInput = (event: RemoteInputEvent) => {
    const targetSocketId = controlledPresenterSocketIdRef.current;
    if (!targetSocketId) return;

    const socket = getSocket();
    if (socket.connected) {
      socket.emit('remote:input', {
        presenterSocketId: targetSocketId,
        event,
      });
    }
  };

  // Determine Active Presenter(s) & Speaker
  const activePresenters: Participant[] = [
    ...(isScreenSharing
      ? [
          {
            socketId: 'self',
            userId: user?.id || 'self',
            name: `${user?.name || 'You'} (You)`,
            avatarUrl: user?.avatarUrl,
            isMuted,
            isCameraOff,
            isScreenSharing: true,
            isSpeaking,
            screenStream: screenStream || undefined,
            connectionQuality: 'excellent',
          } as Participant,
        ]
      : []),
    ...participants.filter((p) => p.isScreenSharing),
  ];

  const activePresenter = activePresenters[0] || null;

  const activeSpeaker =
    isSpeaking
      ? ({
          socketId: getSocket().id || 'self',
          userId: user?.id || '',
          name: `${user?.name} (You)`,
          avatarUrl: user?.avatarUrl,
          isMuted,
          isCameraOff,
          isScreenSharing,
          isSpeaking: true,
        } as Participant)
      : participants.find((p) => p.isSpeaking) || null;

  return (
    <MeetingContext.Provider
      value={{
        room,
        isLoadingRoom,
        isInCall,
        participants,
        localStream,
        screenStream,
        isMuted,
        isCameraOff,
        isScreenSharing,
        isSpeaking,
        toggleMic,
        toggleCamera,
        startScreenShare,
        stopScreenShare,
        audioInputs,
        videoInputs,
        audioOutputs,
        selectedAudioInput,
        selectedVideoInput,
        selectedAudioOutput,
        selectAudioInput,
        selectVideoInput,
        selectAudioOutput,
        joinMeeting,
        leaveMeeting,
        messages,
        unreadMessagesCount,
        isChatOpen,
        setIsChatOpen,
        typingUsers,
        replyingTo,
        setReplyingTo,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        togglePin,
        sendTyping,
        clearChat,
        remoteControlState,
        incomingRemoteRequest,
        activeControllerName,
        remoteCursor,
        requestRemoteControl,
        respondRemoteRequest,
        revokeRemoteControl,
        releaseRemoteControl,
        sendRemoteInput,
        activePresenter,
        activePresenters,
        activeSpeaker,
        isHandRaised,
        toggleHandRaise,
        isPresentationAudioEnabled,
        togglePresentationAudio,
        isPresentationSilencedLocally,
        toggleSilencePresentation,
        remoteToggleParticipantMic,
        remoteToggleParticipantCamera,
        isPipActive,
        togglePip,
        notifications,
        dismissNotification,
        chatToasts,
        dismissChatToast,
        activeSidePanelTab,
        setActiveSidePanelTab,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeeting = (): MeetingContextType => {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
};
