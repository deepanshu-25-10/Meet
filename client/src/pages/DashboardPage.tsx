import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Room } from '../types';
import { Navbar } from '../components/common/Navbar';
import { DeviceSettingsModal } from '../components/common/DeviceSettingsModal';
import {
  Video,
  Plus,
  ArrowRight,
  Lock,
  Globe,
  Users,
  MessageSquare,
  Clock,
  Sparkles,
  Search,
  Trash2,
  Share2,
  Copy,
  Check,
  Shield,
  Activity,
} from 'lucide-react';

interface DashboardPageProps {
  onJoinRoom: (slug: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onJoinRoom }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [joinSlugInput, setJoinSlugInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Create room modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomSlug, setNewRoomSlug] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [newRoomPasscode, setNewRoomPasscode] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      const data = await api.getRooms();
      setRooms(data);
    } catch (e) {
      console.error('Failed to load rooms:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const room = await api.createRoom({
        name: newRoomName.trim(),
        slug: newRoomSlug.trim() || undefined,
        description: newRoomDesc.trim() || undefined,
        isPrivate,
        passcode: newRoomPasscode.trim() || undefined,
        maxParticipants,
      });

      setIsCreateModalOpen(false);
      setNewRoomName('');
      setNewRoomSlug('');
      setNewRoomDesc('');
      setNewRoomPasscode('');
      setIsPrivate(false);
      fetchRooms();

      // Directly navigate into the newly created room
      onJoinRoom(room.slug);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete room "${name}"? This will delete all chat history.`)) {
      try {
        await api.deleteRoom(id);
        setRooms((prev) => prev.filter((r) => r.id !== id));
      } catch (e: any) {
        alert(e.message || 'Failed to delete room');
      }
    }
  };

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlugInput.trim()) return;
    const cleanSlug = joinSlugInput.trim().replace(/^https?:\/\/[^\/]+\/room\//, '').replace(/^\/room\//, '');
    onJoinRoom(cleanSlug);
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col text-slate-100">
      <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-[#121929] border border-blue-900/30 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Permanent Meeting Rooms • Persistent Chat • Remote Desktop</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Premium video meetings that never expire.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Permanent rooms maintain their URL, identities, and chat records even when everyone leaves. Step into your team’s permanent space anytime.
            </p>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/30 flex items-center justify-center space-x-2 transition hover:scale-[1.02]"
              >
                <Plus className="w-5 h-5" />
                <span>New Permanent Room</span>
              </button>

              <form onSubmit={handleQuickJoin} className="flex-1 flex items-center space-x-2 max-w-md">
                <input
                  type="text"
                  placeholder="Enter room code or slug (e.g. study-partner)"
                  value={joinSlugInput}
                  onChange={(e) => setJoinSlugInput(e.target.value)}
                  className="flex-1 bg-[#141d2e] border border-slate-700 rounded-2xl px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="submit"
                  disabled={!joinSlugInput.trim()}
                  className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 hover:text-white rounded-2xl text-sm font-semibold transition border border-slate-700 flex items-center space-x-1"
                >
                  <span>Join</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Permanent Rooms Grid Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>Your Permanent Rooms</span>
              <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                {rooms.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Always available. Enter independently or meet your teammates.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#131b2e] border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Room Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-3xl bg-[#121929]/50 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#121929]/40 border border-slate-800/80 space-y-3">
            <Video className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No rooms found</p>
            <p className="text-xs text-slate-500">Create your first permanent meeting room above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => {
              const isOwner = room.ownerId === user?.id;

              return (
                <div
                  key={room.id}
                  className="group relative bg-[#131b2e] hover:bg-[#162137] border border-slate-800 hover:border-blue-500/40 rounded-3xl p-6 transition-all duration-200 flex flex-col justify-between shadow-lg hover:shadow-2xl hover:shadow-blue-900/10"
                >
                  {/* Top Bar */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                          /room/{room.slug}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {room.isPrivate ? (
                          <span
                            title="Private Room"
                            className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span
                            title="Public Room"
                            className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {isOwner && (
                          <button
                            onClick={() => handleDeleteRoom(room.id, room.name)}
                            title="Delete room"
                            className="p-1 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Room Name & Desc */}
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition line-clamp-1">
                        {room.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                        {room.description || 'Permanent conference space with real-time video and persistent chat.'}
                      </p>
                    </div>
                  </div>

                  {/* Metadata & Join */}
                  <div className="pt-6 border-t border-slate-800/80 mt-4 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>Up to {room.maxParticipants}</span>
                      </span>

                      <span className="flex items-center space-x-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>{room._count?.messages || 0} messages</span>
                      </span>
                    </div>

                    {/* Join Button */}
                    <button
                      onClick={() => onJoinRoom(room.slug)}
                      className="w-full py-2.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 flex items-center justify-center space-x-2 group-hover:scale-[1.01]"
                    >
                      <Video className="w-4 h-4" />
                      <span>Enter Room</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#131b2e] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white">Create Permanent Room</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                This room will exist permanently and retain all chat history.
              </p>
            </div>

            {createError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Study Partner Room"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-[#182337] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Custom Slug / Permanent URL (Optional)
                </label>
                <div className="flex items-center bg-[#182337] border border-slate-700/80 rounded-xl px-3 py-2.5">
                  <span className="text-xs font-mono text-slate-500 mr-1">/room/</span>
                  <input
                    type="text"
                    placeholder="study-partner"
                    value={newRoomSlug}
                    onChange={(e) => setNewRoomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the purpose of this permanent room..."
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full bg-[#182337] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Max Participants
                  </label>
                  <select
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-full bg-[#182337] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {[2, 3, 4, 5, 6, 8, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} participants
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center space-x-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-0"
                    />
                    <span className="text-xs font-semibold text-slate-300">Private Room</span>
                  </label>
                </div>
              </div>

              {isPrivate && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Room Passcode (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter passcode required to join"
                    value={newRoomPasscode}
                    onChange={(e) => setNewRoomPasscode(e.target.value)}
                    className="w-full bg-[#182337] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-600/30"
                >
                  {isCreating ? 'Creating...' : 'Create & Enter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hardware Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
