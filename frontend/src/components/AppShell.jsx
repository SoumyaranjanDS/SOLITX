import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Bell, 
  Mail, 
  Bookmark, 
  User, 
  SquarePen, 
  List, 
  Users, 
  MoreHorizontal, 
  Star, 
  LogOut, 
  LogIn, 
  X,
  Heart,
  MessageCircle,
  CornerDownRight,
  ThumbsUp,
  UserPlus
} from 'lucide-react';
import ComposeModal from './ComposeModal';
import api from '../api';
import { getSocket, disconnectSocket } from '../socket';
import { getAvatarUrl } from '../utils/avatar';

// ─── SOLITX Logo ──────────────────────────────────────────────────────────────
export const SolitxLogo = ({ size = 30, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="solitx-nav-spine" x1="10%" y1="10%" x2="90%" y2="90%">
        <stop offset="0%" stopColor="#A855F7" />
        <stop offset="50%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
      <linearGradient id="solitx-nav-cross" x1="85%" y1="15%" x2="15%" y2="85%">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#818CF8" />
      </linearGradient>
    </defs>
    {/* S Ribbon */}
    <path 
      d="M22.5 8 H12 C9 8 6.5 10.4 6.5 13.5 C6.5 16 8.1 18.1 10.4 18.7 L19.6 21.2 C21.4 21.7 22.5 23.2 22.5 24.9 C22.5 26.8 20.9 28.5 19 28.5 H8" 
      stroke="url(#solitx-nav-spine)" 
      strokeWidth="2.8" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    {/* Counter X Slash Upper */}
    <path 
      d="M23 9 L17.5 14.5" 
      stroke="url(#solitx-nav-cross)" 
      strokeWidth="2.8" 
      strokeLinecap="round" 
    />
    {/* Counter X Slash Lower */}
    <path 
      d="M14.5 17.5 L9 23" 
      stroke="url(#solitx-nav-cross)" 
      strokeWidth="2.8" 
      strokeLinecap="round" 
    />
  </svg>
);

// ─── Nav Item ─────────────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick, badgeCount }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-2.5 py-2 rounded-full w-fit xl:w-full transition-all duration-150
      ${active ? 'font-bold text-[#0F1419]' : 'text-[#536471] hover:bg-[#F7F9F9] hover:text-[#0F1419]'}`}
  >
    <div className="relative flex-shrink-0">
      <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
      {badgeCount > 0 && (
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-[#7C3AED] text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm border-2 border-white leading-none animate-in zoom-in-75">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </div>
    <span className={`hidden xl:block text-[16px] ${active ? 'font-bold' : 'font-normal'}`}>{label}</span>
  </button>
);

// ─── In-App Toast Notification ───────────────────────────────────────────────
const NotificationToast = ({ notification, onClose, onClick }) => {
  if (!notification) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'post_like':
        return <Heart size={13} className="text-red-500 fill-red-500" />;
      case 'comment_like':
        return <ThumbsUp size={13} className="text-amber-500 fill-amber-500" />;
      case 'post_comment':
        return <MessageCircle size={13} className="text-blue-500 fill-blue-500" />;
      case 'comment_reply':
        return <CornerDownRight size={13} className="text-purple-600" />;
      case 'message':
        return <Mail size={13} className="text-[#7C3AED]" />;
      case 'follow':
        return <UserPlus size={13} className="text-emerald-500" />;
      default:
        return <Bell size={13} className="text-[#7C3AED]" />;
    }
  };

  const getTitle = (n) => {
    const actor = n.actor_username || 'Someone';
    switch (n.type) {
      case 'post_like':
        return `${actor} liked your post`;
      case 'comment_like':
        return `${actor} liked your comment`;
      case 'post_comment':
        return `${actor} commented on your post`;
      case 'comment_reply':
        return `${actor} replied to your comment`;
      case 'message':
        return `New message from ${actor}`;
      case 'follow':
        return `${actor} followed you`;
      default:
        return `New notification from ${actor}`;
    }
  };

  return (
    <div
      onClick={onClick}
      className="fixed top-5 right-5 z-[100] max-w-sm w-[92vw] sm:w-[350px] bg-white/95 backdrop-blur-md border border-[#7C3AED]/25 rounded-2xl shadow-[0_10px_35px_-4px_rgba(124,58,237,0.3)] p-3.5 flex items-start gap-3 cursor-pointer hover:border-[#7C3AED]/50 transition-all duration-200 animate-in slide-in-from-top-3 fade-in group"
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-purple-100 overflow-hidden ring-2 ring-purple-100">
          <img
            src={getAvatarUrl(notification.actor_avatar_url || notification.actor_username)}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center">
          {getIcon(notification.type)}
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <p className="text-[14px] font-bold text-[#0F1419] leading-snug truncate">
          {getTitle(notification)}
        </p>
        {(notification.message_content || notification.comment_content || notification.post_content) && (
          <p className="text-[12px] text-[#536471] line-clamp-1 mt-0.5">
            "{notification.message_content || notification.comment_content || notification.post_content}"
          </p>
        )}
        <span className="text-[11px] font-semibold text-[#7C3AED] mt-1 inline-block group-hover:underline">
          Tap to view
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="text-[#536471] hover:text-[#0F1419] p-1 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
};

// ─── App Shell ────────────────────────────────────────────────────────────────
const AppShell = ({ children, rightSidebar = true, hideMobileNav = false, noBottomPadding = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleUserUpdate = () => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener('user-updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate);

    // Background sync fresh user profile (avatar_url, banner_url, name) from backend
    const currentUsername = user?.username;
    if (currentUsername) {
      api.get(`/users/${currentUsername}`).then((res) => {
        const fresh = res.data?.data?.user;
        if (fresh) {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          if (fresh.avatar_url !== stored.avatar_url || fresh.banner_url !== stored.banner_url || fresh.name !== stored.name) {
            const merged = { ...stored, ...fresh };
            localStorage.setItem('user', JSON.stringify(merged));
            setUser(merged);
          }
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('user-updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, []);

  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [activeToast, setActiveToast] = useState(null);
  const prevCountsRef = useRef({ notifs: null, messages: null });
  const toastTimerRef = useRef(null);

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  const showToast = (notif) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveToast(notif);
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 4500);
  };

  const fetchUnreadCounts = async () => {
    if (!user?.username) return;
    try {
      const res = await api.get('/users/notifications/unread-count');
      const data = res.data?.data || {};
      const newNotifs = data.unread_notifications || 0;
      const newMessages = data.unread_messages || 0;

      // Check if new notifications arrived (and not initial fetch)
      if (
        prevCountsRef.current.notifs !== null &&
        (newNotifs > prevCountsRef.current.notifs || newMessages > prevCountsRef.current.messages)
      ) {
        // Fetch the newest unread notification to show floating toast
        try {
          const latestRes = await api.get('/users/notifications?limit=1');
          const latest = latestRes.data?.data?.notifications?.[0];
          if (latest && !latest.is_read) {
            showToast(latest);
          }
        } catch (_) {}
      }

      prevCountsRef.current = { notifs: newNotifs, messages: newMessages };
      setUnreadNotifsCount(newNotifs);
      setUnreadMessagesCount(newMessages);
    } catch (_) {}
  };

  const fetchTrending = () => {
    api.get('/posts/trending')
      .then(res => setTrendingTopics(res.data?.data?.trends || []))
      .catch(() => {})
      .finally(() => setLoadingTrending(false));
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Explore', path: '/explore' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badgeCount: unreadNotifsCount },
    { icon: Mail, label: 'Messages', path: '/messages', badgeCount: unreadMessagesCount },
    { icon: Star, label: 'Premium', path: '/premium' },
    { icon: List, label: 'Lists', path: '/lists' },
    { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
    { icon: Users, label: 'Communities', path: '/communities' },
    { icon: User, label: 'Profile', path: user?.username ? `/profile/${user.username}` : '/auth' },
  ];

  const touchStartXRef = useRef(0);

  useEffect(() => {
    const handleOpen = () => setIsDrawerOpen(true);
    const handleClose = () => setIsDrawerOpen(false);
    const handleOpenCompose = () => setIsComposeModalOpen(true);
    const handleRefreshNotifs = () => fetchUnreadCounts();
    const handlePostCreated = () => fetchTrending();

    window.addEventListener('open-drawer', handleOpen);
    window.addEventListener('close-drawer', handleClose);
    window.addEventListener('open-compose', handleOpenCompose);
    window.addEventListener('refresh-notifications', handleRefreshNotifs);
    window.addEventListener('post-created', handlePostCreated);

    // Initial fetch of unread counts & live trending
    fetchUnreadCounts();
    fetchTrending();

    // 10-second polling interval for real-time notification indicator updates
    const pollInterval = setInterval(() => {
      fetchUnreadCounts();
    }, 10000);

    // Connect to WebSocket and listen for real-time messages & notification events
    const socket = getSocket();
    const handleLiveMsg = (msg) => {
      if (!msg) return;
      const params = new URLSearchParams(window.location.search);
      const activeChatUser = params.get('u');
      const isCurrentChat = window.location.pathname.startsWith('/messages') && 
        activeChatUser?.toLowerCase() === msg.sender_username?.toLowerCase();

      if (!isCurrentChat) {
        showToast({
          type: 'message',
          actor_username: msg.sender_username,
          message_content: msg.content
        });
        fetchUnreadCounts();
      }
    };

    if (socket) {
      socket.on('receive_message', handleLiveMsg);
    }

    // Fetch Who to follow suggestions
    api.get('/users/suggestions')
      .then(res => setSuggestedUsers(res.data?.data?.users || []))
      .catch(() => {});

    return () => {
      window.removeEventListener('open-drawer', handleOpen);
      window.removeEventListener('close-drawer', handleClose);
      window.removeEventListener('open-compose', handleOpenCompose);
      window.removeEventListener('refresh-notifications', handleRefreshNotifs);
      window.removeEventListener('post-created', handlePostCreated);
      clearInterval(pollInterval);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (socket) {
        socket.off('receive_message', handleLiveMsg);
      }
    };
  }, []);

  // Lock body scroll and handle Escape key when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawerOpen]);

  const handleToastClick = () => {
    if (!activeToast) return;
    const n = activeToast;
    setActiveToast(null);
    if (n.type === 'message') {
      navigate(`/messages?u=${n.actor_username}`);
    } else if (n.post_id) {
      navigate(`/post/${n.post_id}`);
    } else if (n.type === 'follow') {
      navigate(`/profile/${n.actor_username}`);
    } else {
      navigate('/notifications');
    }
  };

  const handleFollowSuggestion = async (targetUsername) => {
    try {
      const res = await api.post(`/users/${targetUsername}/follow`);
      if (res.data?.data) {
        setSuggestedUsers(prev =>
          prev.map(u => u.username === targetUsername ? { ...u, is_following: res.data.data.isFollowing } : u)
        );
        fetchUnreadCounts();
      }
    } catch (err) { }
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  const handleGoHome = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isPathActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-white flex justify-center">

      {/* Floating In-App Notification Toast */}
      <NotificationToast
        notification={activeToast}
        onClose={() => setActiveToast(null)}
        onClick={handleToastClick}
      />

      {/* Left Sidebar */}
      <aside className="hidden md:flex flex-col w-[60px] xl:w-[240px] h-screen sticky top-0 pt-1 px-1.5 xl:px-3 overflow-y-auto flex-shrink-0">

        {/* Logo */}
        <div
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F7F9F9] cursor-pointer transition-colors mb-0.5"
          onClick={handleGoHome}
          title="SOLITX Home"
        >
          <SolitxLogo size={24} />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map(item => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={isPathActive(item.path)}
              onClick={() => {
                if (item.path === '/') handleGoHome();
                else navigate(item.path);
              }}
              badgeCount={item.badgeCount}
            />
          ))}
        </nav>

        {/* Post Button */}
        <div className="mt-3 mb-3 xl:pr-2">
          <button
            onClick={() => {
              if (user?.username) {
                window.dispatchEvent(new Event('open-compose'));
              } else {
                navigate('/auth');
              }
            }}
            className="w-9 h-9 xl:w-full xl:h-auto xl:py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full transition-all flex items-center justify-center gap-2 shadow-sm active:scale-98"
          >
            <SquarePen size={18} strokeWidth={2.2} className="xl:hidden" />
            <span className="hidden xl:block">Post</span>
          </button>
        </div>

        {/* Logout / Sign in Button (Desktop) */}
        <div className="mb-2 mt-auto xl:pr-2">
          {user?.username ? (
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              className="flex items-center gap-3 px-2.5 py-2 rounded-full w-fit xl:w-full transition-all duration-150 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <div className="relative flex-shrink-0">
                <LogOut size={20} strokeWidth={2} />
              </div>
              <span className="hidden xl:block text-[16px] font-bold">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-3 px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full w-fit xl:w-full transition-all duration-150 font-bold shadow-sm"
            >
              <LogIn size={18} />
              <span className="hidden xl:block text-[15px]">Sign in</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main + Right */}
      <div className="flex flex-1 max-w-[990px] min-w-0">

        {/* Center */}
        <main className={`flex-1 min-w-0 min-h-screen border-x border-[#EFF3F4] ${noBottomPadding ? 'pb-0' : 'pb-20 md:pb-0'}`}>
          {children}
        </main>

        {/* Right Sidebar */}
        {rightSidebar && (
          <aside className="hidden lg:block w-[360px] pl-8 pt-3 flex-shrink-0">
            <div className="sticky top-3 flex flex-col gap-4">

              {/* Search */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (sidebarSearch.trim()) {
                    navigate(`/explore?q=${encodeURIComponent(sidebarSearch.trim())}`);
                  } else {
                    navigate('/explore');
                  }
                }}
                className="flex items-center gap-3 bg-[#EFF3F4] hover:bg-[#E7ECF0] border border-transparent focus-within:bg-white focus-within:border-[#7C3AED] rounded-full px-4 py-2.5 transition-all"
              >
                <Search size={18} className="text-[#536471] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search SOLITX"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="bg-transparent border-none focus:outline-none w-full text-[#0F1419] placeholder:text-[#536471] text-[15px]"
                />
              </form>

              {/* Who to follow */}
              <div className="bg-[#F7F9F9] rounded-2xl overflow-hidden">
                <h2 className="font-extrabold text-[19px] text-[#0F1419] px-4 pt-4 pb-3">Who to follow</h2>
                {suggestedUsers.length === 0 ? (
                  <p className="px-4 py-3 text-[14px] text-[#536471]">No recommendations available right now.</p>
                ) : (
                  suggestedUsers.map(person => (
                    <div
                      key={person.id || person.username}
                      onClick={() => navigate(`/profile/${person.username}`)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-[#E7ECF0] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                          <img src={getAvatarUrl(person)} alt={person.username} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[15px] text-[#0F1419] truncate">{person.username}</p>
                          <p className="text-[14px] text-[#536471] truncate">@{person.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowSuggestion(person.username);
                        }}
                        className={`px-4 py-1.5 font-bold text-[14px] rounded-full transition-colors flex-shrink-0 ml-2 ${person.is_following
                            ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                            : 'bg-[#0F1419] hover:bg-[#272c30] text-white'
                          }`}
                      >
                        {person.is_following ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Live Trends */}
              <div className="bg-[#F7F9F9] rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <h2 className="font-extrabold text-[19px] text-[#0F1419]">Trending</h2>
                  <span className="text-[11px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Live</span>
                </div>
                {loadingTrending ? (
                  <div className="px-4 py-3 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
                  </div>
                ) : trendingTopics.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <p className="text-[14px] font-bold text-[#0F1419]">No trending topics yet</p>
                    <p className="text-[12px] text-[#536471] mt-1 leading-relaxed">
                      Add a #hashtag in your post to start a live trend!
                    </p>
                  </div>
                ) : (
                  trendingTopics.slice(0, 5).map((item) => (
                    <div
                      key={item.tag}
                      onClick={() => navigate(`/explore?q=${encodeURIComponent(item.tag)}`)}
                      className="px-4 py-3 hover:bg-[#E7ECF0] cursor-pointer transition-colors flex items-start justify-between group"
                    >
                      <div>
                        <p className="text-[12px] text-[#536471]">#{item.rank} · Trending</p>
                        <p className="font-bold text-[15px] text-[#0F1419] mt-0.5 group-hover:text-[#7C3AED] transition-colors">{item.tag}</p>
                        <p className="text-[12px] text-[#536471] mt-0.5">{item.formatted_posts}</p>
                      </div>
                    </div>
                  ))
                )}
                {trendingTopics.length > 0 && (
                  <button
                    onClick={() => navigate('/explore')}
                    className="w-full px-4 py-3 text-[#7C3AED] hover:bg-[#E7ECF0] transition-colors text-[14px] text-left rounded-b-2xl font-bold"
                  >
                    Show more
                  </button>
                )}
              </div>

            </div>
          </aside>
        )}
      </div>

      {/* Mobile Bottom Nav & FAB (conditionally rendered) */}
      {!hideMobileNav && (
        <>
          <div className="md:hidden fixed bottom-0 left-0 right-0 h-[53px] bg-white/95 backdrop-blur-xl border-t border-[#EFF3F4] flex justify-around items-center z-30">
            {navItems.slice(0, 4).map(item => (
              <button
                key={item.path}
                onClick={() => {
                  if (item.path === '/') handleGoHome();
                  else navigate(item.path);
                }}
                className={`p-3 relative transition-colors ${isPathActive(item.path) ? 'text-[#0F1419]' : 'text-[#536471]'}`}
              >
                <div className="relative">
                  <item.icon size={24} strokeWidth={isPathActive(item.path) ? 2.5 : 1.8} />
                  {item.badgeCount > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-[16px] h-[16px] px-1 bg-[#7C3AED] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white leading-none">
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => window.dispatchEvent(new Event('open-compose'))}
            className="md:hidden fixed bottom-[64px] right-4 w-14 h-14 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(124,58,237,0.45)] z-20 transition-all active:scale-95 hover:scale-105"
            title="Create Post"
          >
            <SquarePen size={23} strokeWidth={2.2} />
          </button>
        </>
      )}

      {/* Mobile Sidebar Drawer with Opening & Closing Slide Animation */}
      <div 
        className={`md:hidden fixed inset-0 z-50 flex transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDrawerOpen 
            ? 'visible opacity-100 pointer-events-auto' 
            : 'invisible opacity-0 pointer-events-none delay-300'
        }`}
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen ? '' : undefined}
      >
        {/* Backdrop Fade In / Out */}
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
            isDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsDrawerOpen(false)}
        />

        {/* Drawer Content Slide In / Out */}
        <div 
          onTouchStart={(e) => { 
            touchStartXRef.current = e.touches[0].clientX; 
          }}
          onTouchEnd={(e) => {
            if (touchStartXRef.current && (touchStartXRef.current - e.changedTouches[0].clientX > 60)) {
              setIsDrawerOpen(false);
            }
          }}
          className={`relative w-[285px] max-w-[82%] bg-white h-full shadow-[0_0_50px_rgba(0,0,0,0.25)] flex flex-col overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header: Profile Info */}
          <div className="p-4 border-b border-[#EFF3F4]">
            {user?.username ? (
              <>
                <div className="flex justify-between items-start mb-2">
                  <div
                    onClick={() => { setIsDrawerOpen(false); navigate(`/profile/${user.username}`); }}
                    className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden cursor-pointer active:scale-95 transition-transform"
                  >
                    <img src={getAvatarUrl(user)} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={() => setIsDrawerOpen(false)} 
                    className="p-2 -mr-2 text-[#0F1419] hover:bg-[#F7F9F9] rounded-full active:scale-95 transition-all"
                    title="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div onClick={() => { setIsDrawerOpen(false); navigate(`/profile/${user.username}`); }} className="cursor-pointer">
                  <h3 className="font-bold text-[17px] text-[#0F1419] leading-tight">{user.name || user.username}</h3>
                  <p className="text-[15px] text-[#536471]">@{user.username}</p>
                </div>
                <div className="flex gap-4 mt-3 text-[14px]">
                  <div className="flex gap-1 hover:underline cursor-pointer"><span className="font-bold text-[#0F1419]">124</span><span className="text-[#536471]">Following</span></div>
                  <div className="flex gap-1 hover:underline cursor-pointer"><span className="font-bold text-[#0F1419]">1,402</span><span className="text-[#536471]">Followers</span></div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-1">
                  <SolitxLogo size={28} />
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 -mr-2 text-[#0F1419] hover:bg-[#F7F9F9] rounded-full active:scale-95 transition-all">
                    <X size={20} />
                  </button>
                </div>
                <p className="text-[14px] text-[#536471]">Join the developer community on SOLITX.</p>
                <button
                  onClick={() => { setIsDrawerOpen(false); navigate('/auth'); }}
                  className="w-full mt-2 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full shadow-sm active:scale-98 transition-all"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>

          {/* Drawer Nav Items */}
          <nav className="flex-1 py-2">
            {navItems.map(item => (
              <button
                key={item.label}
                onClick={() => { 
                  setIsDrawerOpen(false); 
                  navigate(item.path); 
                }}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#F7F9F9] active:bg-[#EFF3F4] transition-colors text-left"
              >
                <item.icon size={22} className="text-[#0F1419]" strokeWidth={2} />
                <span className="font-bold text-[17px] text-[#0F1419]">{item.label}</span>
                {item.badgeCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-[20px] px-1.5 bg-[#7C3AED] text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Logout Section */}
          {user?.username && (
            <div className="p-4 border-t border-[#EFF3F4]">
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[15px] rounded-full transition-colors border border-red-200 active:scale-98"
              >
                Log out @{user.username}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsLogoutModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-[320px] p-8 text-center shadow-xl">
            <h2 className="font-bold text-[20px] text-[#0F1419] mb-2">Log out of SOLITX?</h2>
            <p className="text-[#536471] text-[15px] mb-6 leading-relaxed">
              You can always log back in at any time. If you just want to switch accounts, you can do that by adding an existing account.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-[#0F1419] hover:bg-[#272c30] text-white font-bold text-[15px] rounded-full transition-colors"
              >
                Log out
              </button>
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="w-full py-3 bg-white hover:bg-[#E7ECF0] text-[#0F1419] font-bold text-[15px] rounded-full transition-colors border border-[#CFD9DE]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Tweet Modal */}
      <ComposeModal
        isOpen={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        onPostCreated={(newPost) => {
          window.dispatchEvent(new CustomEvent('post-created', { detail: newPost }));
        }}
      />
    </div>
  );
};

export default AppShell;
