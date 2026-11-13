import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Video,
  KeyRound,
  ArrowRight,
  User as UserIcon,
  Eye,
  EyeOff,
  Crown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface OneClickEntryPageProps {
  onEnterRoom: (slug: string) => void;
  targetSlug?: string;
}

export const OneClickEntryPage: React.FC<OneClickEntryPageProps> = ({
  onEnterRoom,
  targetSlug = 'deep-nav',
}) => {
  const {
    accessStatus,
    savedAdminPassword,
    isAdminSaved,
    savedParticipantName,
    setSavedParticipantName,
    adminLogin,
    participantEntry,
    forgetAdminPassword,
  } = useAuth();

  // Mode: 'participant' vs 'admin'
  const [activeTab, setActiveTab] = useState<'participant' | 'admin'>('participant');

  // Participant Form: ONLY NAME
  const [participantName, setParticipantName] = useState(
    savedParticipantName &&
      savedParticipantName !== 'Alex Rivera' &&
      savedParticipantName !== 'Guest Participant'
      ? savedParticipantName
      : '',
  );

  // Admin Form: Admin Password
  const [adminPasswordInput, setAdminPasswordInput] = useState(savedAdminPassword || '');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [saveAdminOnDevice, setSaveAdminOnDevice] = useState(true);

  // Common UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      savedParticipantName &&
      savedParticipantName !== 'Alex Rivera' &&
      savedParticipantName !== 'Guest Participant' &&
      !participantName
    ) {
      setParticipantName(savedParticipantName);
    }
  }, [savedParticipantName]);

  // Handle Participant Entry Submission (Only requires name)
  const handleParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cleanName = participantName.trim();
      if (!cleanName) {
        setErrorMessage('Please enter your name to continue.');
        setIsSubmitting(false);
        return;
      }
      setSavedParticipantName(cleanName);
      await participantEntry(cleanName);
      onEnterRoom(targetSlug);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Handle Admin / Host Entry Submission
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const pass = adminPasswordInput.trim();
      await adminLogin(pass, saveAdminOnDevice);
      onEnterRoom(targetSlug);
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect admin master password');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#131b2e]/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
            <Video className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Study Partner</span>
          </h1>
          <p className="text-xs text-slate-400">
            Private Video Collaboration & Study Workspace
          </p>
        </div>

        {/* Tab Switcher: Participant vs Admin */}
        <div className="grid grid-cols-2 p-1 bg-[#182337] rounded-2xl border border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab('participant');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'participant'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Participant</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>

        {/* Room Info Pill */}
        <div className="p-3 bg-[#172238] border border-slate-700/60 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {accessStatus?.roomName || 'Study Partner HQ'}
              </span>
              <span className="text-[11px] text-blue-400 font-mono">
                /{targetSlug}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-300 font-medium bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
            Room
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start space-x-2">
            <span className="font-bold flex-shrink-0">Notice:</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================= PARTICIPANT TAB (ONLY NAME) ================= */}
        {activeTab === 'participant' && (
          <form onSubmit={handleParticipantSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Enter Your Name</span>
                </label>
                {participantName && (
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Saved</span>
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  autoFocus
                  value={participantName}
                  onChange={(e) => {
                    setParticipantName(e.target.value);
                    setSavedParticipantName(e.target.value);
                  }}
                  placeholder="e.g. John Doe"
                  className="w-full bg-[#1b253b] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition pl-10"
                />
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                    participantName || 'Guest',
                  )}`}
                  alt="avatar"
                  className="w-6 h-6 rounded-full bg-slate-800 absolute left-2.5 pointer-events-none"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Your name will be displayed to others during the call.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !participantName.trim()}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Entering...</span>
                </>
              ) : (
                <>
                  <span>Continue as Participant</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ================= ADMIN TAB (ADMIN PASSWORD) ================= */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                <Crown className="w-4 h-4" />
                <span>Admin Login: {accessStatus?.adminName || 'Admin'}</span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                Enter your admin master password to manage the meeting.
              </p>
            </div>

            {isAdminSaved && savedAdminPassword ? (
              <div className="p-3 bg-[#182337] border border-slate-700 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Admin password is saved on this device</span>
                  </span>
                  <button
                    type="button"
                    onClick={forgetAdminPassword}
                    className="text-red-400 hover:text-red-300 text-[11px] underline"
                  >
                    Forget
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Click below to enter immediately as admin.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Password</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter admin password..."
                    className="w-full bg-[#1b253b] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAdminOnDevice}
                    onChange={(e) => setSaveAdminOnDevice(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#1b253b] border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Save admin password on this device
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-2xl shadow-xl shadow-amber-600/25 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  <span>Login as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
