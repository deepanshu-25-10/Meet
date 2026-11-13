import React from 'react';
import { useMeeting } from '../../context/MeetingContext';
import { ShieldAlert, Check, X, MousePointer } from 'lucide-react';

export const RemoteApprovalModal: React.FC = () => {
  const { incomingRemoteRequest, respondRemoteRequest } = useMeeting();

  if (!incomingRemoteRequest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#131b2e] border-2 border-amber-500/50 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] p-6 flex flex-col space-y-5">
        {/* Header Icon */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <MousePointer className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Remote Desktop Control</h3>
            <p className="text-xs text-amber-400 font-medium">Consent Required</p>
          </div>
        </div>

        {/* Requester Profile */}
        <div className="bg-[#1b253b] p-4 rounded-2xl border border-slate-700/80 flex items-center space-x-3.5">
          <img
            src={
              incomingRemoteRequest.requesterAvatar ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                incomingRemoteRequest.requesterName,
              )}`
            }
            alt={incomingRemoteRequest.requesterName}
            className="w-12 h-12 rounded-full bg-slate-800 object-cover border border-slate-600"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">
              {incomingRemoteRequest.requesterName}
            </span>
            <span className="text-xs text-slate-300">
              is requesting permission to control your shared screen.
            </span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-amber-950/40 border border-amber-600/30 rounded-xl text-xs text-amber-200/90 leading-relaxed">
          <p className="font-semibold text-amber-300 mb-1 flex items-center">
            <ShieldAlert className="w-4 h-4 mr-1.5 flex-shrink-0" />
            Security Notice
          </p>
          Approving will permit {incomingRemoteRequest.requesterName} to forward mouse clicks, movements, and keyboard input to your presentation. You can revoke access at any time using the Revoke button or pressing <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-white/20 font-mono">Esc</kbd>.
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => respondRemoteRequest(false)}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition border border-slate-700 flex items-center justify-center space-x-2"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>Deny</span>
          </button>
          <button
            onClick={() => respondRemoteRequest(true)}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Approve Control</span>
          </button>
        </div>
      </div>
    </div>
  );
};
