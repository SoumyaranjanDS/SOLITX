import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Mail, 
  Send, 
  Search, 
  PlusCircle, 
  ArrowLeft, 
  Sparkles, 
  User, 
  CheckCheck,
  ChevronDown,
  RefreshCw,
  X,
  Circle
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatRelativeTime } from '../components/PostCard';
import api from '../api';
import { getSocket } from '../socket';

const QUICK_GREETINGS = [
  '👋 Hey there!',
  '🚀 Working on anything cool?',
  '💻 Nice to connect on SOLITX!',
  '🔥 Love your latest post!'
];

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const selectedUserParam = searchParams.get('u');

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationFilter, setConversationFilter] = useState('');
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Real-time Online Tracking State
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Real-time Typing Indicator State
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const partnerTypingTimerRef = useRef(null);
  const typingEmitTimerRef = useRef(null);
  const hasEmittedTypingRef = useRef(false);

  // New Chat Modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);

  // ─── Initial Data & Notification Sync ─────────────────────────────────────
  useEffect(() => {
    fetchConversations();
    fetchSuggestions();
    fetchOnlineStatus();

    // Mark message notifications as read
    if (currentUser?.username) {
      api.put('/users/notifications/read', { type: 'message' })
        .then(() => window.dispatchEvent(new Event('refresh-notifications')))
        .catch(() => {});
    }
  }, []);

  // ─── Real-Time WebSocket Connection & Event Handlers ───────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // 1. Initial list of online users from server
    const handleInitialOnline = (userList) => {
      if (Array.isArray(userList)) {
        setOnlineUsers(new Set(userList.map((u) => String(u).toLowerCase())));
      }
    };

    // 2. User status change (connect / disconnect)
    const handleUserStatus = ({ username, isOnline }) => {
      if (!username) return;
      const norm = String(username).toLowerCase();
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(norm);
        } else {
          next.delete(norm);
        }
        return next;
      });
    };

    // 3. Partner typing indicator event
    const handleUserTyping = ({ senderUsername, isTyping }) => {
      if (!senderUsername) return;
      const normSender = String(senderUsername).toLowerCase();
      const normActive = activePartner?.username?.toLowerCase() || selectedUserParam?.toLowerCase();

      if (normSender === normActive) {
        setIsPartnerTyping(Boolean(isTyping));

        if (partnerTypingTimerRef.current) {
          clearTimeout(partnerTypingTimerRef.current);
        }

        // Automatic fallback cleanup after 3.5s if stop-typing signal drops
        if (isTyping) {
          partnerTypingTimerRef.current = setTimeout(() => {
            setIsPartnerTyping(false);
          }, 3500);
        }
      }
    };

    // 4. Live incoming message received
    const handleReceiveMessage = (msg) => {
      if (!msg) return;
      const senderU = String(msg.sender_username || '').toLowerCase();
      const normActive = activePartner?.username?.toLowerCase() || selectedUserParam?.toLowerCase();

      // If active conversation matches, append live
      if (senderU && senderU === normActive) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, { ...msg, is_mine: false }];
        });
        setIsPartnerTyping(false);
        if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);

        // Mark read
        api.put('/users/notifications/read', { type: 'message' }).catch(() => {});
      }

      // Update sidebar conversations list
      setConversations((prev) => {
        const existingIdx = prev.findIndex(
          (c) => c.partner_username?.toLowerCase() === senderU
        );
        if (existingIdx !== -1) {
          const updated = [...prev];
          const conv = {
            ...updated[existingIdx],
            last_message: msg.content,
            last_message_at: msg.created_at || new Date().toISOString()
          };
          updated.splice(existingIdx, 1);
          return [conv, ...updated];
        } else {
          fetchConversations();
          return prev;
        }
      });
    };

    socket.on('initial_online_users', handleInitialOnline);
    socket.on('user_status', handleUserStatus);
    socket.on('user_typing', handleUserTyping);
    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('initial_online_users', handleInitialOnline);
      socket.off('user_status', handleUserStatus);
      socket.off('user_typing', handleUserTyping);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [activePartner, selectedUserParam]);

  // ─── Selected Partner Route Change ────────────────────────────────────────
  useEffect(() => {
    // Reset typing state on partner switch
    setIsPartnerTyping(false);
    if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
    if (typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
    hasEmittedTypingRef.current = false;

    if (selectedUserParam) {
      loadMessagesForUser(selectedUserParam);
    } else {
      setActivePartner(null);
      setMessages([]);
    }
  }, [selectedUserParam]);

  // Scroll to bottom on new messages or partner typing
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isPartnerTyping]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  };

  const fetchOnlineStatus = async () => {
    try {
      const res = await api.get('/users/online-status');
      const onlineList = res.data?.data?.onlineUsers || [];
      if (Array.isArray(onlineList)) {
        setOnlineUsers(new Set(onlineList.map((u) => String(u).toLowerCase())));
      }
    } catch (_) {}
  };

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      if (!currentUser?.username) return;
      const res = await api.get('/users/messages/conversations');
      const convList = res.data?.data?.conversations || [];
      setConversations(convList);
      
      // Auto select first conversation ONLY on desktop screens (>= 768px)
      if (!selectedUserParam && convList.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
        selectConversation(convList[0].partner_username);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await api.get('/users/suggestions');
      setSuggestedUsers(res.data?.data?.users || []);
    } catch {}
  };

  const loadMessagesForUser = async (username) => {
    try {
      setLoadingMessages(true);
      const res = await api.get(`/users/messages/${username}`);
      setActivePartner(res.data?.data?.partner || { username });
      setMessages(res.data?.data?.messages || []);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const selectConversation = (username) => {
    setSearchParams({ u: username });
  };

  // ─── Typing Emission Logic ────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    setMessageText(val);

    const socket = getSocket();
    if (!socket || !activePartner?.username) return;

    if (val.trim()) {
      if (!hasEmittedTypingRef.current) {
        socket.emit('typing', {
          recipientUsername: activePartner.username,
          isTyping: true
        });
        hasEmittedTypingRef.current = true;
      }

      // Reset auto-stop typing timer (2.5 seconds)
      if (typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
      typingEmitTimerRef.current = setTimeout(() => {
        socket.emit('typing', {
          recipientUsername: activePartner.username,
          isTyping: false
        });
        hasEmittedTypingRef.current = false;
      }, 2500);
    } else {
      // Empty input
      if (hasEmittedTypingRef.current) {
        if (typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
        socket.emit('typing', {
          recipientUsername: activePartner.username,
          isTyping: false
        });
        hasEmittedTypingRef.current = false;
      }
    }
  };

  const handleInputBlur = () => {
    const socket = getSocket();
    if (socket && activePartner?.username && hasEmittedTypingRef.current) {
      if (typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
      socket.emit('typing', {
        recipientUsername: activePartner.username,
        isTyping: false
      });
      hasEmittedTypingRef.current = false;
    }
  };

  const handleSendMessage = async (e, customText = null) => {
    e?.preventDefault();
    const textToSend = (customText !== null ? customText : messageText).trim();
    if (!textToSend || !activePartner?.username || isSending) return;

    // Immediately stop typing indicator
    const socket = getSocket();
    if (socket && hasEmittedTypingRef.current) {
      if (typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
      socket.emit('typing', {
        recipientUsername: activePartner.username,
        isTyping: false
      });
      hasEmittedTypingRef.current = false;
    }

    setMessageText('');

    // Optimistic message UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      content: textToSend,
      is_mine: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      setIsSending(true);
      const res = await api.post(`/users/messages/${activePartner.username}`, { content: textToSend });
      const realMsg = res.data?.data?.message;
      if (realMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
        fetchConversations();
        window.dispatchEvent(new Event('refresh-notifications'));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const q = conversationFilter.toLowerCase().trim();
    if (!q) return true;
    return (
      c.partner_username?.toLowerCase().includes(q) ||
      c.partner_name?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  });

  const isPartnerOnline = activePartner?.username
    ? onlineUsers.has(activePartner.username.toLowerCase())
    : false;

  return (
    <AppShell 
      rightSidebar={false} 
      hideMobileNav={Boolean(selectedUserParam)} 
      noBottomPadding={true}
    >
      <div className="flex h-[100dvh] md:h-screen bg-white overflow-hidden relative">
        
        {/* ── Left Column: Conversation List ── */}
        <div className={`w-full md:w-[320px] lg:w-[380px] border-r border-[#EFF3F4] flex flex-col h-full bg-white z-10 ${
          selectedUserParam ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-3.5 border-b border-[#EFF3F4] flex items-center justify-between bg-white/90 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              {currentUser?.username ? (
                <button
                  onClick={() => window.dispatchEvent(new Event('open-drawer'))}
                  className="md:hidden w-8 h-8 rounded-full bg-gray-200 overflow-hidden active:scale-95 transition-transform flex-shrink-0"
                  title="Open menu"
                >
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`}
                    alt="me"
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <button
                  onClick={() => navigate(-1)}
                  className="md:hidden p-1.5 -ml-1 text-[#536471] hover:text-[#0F1419] rounded-full hover:bg-gray-100 transition-colors"
                  title="Go back"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h1 className="text-[20px] font-black text-[#0F1419]">Messages</h1>
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 rounded-full hover:bg-[#7C3AED]/10 text-[#7C3AED] transition-all active:scale-95 flex items-center gap-1.5"
              title="New message"
            >
              <PlusCircle size={22} />
            </button>
          </div>

          {/* Search Bar for Conversations */}
          <div className="px-3 py-2 border-b border-[#EFF3F4] bg-white">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3 text-[#536471]" />
              <input
                type="text"
                placeholder="Search Direct Messages..."
                value={conversationFilter}
                onChange={(e) => setConversationFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#F0F3F4] hover:bg-[#E7ECF0] focus:bg-white text-[#0F1419] placeholder:text-[#536471] rounded-full text-[13.5px] border border-transparent focus:border-[#7C3AED] outline-none transition-all"
              />
              {conversationFilter && (
                <button
                  onClick={() => setConversationFilter('')}
                  className="absolute right-2.5 text-[#536471] hover:text-[#0F1419] p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#EFF3F4] pb-[60px] md:pb-0">
            {loadingConversations ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <div className="w-7 h-7 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] text-[#536471]">Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail size={22} />
                </div>
                <h3 className="font-bold text-[17px] text-[#0F1419]">
                  {conversationFilter ? 'No chats match your search' : 'Welcome to your inbox!'}
                </h3>
                <p className="text-[13px] text-[#536471] mt-1 mb-4">
                  {conversationFilter ? 'Try a different username or search term.' : 'Send private messages and connect with other developers on SOLITX.'}
                </p>
                <button
                  onClick={() => {
                    setConversationFilter('');
                    setShowNewChatModal(true);
                  }}
                  className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full transition-all active:scale-95 shadow-sm"
                >
                  {conversationFilter ? 'Start New Chat' : 'Write a message'}
                </button>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = selectedUserParam === c.partner_username;
                const isUserActive = onlineUsers.has(c.partner_username?.toLowerCase());

                return (
                  <div
                    key={c.partner_id || c.partner_username}
                    onClick={() => selectConversation(c.partner_username)}
                    className={`flex items-center gap-3 p-3.5 hover:bg-[#F7F9F9] cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#7C3AED]/10 border-l-4 border-[#7C3AED]' : ''
                    }`}
                  >
                    {/* Avatar with Online Status Indicator */}
                    <div className="relative w-11 h-11 rounded-full bg-gray-200 flex-shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.partner_username}`}
                          alt={c.partner_username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {isUserActive && (
                        <span
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-500/20"
                          title="Online now"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-[15px] text-[#0F1419] truncate">
                            {c.partner_name || c.partner_username}
                          </span>
                        </div>
                        <span className="text-[12px] text-[#536471] flex-shrink-0">
                          {formatRelativeTime(c.last_message_at)}
                        </span>
                      </div>
                      <p className="text-[13px] text-[#536471] truncate mt-0.5">
                        {c.last_message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Column: Active Chat Thread ── */}
        <div className={`flex-1 flex flex-col h-full bg-white relative ${
          !selectedUserParam ? 'hidden md:flex' : 'flex'
        }`}>
          {selectedUserParam && activePartner ? (
            <>
              {/* Chat Header with Status and Navigation */}
              <div className="px-3.5 py-2.5 sm:py-3 border-b border-[#EFF3F4] flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Back to Conversations Button (prominent on mobile) */}
                  <button
                    onClick={() => setSearchParams({})}
                    className="p-2 -ml-1 text-[#536471] hover:text-[#0F1419] rounded-full hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
                    title="Back to conversations"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  {/* Partner Avatar + Real-Time Online Badge */}
                  <div 
                    onClick={() => navigate(`/profile/${activePartner.username}`)}
                    className="relative w-10 h-10 rounded-full bg-gray-200 cursor-pointer flex-shrink-0 ring-2 ring-transparent hover:ring-[#7C3AED]/30 transition-all"
                  >
                    <div className="w-full h-full rounded-full overflow-hidden">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                        alt={activePartner.username}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span 
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors duration-200 ${
                        isPartnerOnline ? 'bg-emerald-500 ring-1 ring-emerald-500/20' : 'bg-gray-300'
                      }`}
                      title={isPartnerOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  {/* Partner Name, Handle & Typing/Online Status */}
                  <div 
                    onClick={() => navigate(`/profile/${activePartner.username}`)}
                    className="cursor-pointer min-w-0"
                  >
                    <h3 className="font-bold text-[15px] sm:text-[16px] text-[#0F1419] leading-tight hover:underline truncate">
                      {activePartner.name || activePartner.username}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 mt-0.5 leading-none">
                      <span className="text-[12px] text-[#536471] truncate">@{activePartner.username}</span>
                      <span className="text-[#CFD9DE] text-[11px]">•</span>

                      {/* Dynamic Online & Typing Indicator in Header */}
                      {isPartnerTyping ? (
                        <span className="text-[#7C3AED] font-semibold text-[12px] flex items-center gap-1.5 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                          typing...
                        </span>
                      ) : isPartnerOnline ? (
                        <span className="text-emerald-600 font-medium text-[12px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="text-[#536471] text-[12px]">Offline</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Header Navigation / Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => loadMessagesForUser(activePartner.username)}
                    className="p-2 text-[#536471] hover:text-[#7C3AED] rounded-full hover:bg-purple-50 transition-colors"
                    title="Refresh chat"
                  >
                    <RefreshCw size={17} className={loadingMessages ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => navigate(`/profile/${activePartner.username}`)}
                    className="p-2 text-[#536471] hover:text-[#7C3AED] rounded-full hover:bg-purple-50 transition-colors"
                    title="View Profile"
                  >
                    <User size={18} />
                  </button>
                </div>
              </div>

              {/* Messages History */}
              <div 
                ref={chatScrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 space-y-3 bg-[#F8FAFC] relative"
              >
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-7 h-7 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#536471]">
                    <div className="w-14 h-14 bg-purple-100 text-[#7C3AED] rounded-full flex items-center justify-center mb-3">
                      <Sparkles size={24} />
                    </div>
                    <p className="font-bold text-[17px] text-[#0F1419]">Start a conversation</p>
                    <p className="text-[13px] text-[#536471] mt-1 max-w-xs mb-4">
                      Say hello to @{activePartner.username} to kick off your conversation!
                    </p>

                    {/* Quick Greeting Chips */}
                    <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                      {QUICK_GREETINGS.map((greet) => (
                        <button
                          key={greet}
                          onClick={(e) => handleSendMessage(e, greet)}
                          className="px-3 py-1.5 bg-white hover:bg-purple-50 text-[#7C3AED] border border-[#7C3AED]/30 rounded-full text-[12.5px] font-medium transition-all active:scale-95 shadow-2xs"
                        >
                          {greet}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.is_mine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[82%] sm:max-w-[68%] px-4 py-2.5 rounded-2xl text-[14.5px] sm:text-[15px] leading-relaxed break-words shadow-2xs transition-all ${
                          m.is_mine
                            ? 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-br-xs'
                            : 'bg-white text-[#0F1419] border border-[#E2E8F0] rounded-bl-xs'
                        }`}
                      >
                        {m.content}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#536471] mt-1 px-1">
                        <span>{formatRelativeTime(m.created_at)}</span>
                        {m.is_mine && <CheckCheck size={13} className="text-[#7C3AED]" />}
                      </div>
                    </div>
                  ))
                )}

                {/* ── Real-Time Typing Indicator Bubble in Stream ── */}
                {isPartnerTyping && (
                  <div className="flex items-end gap-2 my-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 shadow-2xs">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activePartner.username}`}
                        alt={activePartner.username}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="bg-white border border-[#E2E8F0] px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-bounce" />
                    </div>
                    <span className="text-[11px] text-[#536471] italic pb-1">
                      typing...
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Floating Scroll to Bottom Arrow Button */}
              {showScrollBottom && (
                <button
                  onClick={() => scrollToBottom('smooth')}
                  className="absolute bottom-20 right-4 sm:right-6 bg-white/95 text-[#7C3AED] hover:text-[#6D28D9] border border-[#EFF3F4] p-2.5 rounded-full shadow-lg transition-all animate-in fade-in zoom-in hover:scale-105 active:scale-95 z-20 flex items-center gap-1.5"
                  title="Scroll to latest message"
                >
                  <ChevronDown size={19} />
                </button>
              )}

              {/* Message Composer Input */}
              <div className="border-t border-[#EFF3F4] bg-white p-2.5 sm:p-3 sticky bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 max-w-full"
                >
                  <input
                    type="text"
                    placeholder={`Message @${activePartner.username}...`}
                    value={messageText}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className="flex-1 py-2.5 px-4 bg-[#F0F3F4] text-[#0F1419] placeholder:text-[#536471] rounded-full text-[14.5px] sm:text-[15px] focus:bg-white border border-transparent focus:border-[#7C3AED] outline-none transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || isSending}
                    className="w-10 h-10 flex items-center justify-center bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white rounded-full transition-all active:scale-95 shadow-sm flex-shrink-0"
                    title="Send message"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-16 h-16 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mb-3">
                <Mail size={30} />
              </div>
              <h2 className="text-[22px] font-black text-[#0F1419]">Select a conversation</h2>
              <p className="text-[#536471] text-[15px] max-w-sm mt-1 mb-5">
                Choose from your existing conversations on the left, or send a new direct message.
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full shadow-sm transition-all active:scale-95"
              >
                New Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── New Chat Modal with Live Online Status ── */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[420px] p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFF3F4]">
              <h3 className="font-extrabold text-[18px] text-[#0F1419]">New Direct Message</h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1 text-[#536471] hover:text-[#0F1419] rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 relative">
              <Search size={16} className="absolute left-3 top-3 text-[#536471]" />
              <input
                type="text"
                placeholder="Search username to message..."
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F0F3F4] text-[#0F1419] rounded-xl text-[14px] outline-none focus:border-[#7C3AED] border border-transparent transition-all"
              />
            </div>

            <div className="flex-1 overflow-y-auto mt-3 divide-y divide-[#EFF3F4]">
              {suggestedUsers
                .filter((u) => u.username.toLowerCase().includes(searchUserQuery.toLowerCase()))
                .map((u) => {
                  const isUserActive = onlineUsers.has(u.username?.toLowerCase());
                  return (
                    <div
                      key={u.id || u.username}
                      onClick={() => {
                        selectConversation(u.username);
                        setShowNewChatModal(false);
                      }}
                      className="flex items-center justify-between p-3 hover:bg-[#F7F9F9] cursor-pointer rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 rounded-full bg-gray-200 flex-shrink-0">
                          <div className="w-full h-full rounded-full overflow-hidden">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                              alt={u.username}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {isUserActive && (
                            <span 
                              className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-500/20"
                              title="Online now"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[15px] text-[#0F1419] group-hover:text-[#7C3AED] transition-colors truncate">
                            {u.name || u.username}
                          </p>
                          <p className="text-[12px] text-[#536471] truncate max-w-[200px]">@{u.username}</p>
                        </div>
                      </div>

                      {isUserActive && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[11px] font-semibold rounded-full border border-emerald-200 flex-shrink-0">
                          Online
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Messages;
