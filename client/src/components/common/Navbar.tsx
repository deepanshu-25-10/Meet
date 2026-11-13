import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SetPasswordModal } from './SetPasswordModal';
import { LogOut, User as UserIcon, Shield, Sparkles, ChevronDown, Radio, KeyRound } from 'lucide-react';

interface NavbarProps {
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const { user, logout, updateProfile, accessStatus } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleStatusChange = async (status: 'online' | 'busy' | 'away' | 'offline') => {
    try {
      setIsUpdatingStatus(true);
      await updateProfile({ status });
      setIsDropdownOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'busy':
        return 'bg-red-500';
      case 'away':
        return 'bg-amber-500';
      case 'offline':
        return 'bg-slate-500';
      case 'online':
      default:
        return 'bg-emerald-500';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0d1321]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand Logo */}
      <div className="flex items-center space-x-3">
        <a href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-[1.5px] shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
            <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                deep<span className="text-blue-500">-nav</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                Permanent Rooms
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Enterprise Private Conferencing</span>
          </div>
        </a>
      </div>

      {/* User Actions */}
      <div className="flex items-center space-x-3">
        {/* Set Room Password Quick Action */}
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 hover:text-white transition"
          title="Set or update room access password"
        >
          <KeyRound className="w-3.5 h-3.5 text-blue-400" />
          <span>{accessStatus?.hasPasswordSet ? 'Change Password' : 'Set Password'}</span>
        </button>

        {user && (
          <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-1.5 pr-3 rounded-full hover:bg-slate-800/80 border border-slate-800/80 transition-all text-left"
          >
            <div className="relative">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`}
                alt={user.name}
                className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 object-cover"
              />
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0d1321] ${getStatusColor(
                  user.status,
                )}`}
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-semibold text-slate-200 leading-tight">{user.name}</span>
              <span className="text-xs text-slate-400 capitalize">{user.status || 'online'}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {/* Profile Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#141b2d] border border-slate-800/90 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 border-b border-slate-800/80">
                <p className="text-sm font-semibold text-slate-200">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                {user.bio && <p className="text-xs text-slate-400 mt-1 italic">{user.bio}</p>}
              </div>

              {/* Status Switcher */}
              <div className="p-2 border-b border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                  Availability Status
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {(['online', 'busy', 'away', 'offline'] as const).map((st) => (
                    <button
                      key={st}
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusChange(st)}
                      className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs capitalize font-medium transition-all ${
                        user.status === st
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(st)}`} />
                      <span>{st}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-1 space-y-0.5">
                {onOpenSettings && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition"
                  >
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span>Audio & Video Settings</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Set Access Password Modal */}
      <SetPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};
