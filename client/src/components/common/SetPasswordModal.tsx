import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  KeyRound,
  X,
  Check,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Crown,
  Sparkles,
  Copy,
  Lock,
} from 'lucide-react';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetPasswordModal: React.FC<SetPasswordModalProps> = ({ isOpen, onClose }) => {
  const {
    accessStatus,
    setGuestPasscode,
    setAdminPassword,
    user,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'guest' | 'admin'>('guest');

  // Guest Passcode states
  const [customPasscode, setCustomPasscode] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Admin Master Password states
  const [newAdminPass, setNewAdminPass] = useState('');
  const [currentAdminPass, setCurrentAdminPass] = useState('');

  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate random 6-digit passcode for participants
  const handleGenerateRandom = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await setGuestPasscode(null, true);
      setSuccessMsg(`New meeting passcode generated: ${res.passcode}`);
      setCustomPasscode(res.passcode || '');

      // Copy to clipboard automatically
      const inviteText = `Join deep-nav Video Meeting:\n${window.location.origin}/room/deep-nav\nMeeting Passcode: ${res.passcode}`;
      await navigator.clipboard.writeText(inviteText);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate passcode');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set custom passcode
  const handleSetCustomGuestPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPasscode.trim()) return;

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await setGuestPasscode(customPasscode.trim());
      setSuccessMsg(`Meeting passcode set to: ${res.passcode}`);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to set passcode');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove guest passcode
  const handleRemoveGuestPasscode = async () => {
    if (!confirm('Remove meeting passcode? Anyone with the link will be able to enter freely.')) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await setGuestPasscode(null);
      setSuccessMsg('Meeting passcode removed (Room is now open)');
      setCustomPasscode('');
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to remove passcode');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Admin Master Password
  const handleSetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await setAdminPassword(newAdminPass.trim(), currentAdminPass.trim() || undefined);
      setSuccessMsg(res.message);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update admin master password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy room link and passcode
  const handleCopyInvite = async () => {
    const inviteText = `Join deep-nav Video Meeting:\n${window.location.origin}/room/deep-nav${
      accessStatus?.guestPasscode ? `\nMeeting Passcode: ${accessStatus.guestPasscode}` : ''
    }`;
    await navigator.clipboard.writeText(inviteText);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md bg-[#131b2e] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Meeting Security & Passwords</h3>
              <p className="text-xs text-slate-400">Host controls for deep-nav</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="grid grid-cols-2 p-1 bg-[#182337] rounded-2xl border border-slate-700/60 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('guest');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'guest'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Guest Passcode</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'admin'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Admin Password</span>
          </button>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================= TAB 1: GUEST PASSCODE (CREATED EVERY TIME) ================= */}
        {activeTab === 'guest' && (
          <div className="space-y-4">
            {/* Current Passcode Status Card */}
            <div className="p-3.5 bg-[#182338] border border-slate-700/70 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Current Participant Passcode
                </span>
                <span className="text-sm font-mono font-bold text-white tracking-widest mt-0.5 block">
                  {accessStatus?.guestPasscode ? (
                    <span className="text-amber-400">{accessStatus.guestPasscode}</span>
                  ) : accessStatus?.hasPasswordSet ? (
                    <span className="text-amber-400 font-sans text-xs">Active (Protected)</span>
                  ) : (
                    <span className="text-emerald-400 font-sans text-xs">None (Open Room)</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              >
                {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedInvite ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* 1-Click Generate Random Passcode */}
            <button
              type="button"
              onClick={handleGenerateRandom}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2 transition disabled:opacity-50 text-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>🎲 Generate Fresh 6-Digit Passcode</span>
            </button>

            {/* Custom Passcode Form */}
            <form onSubmit={handleSetCustomGuestPasscode} className="space-y-2 pt-1 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block">
                Or Type Custom Meeting Passcode
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customPasscode}
                  onChange={(e) => setCustomPasscode(e.target.value)}
                  placeholder="e.g. meet42"
                  className="flex-1 bg-[#1b253b] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition font-mono"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !customPasscode.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition border border-slate-700 disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </form>

            {accessStatus?.hasPasswordSet && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleRemoveGuestPasscode}
                  disabled={isSubmitting}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline transition"
                >
                  Clear Passcode (Make Open)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: ADMIN MASTER PASSWORD ("ME: ADMIN") ================= */}
        {activeTab === 'admin' && (
          <form onSubmit={handleSetAdminPassword} className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 space-y-1">
              <span className="font-bold flex items-center space-x-1.5">
                <Crown className="w-3.5 h-3.5" />
                <span>Host Master Password: {accessStatus?.adminName || 'Admin'}</span>
              </span>
              <p className="text-[11px] text-amber-200/80">
                Set this once. Once saved on this device, you can enter with 1 click anytime without having to type it again.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Current Admin Password (if changing)</label>
              <input
                type="password"
                value={currentAdminPass}
                onChange={(e) => setCurrentAdminPass(e.target.value)}
                placeholder="Current password (default: password123)"
                className="w-full bg-[#1b253b] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">New Admin Master Password</label>
              <input
                type="text"
                required
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                placeholder="Enter new admin password"
                className="w-full bg-[#1b253b] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newAdminPass.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/25 flex items-center justify-center space-x-2 transition disabled:opacity-50 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  <span>Update Admin Master Password</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
