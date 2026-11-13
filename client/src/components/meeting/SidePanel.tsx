import React, { useRef, useState, useEffect } from 'react';
import { useMeeting } from '../../context/MeetingContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Message } from '../../types';
import { SetPasswordModal } from '../common/SetPasswordModal';
import {
  X,
  Send,
  Paperclip,
  Smile,
  Search,
  Pin,
  CornerDownRight,
  Download,
  Trash2,
  Edit2,
  Copy,
  Check,
  UserPlus,
  Shield,
  ShieldCheck,
  UserX,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Users,
  Info,
  Clock,
  Sparkles,
  Hand,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Lock,
  KeyRound,
  Crown,
  Loader2,
} from 'lucide-react';

export const SidePanel: React.FC = () => {
  const { user, accessStatus, setGuestPasscode } = useAuth();
  const {
    room,
    activeSidePanelTab,
    setActiveSidePanelTab,
    participants,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePin,
    sendTyping,
    clearChat,
    typingUsers,
    replyingTo,
    setReplyingTo,
    isHandRaised,
    toggleHandRaise,
    isMuted,
    isCameraOff,
    toggleMic,
    toggleCamera,
    remoteToggleParticipantMic,
    remoteToggleParticipantCamera,
  } = useMeeting();

  // Chat local state
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isSetPassModalOpen, setIsSetPassModalOpen] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isPastingRef = useRef(false);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (activeSidePanelTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeSidePanelTab]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendTyping(false);
    const content = inputText.trim();
    setInputText('');
    await sendMessage(content);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await api.uploadFile(file);
      const isImg = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(res.fileName);
      const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogg|m4v)$/i.test(res.fileName);

      if (isImg) {
        await sendMessage(`📷 **Image**: [${res.fileName}](${res.url})\n\n![${res.fileName}](${res.url})`);
      } else if (isVid) {
        await sendMessage(`🎥 **Video**: [${res.fileName}](${res.url})`);
      } else {
        await sendMessage(`📎 **File**: [${res.fileName}](${res.url})`);
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle clipboard image copy-paste directly into chat
  const handlePaste = async (e: React.ClipboardEvent | ClipboardEvent) => {
    // Prevent duplicate firing from event bubbling or overlapping listeners
    if (isPastingRef.current || isUploading) {
      e.preventDefault();
      if ((e as any).stopPropagation) (e as any).stopPropagation();
      return;
    }

    const clipboardData = (e as any).clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    let imageFile: File | null = null;

    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            imageFile = file;
            break;
          }
        }
      }
    }

    if (!imageFile && clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        if (clipboardData.files[i].type.startsWith('image/')) {
          imageFile = clipboardData.files[i];
          break;
        }
      }
    }

    if (imageFile) {
      e.preventDefault();
      if ((e as any).stopPropagation) (e as any).stopPropagation();
      isPastingRef.current = true;
      try {
        setIsUploading(true);
        const res = await api.uploadFile(imageFile);
        await sendMessage(
          `📷 **Image**: [${res.fileName}](${res.url})\n\n![${res.fileName}](${res.url})`,
        );
      } catch (err) {
        console.error('Failed to upload pasted image:', err);
        alert('Failed to send pasted image');
      } finally {
        setIsUploading(false);
        setTimeout(() => {
          isPastingRef.current = false;
        }, 1000);
      }
    }
  };

  // Global window paste listener when chat tab is open
  useEffect(() => {
    const onGlobalPaste = (e: ClipboardEvent) => {
      if (activeSidePanelTab !== 'chat') return;
      // If paste target is inside the text input, let the input's own onPaste handle it
      if (e.target && ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA')) {
        return;
      }
      handlePaste(e);
    };

    window.addEventListener('paste', onGlobalPaste);
    return () => window.removeEventListener('paste', onGlobalPaste);
  }, [activeSidePanelTab, sendMessage]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerateInvite = async () => {
    if (!room) return;
    try {
      const inv = await api.createInvite(room.id, { expiresInHours: 48 });
      setInviteCode(inv.code);
      navigator.clipboard.writeText(`${window.location.origin}/join/${inv.code}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportChat = async () => {
    if (!room) return;
    try {
      const data = await api.exportChat(room.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${room.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  // Filter messages by search
  const filteredMessages = messages.filter((m) =>
    searchQuery ? m.content.toLowerCase().includes(searchQuery.toLowerCase()) : true,
  );

  const pinnedMessages = messages.filter((m) => m.isPinned);

  const isOwnerOrAdmin =
    user?.name?.toLowerCase() === 'admin' ||
    user?.email?.toLowerCase().includes('admin') ||
    room?.ownerId === user?.id ||
    room?.members?.some((m) => m.userId === user?.id && (m.role === 'ADMIN' || m.role === 'OWNER'));

  // Helper to render rich message content with inline images, videos, and files
  const renderMessageContent = (content: string) => {
    if (!content) return null;

    const markdownImgRegex = /!\[(.*?)\]\((.*?)\)/g;
    const markdownLinkRegex = /\[(.*?)\]\((.*?)\)/g;

    const images: { alt: string; url: string }[] = [];
    const videos: { title: string; url: string }[] = [];
    const files: { title: string; url: string }[] = [];

    let match;
    while ((match = markdownImgRegex.exec(content)) !== null) {
      images.push({ alt: match[1] || 'Image', url: match[2] });
    }

    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const title = match[1];
      const url = match[2];
      const alreadyCaptured = images.some((img) => img.url === url);
      if (!alreadyCaptured) {
        if (/\.(png|jpg|jpeg|gif|webp|svg)($|\?)/i.test(url)) {
          images.push({ alt: title, url });
        } else if (/\.(mp4|webm|mov|mkv|ogg|m4v)($|\?)/i.test(url)) {
          videos.push({ title, url });
        } else {
          files.push({ title, url });
        }
      }
    }

    // Clean text by stripping markdown media syntax to show clean text
    const cleanText = content
      .replace(/!\[(.*?)\]\((.*?)\)/g, '')
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .trim();

    // Helper to resolve media URL when client is deployed on Vercel with external backend
    const resolveMediaUrl = (url: string) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
      }
      const baseUrl = import.meta.env.VITE_API_URL
        ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')
        : '';
      return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    return (
      <div className="space-y-2">
        {cleanText && (
          <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
            {cleanText}
          </div>
        )}

        {/* Render Images Inline */}
        {images.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {images.map((img, idx) => {
              const fullUrl = resolveMediaUrl(img.url);
              return (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden border border-slate-700/60 bg-black/40 max-w-sm group relative"
                >
                  <img
                    src={fullUrl}
                    alt={img.alt}
                    className="w-full max-h-60 object-contain cursor-pointer hover:opacity-95 transition"
                    onClick={() => window.open(fullUrl, '_blank')}
                  />
                  <div className="p-1.5 bg-[#0e1628]/90 text-[10px] text-slate-300 flex items-center justify-between border-t border-slate-800">
                    <span className="truncate max-w-[200px]">{img.alt}</span>
                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline flex items-center space-x-1"
                    >
                      <span>View full</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Render Videos Inline */}
        {videos.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {videos.map((vid, idx) => {
              const fullVidUrl = resolveMediaUrl(vid.url);
              return (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden border border-slate-700/60 bg-black/60 max-w-sm"
                >
                  <video
                    src={fullVidUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-60 rounded-xl"
                  />
                  <div className="p-1.5 bg-[#0e1628]/90 text-[10px] text-slate-300 flex items-center justify-between border-t border-slate-800">
                    <span className="truncate max-w-[200px]">{vid.title}</span>
                    <a
                      href={fullVidUrl}
                      download
                      className="text-blue-400 hover:underline"
                    >
                      Download
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Render Other Attachments */}
        {files.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            {files.map((f, idx) => {
              const fullFileUrl = resolveMediaUrl(f.url);
              return (
                <a
                  key={idx}
                  href={fullFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-blue-300 transition max-w-sm"
                >
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="truncate flex-1 font-medium">{f.title}</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (!activeSidePanelTab) return null;

  return (
    <aside className="w-full sm:w-96 bg-[#111827] border-l border-slate-800 flex flex-col h-full z-40 animate-in slide-in-from-right duration-200">
      {/* Header Tabs */}
      <div className="h-16 border-b border-slate-800 px-4 flex items-center justify-between bg-[#0e1422]">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSidePanelTab('chat')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeSidePanelTab === 'chat'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setActiveSidePanelTab('people')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeSidePanelTab === 'people'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>People ({participants.length + 1})</span>
          </button>
          <button
            onClick={() => setActiveSidePanelTab('info')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeSidePanelTab === 'info'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Info</span>
          </button>
        </div>

        <button
          onClick={() => setActiveSidePanelTab(null)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ================= CHAT TAB ================= */}
      {activeSidePanelTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0f1626]">
          {/* Permanent History Notice */}
          <div className="px-4 py-2.5 bg-blue-950/40 border-b border-blue-900/30 flex items-center justify-between text-[11px] text-blue-300">
            <span className="flex items-center space-x-1.5 truncate max-w-[190px]">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="truncate">Permanent Room Chat</span>
            </span>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={handleExportChat}
                title="Export chat history"
                className="text-blue-400 hover:text-white hover:underline flex items-center space-x-1"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>

              {/* Admin Wipe / Clear Chat Button */}
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setShowClearConfirmModal(true)}
                  title="Wipe and clear all chat history (Admin only)"
                  className="px-2 py-0.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 text-[11px] font-bold flex items-center space-x-1 transition shadow-sm"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Wipe Chat</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#162035] border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Pinned Messages Header (if any) */}
          {pinnedMessages.length > 0 && !searchQuery && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center space-x-2 text-xs text-amber-300">
              <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-semibold">Pinned:</span>
              <span className="truncate flex-1">{pinnedMessages[0].content}</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-blue-400" />
                <p className="text-xs">No messages found</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Send a message or paste an image to start chatting.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isCriticalAlert = msg.content?.includes('🚨 CRITICAL');
                const isSecurityNotice =
                  !isCriticalAlert &&
                  (msg.content?.includes('Security Notice') ||
                    msg.content?.includes('📷 **Security Notice**'));
                const isSpecialAlert = isCriticalAlert || isSecurityNotice;
                const isMyMessage = !isSpecialAlert && msg.sender.id === user?.id;
                const isEditing = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`group relative flex flex-col space-y-1 animate-in fade-in duration-150 w-full ${
                      isMyMessage ? 'items-end' : 'items-start'
                    }`}
                  >
                    {/* Reply quote banner if replying to another message */}
                    {msg.replyTo && (
                      <div
                        className={`flex items-center space-x-1.5 text-[11px] text-slate-400 mb-0.5 ${
                          isMyMessage ? 'pr-2 justify-end' : 'pl-8 justify-start'
                        }`}
                      >
                        <CornerDownRight className="w-3 h-3 text-slate-500" />
                        <span>Replying to</span>
                        <span className="font-semibold text-slate-300">{msg.replyTo.sender.name}:</span>
                        <span className="truncate italic max-w-[150px]">{msg.replyTo.content}</span>
                      </div>
                    )}

                    <div
                      className={`flex items-start space-x-2 max-w-[85%] ${
                        isMyMessage ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                      }`}
                    >
                      {!isSpecialAlert && (
                        <img
                          src={
                            msg.sender.avatarUrl ||
                            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                              msg.sender.name,
                            )}`
                          }
                          alt={msg.sender.name}
                          className="w-7 h-7 rounded-full bg-slate-800 mt-1 object-cover flex-shrink-0"
                        />
                      )}

                      <div className={`flex flex-col min-w-0 ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        {/* Header: Sender & Time */}
                        <div
                          className={`flex items-center space-x-1.5 mb-1 ${
                            isMyMessage ? 'flex-row-reverse space-x-reverse text-right' : 'flex-row'
                          }`}
                        >
                          <span
                            className={`text-xs font-bold truncate ${
                              isMyMessage
                                ? 'text-blue-400'
                                : isCriticalAlert
                                ? 'text-red-400'
                                : isSecurityNotice
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {isMyMessage ? 'You' : msg.sender.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.isPinned && (
                            <span title="Pinned message">
                              <Pin className="w-3 h-3 text-amber-400 inline" />
                            </span>
                          )}
                          {msg.isEdited && (
                            <span className="text-[9px] text-slate-500">(edited)</span>
                          )}
                        </div>

                        {/* Content or Edit Form */}
                        {isEditing ? (
                          <div className="mt-1 flex items-center space-x-1.5">
                            <input
                              type="text"
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="flex-1 bg-[#1a253c] border border-blue-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={async () => {
                                if (editingContent.trim()) {
                                  await editMessage(msg.id, editingContent.trim());
                                  setEditingMessageId(null);
                                }
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : isCriticalAlert ? (
                          /* RED Critical Security Alert */
                          <div className="p-3 rounded-2xl bg-red-950/85 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)] text-red-100 text-left w-full">
                            <div className="flex items-center space-x-2 text-red-400 font-bold text-xs uppercase tracking-wide">
                              <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                              </span>
                              <span>Critical Security Alert</span>
                            </div>
                            <div className="mt-1.5">{renderMessageContent(msg.content)}</div>
                          </div>
                        ) : isSecurityNotice ? (
                          /* YELLOW Normal Security Notice */
                          <div className="p-3 rounded-2xl bg-amber-950/80 border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] text-amber-100 text-left w-full">
                            <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
                              <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                              </span>
                              <span>Security Notice</span>
                            </div>
                            <div className="mt-1.5">{renderMessageContent(msg.content)}</div>
                          </div>
                        ) : isMyMessage ? (
                          /* MINE in BLUE BOX (Right Aligned) */
                          <div
                            className={`p-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed break-words text-left shadow-md ${
                              msg.isDeleted
                                ? 'bg-blue-900/40 text-blue-200/60 italic'
                                : 'bg-blue-600 text-white border border-blue-500/50'
                            }`}
                          >
                            {renderMessageContent(msg.content)}
                          </div>
                        ) : (
                          /* OTHERS in BLACKISH BOX (Left Aligned) */
                          <div
                            className={`p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed break-words text-left shadow-sm ${
                              msg.isDeleted
                                ? 'bg-slate-900/60 text-slate-500 italic'
                                : 'bg-[#121826] text-slate-100 border border-slate-800'
                            }`}
                          >
                            {renderMessageContent(msg.content)}
                          </div>
                        )}

                        {/* Reactions row */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div
                            className={`flex flex-wrap gap-1 mt-1.5 ${
                              isMyMessage ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                              const count = msg.reactions.filter((r) => r.emoji === emoji).length;
                              const hasReacted = msg.reactions.some(
                                (r) => r.emoji === emoji && r.userId === user?.id,
                              );
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`px-1.5 py-0.5 rounded-md text-[11px] flex items-center space-x-1 border transition ${
                                    hasReacted
                                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                                      : 'bg-[#182337] border-slate-700 text-slate-300 hover:bg-slate-800'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-semibold text-[10px]">{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Bar on Hover */}
                    {!msg.isDeleted && (
                      <div
                        className={`absolute top-0 hidden group-hover:flex items-center space-x-0.5 bg-[#141b2d] border border-slate-700/80 rounded-lg p-0.5 shadow-xl z-10 ${
                          isMyMessage ? 'left-2' : 'right-2'
                        }`}
                      >
                        {/* Reply */}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          title="Reply"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Emoji Reaction Popover */}
                        <button
                          onClick={() =>
                            setActiveReactionMessageId(
                              activeReactionMessageId === msg.id ? null : msg.id,
                            )
                          }
                          title="Add reaction"
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Pin */}
                        <button
                          onClick={() => togglePin(msg.id)}
                          title={msg.isPinned ? 'Unpin' : 'Pin'}
                          className={`p-1 hover:bg-slate-800 rounded ${
                            msg.isPinned ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit (if my message) */}
                        {isMyMessage && (
                          <button
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditingContent(msg.content);
                            }}
                            title="Edit"
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete (if my message or room owner) */}
                        {(isMyMessage || isOwnerOrAdmin) && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            title="Delete"
                            className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reaction Floating Picker */}
                    {activeReactionMessageId === msg.id && (
                      <div className="absolute right-2 top-8 flex items-center space-x-1 bg-[#1a233a] border border-slate-700 rounded-xl p-1 shadow-2xl z-20">
                        {['👍', '❤️', '👏', '🚀', '🔥', '😂'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              toggleReaction(msg.id, emoji);
                              setActiveReactionMessageId(null);
                            }}
                            className="w-7 h-7 hover:bg-slate-800 rounded-lg text-sm flex items-center justify-center hover:scale-125 transition"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Uploading Status Banner */}
          {isUploading && (
            <div className="px-4 py-2 bg-blue-600/15 border-t border-blue-500/30 text-xs text-blue-300 flex items-center space-x-2 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Uploading and sending image / attachment...</span>
            </div>
          )}

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="px-4 py-1 text-[11px] text-blue-400 italic bg-blue-950/20 border-t border-slate-800/50 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>{typingUsers.join(', ')} is typing...</span>
            </div>
          )}

          {/* Replying Banner */}
          {replyingTo && (
            <div className="px-4 py-1.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center space-x-1.5 truncate">
                <CornerDownRight className="w-3.5 h-3.5 text-blue-400" />
                <span>Replying to</span>
                <span className="font-bold text-white">{replyingTo.sender.name}</span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-800 bg-[#0e1422] flex items-center space-x-2"
          >
            {/* File Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              title="Send image, video, or document (or paste image)"
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition flex-shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Input field */}
            <input
              type="text"
              placeholder={isUploading ? 'Uploading...' : 'Type a message (or paste image)...'}
              value={inputText}
              onChange={handleInputChange}
              onPaste={handlePaste}
              disabled={isUploading}
              className="flex-1 bg-[#162035] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isUploading}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition flex-shrink-0 shadow-md shadow-blue-600/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ================= PEOPLE TAB ================= */}
      {activeSidePanelTab === 'people' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#0f1626]">
          {/* Invite Section */}
          <div className="bg-[#182337] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Invite to Room
              </span>
              <button
                onClick={handleGenerateInvite}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Invite Link</span>
              </button>
            </div>
            {copiedLink && (
              <p className="text-[11px] text-emerald-400 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>Invite link copied to clipboard!</span>
              </p>
            )}
          </div>

          {/* Active in Call */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              In this Call ({participants.length + 1})
            </span>
            <div className="space-y-1.5">
              {/* Self */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141d2e] border border-slate-800">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <img
                    src={
                      user?.avatarUrl ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                        user?.name || 'User',
                      )}`
                    }
                    alt={user?.name}
                    className="w-8 h-8 rounded-full bg-slate-800 object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">
                      {user?.name} (You)
                    </span>
                    <span className="text-[10px] text-blue-400">
                      {isHandRaised ? '✋ Hand Raised' : 'Host / In Call'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={toggleCamera}
                    title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
                    className={`p-1.5 rounded-lg border transition ${
                      isCameraOff
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    {isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={toggleMic}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`p-1.5 rounded-lg border transition ${
                      isMuted
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Remote Participants */}
              {participants.map((p) => (
                <div
                  key={p.socketId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#141d2e] border border-slate-800"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <img
                      src={
                        p.avatarUrl ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`
                      }
                      alt={p.name}
                      className="w-8 h-8 rounded-full bg-slate-800 object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white block truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {p.isHandRaised ? (
                          <span className="text-amber-400 font-bold">✋ Hand Raised</span>
                        ) : p.isSpeaking ? (
                          <span className="text-emerald-400">Speaking...</span>
                        ) : (
                          'Participant'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Anyone can turn on or off this participant's mic or camera */}
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={() => remoteToggleParticipantCamera(p.socketId, p.isCameraOff)}
                      title={p.isCameraOff ? `Turn ON ${p.name}'s camera` : `Turn OFF ${p.name}'s camera`}
                      className={`p-1.5 rounded-lg border transition ${
                        p.isCameraOff
                          ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                          : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p.isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => remoteToggleParticipantMic(p.socketId, p.isMuted)}
                      title={p.isMuted ? `Unmute ${p.name}'s microphone` : `Mute ${p.name}'s microphone`}
                      className={`p-1.5 rounded-lg border transition ${
                        p.isMuted
                          ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                          : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Permanent Room Members */}
          {room?.members && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Permanent Room Members ({room.members.length})
              </span>
              <div className="space-y-1.5">
                {room.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#141d2e] border border-slate-800"
                  >
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={
                          member.user.avatarUrl ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                            member.user.name,
                          )}`
                        }
                        alt={member.user.name}
                        className="w-8 h-8 rounded-full bg-slate-800 object-cover"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">
                          {member.user.name}
                        </span>
                        <span className="text-[10px] text-slate-400">{member.role}</span>
                      </div>
                    </div>

                    {isOwnerOrAdmin && member.userId !== user?.id && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={async () => {
                            if (confirm(`Revoke room access for ${member.user.name}?`)) {
                              await api.revokeMember(room.id, member.userId);
                            }
                          }}
                          title="Revoke access"
                          className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= INFO TAB ================= */}
      {activeSidePanelTab === 'info' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#0f1626]">
          {/* Meeting Security & Passcode (Host Creates Every Time) */}
          <div className="bg-[#182338] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-400">
                <Lock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Participant Meeting Passcode
                </span>
              </div>
              {isOwnerOrAdmin && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center space-x-1">
                  <Crown className="w-3 h-3" />
                  <span>Host Control</span>
                </span>
              )}
            </div>

            <div className="p-3 bg-[#121929] border border-slate-700/60 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Active Passcode</span>
                <span className="text-sm font-mono font-bold text-white tracking-widest">
                  {room?.passcode || accessStatus?.guestPasscode ? (
                    <span className="text-amber-400 font-mono text-base">
                      {room?.passcode || accessStatus?.guestPasscode}
                    </span>
                  ) : accessStatus?.hasPasswordSet ? (
                    <span className="text-amber-400 font-sans text-xs">Active (Protected)</span>
                  ) : (
                    <span className="text-emerald-400 font-sans text-xs">None (Open Meeting)</span>
                  )}
                </span>
              </div>

              <button
                onClick={async () => {
                  const code = room?.passcode || accessStatus?.guestPasscode;
                  const invite = `Join Study Partner Video Meeting:\n${window.location.origin}/room/deep-nav${
                    code ? `\nMeeting Passcode: ${code}` : ''
                  }`;
                  await navigator.clipboard.writeText(invite);
                  setCopiedInvite(true);
                  setTimeout(() => setCopiedInvite(false), 2500);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
              >
                {copiedInvite ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedInvite ? 'Copied' : 'Copy Invite'}</span>
              </button>
            </div>

            {isOwnerOrAdmin && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={async () => {
                    try {
                      const res = await setGuestPasscode(null, true);
                      const invite = `Join Study Partner Video Meeting:\n${window.location.origin}/room/deep-nav\nMeeting Passcode: ${res.passcode}`;
                      await navigator.clipboard.writeText(invite);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2500);
                    } catch (e: any) {
                      alert(e.message || 'Failed to generate passcode');
                    }
                  }}
                  className="py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Generate New</span>
                </button>

                <button
                  onClick={() => setIsSetPassModalOpen(true)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition border border-slate-700"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Manage / Edit</span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              {isOwnerOrAdmin
                ? 'Generate a fresh passcode for every meeting. Other participants must enter it to join.'
                : 'Passcode is created by the host for this meeting session.'}
            </p>
          </div>

          {/* Joining Information */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Permanent Room URL
            </span>
            <div className="flex items-center space-x-2 bg-[#182337] border border-slate-800 rounded-xl p-2.5">
              <span className="text-xs font-mono text-blue-300 truncate flex-1">
                {window.location.href}
              </span>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Room Details */}
          <div className="bg-[#182337] border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-sm font-bold text-white">{room?.name}</h4>
            {room?.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{room.description}</p>
            )}

            <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Room Slug:</span>
                <span className="font-mono text-slate-200">/{room?.slug}</span>
              </div>
              <div className="flex justify-between">
                <span>Created by:</span>
                <span className="text-slate-200">{room?.owner?.name || 'Owner'}</span>
              </div>
              <div className="flex justify-between">
                <span>Capacity:</span>
                <span className="text-slate-200">Up to 10 participants</span>
              </div>
              <div className="flex justify-between">
                <span>Persistence:</span>
                <span className="text-emerald-400 font-medium">Permanent entity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set / Change Password Modal */}
      <SetPasswordModal
        isOpen={isSetPassModalOpen}
        onClose={() => setIsSetPassModalOpen(false)}
      />

      {/* Admin Wipe Chat Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121929] border border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Wipe Entire Chat?</h3>
                <p className="text-xs text-red-400 font-semibold">Admin Master Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete and wipe all messages, images, and videos in this chat?
              <span className="block mt-1 text-slate-400 font-medium">
                This action is irreversible and wipes the history for all participants.
              </span>
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isClearingChat}
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingChat}
                onClick={async () => {
                  try {
                    setIsClearingChat(true);
                    await clearChat();
                    setShowClearConfirmModal(false);
                  } catch (e: any) {
                    alert(e.message || 'Failed to wipe chat');
                  } finally {
                    setIsClearingChat(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
              >
                {isClearingChat ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Wiping Chat...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Wipe Everything</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
