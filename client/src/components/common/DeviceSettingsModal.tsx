import React, { useEffect, useRef, useState } from 'react';
import { useMeeting } from '../../context/MeetingContext';
import { Camera, Mic, Volume2, X, Play, Check } from 'lucide-react';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    selectAudioInput,
    selectVideoInput,
    selectAudioOutput,
    localStream,
    isCameraOff,
  } = useMeeting();

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  // Bind local stream to preview
  useEffect(() => {
    if (isOpen && videoPreviewRef.current && localStream) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [isOpen, localStream]);

  // Audio level preview meter for settings
  useEffect(() => {
    if (!isOpen || !localStream) return;

    let animId: number;
    let audioCtx: AudioContext | null = null;

    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicVolume(Math.min(100, Math.round(avg * 2)));
        animId = requestAnimationFrame(updateMeter);
      };

      animId = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn(e);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [isOpen, localStream]);

  // Play test sound
  const playTestTone = () => {
    try {
      setIsPlayingTestTone(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);

      setTimeout(() => {
        setIsPlayingTestTone(false);
        audioCtx.close().catch(() => {});
      }, 600);
    } catch (e) {
      console.error(e);
      setIsPlayingTestTone(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#131b2e] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Audio & Video Settings</h2>
              <p className="text-xs text-slate-400">Configure your hardware devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Video Preview */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Camera Preview
            </label>
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
              {!isCameraOff && localStream && localStream.getVideoTracks().length > 0 ? (
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Camera className="w-8 h-8 opacity-40" />
                  <span className="text-xs">Camera is turned off</span>
                </div>
              )}
            </div>
          </div>

          {/* Camera Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-slate-300">
              <Camera className="w-4 h-4 mr-2 text-blue-400" />
              Camera Device
            </label>
            <select
              value={selectedVideoInput}
              onChange={(e) => selectVideoInput(e.target.value)}
              className="w-full bg-[#1b253b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              {videoInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Microphone Selection & Meter */}
          <div className="space-y-2">
            <label className="flex items-center text-xs font-semibold text-slate-300">
              <Mic className="w-4 h-4 mr-2 text-indigo-400" />
              Microphone Device
            </label>
            <select
              value={selectedAudioInput}
              onChange={(e) => selectAudioInput(e.target.value)}
              className="w-full bg-[#1b253b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>

            {/* Microphone Volume Meter */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>Input Level</span>
                <span>{micVolume}%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 rounded-full transition-all duration-75"
                  style={{ width: `${micVolume}%` }}
                />
              </div>
            </div>
          </div>

          {/* Speaker Selection & Test */}
          <div className="space-y-2">
            <label className="flex items-center text-xs font-semibold text-slate-300">
              <Volume2 className="w-4 h-4 mr-2 text-emerald-400" />
              Speakers / Output
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={selectedAudioOutput}
                onChange={(e) => selectAudioOutput(e.target.value)}
                className="flex-1 bg-[#1b253b] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
              >
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={playTestTone}
                disabled={isPlayingTestTone}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              >
                {isPlayingTestTone ? <Check className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" />}
                <span>Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0f1626] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-600/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
