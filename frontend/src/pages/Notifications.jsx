import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  CheckCheck, 
  Sparkles, 
  Mail,
  CornerDownRight,
  ThumbsUp,
  Trash2,
  RefreshCw,
  ArrowRight,
  ListFilter,
  Users
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { formatRelativeTime } from '../components/PostCard';
import api from '../api';
import { getAvatarUrl } from '../utils/avatar';

const Notifications = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'replies' | 'likes' | 'messages' | 'follows'
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      if (!currentUser?.username) {
        setNotifications([]);
        return;
      }
      const res = await api.get('/users/notifications');
      setNotifications(res.data?.data?.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setIsMarkingRead(true);
      await api.put('/users/notifications/read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      // Dispatch event to clear sidebar badge immediately
      window.dispatchEvent(new Event('refresh-notifications'));
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await api.delete(`/users/notifications/${id}`);
      window.dispatchEvent(new Event('refresh-notifications'));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Filter notifications based on tab
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'replies') {
      return n.type === 'comment_reply' || n.type === 'post_comment' || n.type === 'reply';
    }
    if (activeTab === 'likes') {
      return n.type === 'post_like' || n.type === 'comment_like' || n.type === 'like';
    }
    if (activeTab === 'messages') {
      return n.type === 'message';
    }
    if (activeTab === 'follows') {
      return n.type === 'follow' || n.type === 'list_member_added' || n.type === 'community_member_added' || n.type === 'community_joined';
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {currentUser?.username && (
                <button
                  onClick={() => window.dispatchEvent(new Event('open-drawer'))}
                  className="md:hidden w-8 h-8 rounded-full bg-gray-200 overflow-hidden active:scale-95 transition-transform flex-shrink-0"
                  title="Open menu"
                >
                  <img
                    src={getAvatarUrl(currentUser)}
                    alt="me"
                    className="w-full h-full object-cover"
                  />
                </button>
              )}
              <div>
                <h1 className="text-[19px] sm:text-[20px] font-black text-[#0F1419]">Notifications</h1>
                <p className="text-[13px] text-[#536471]">
                  {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setRefreshing(true);
                  fetchNotifications();
                }}
                disabled={refreshing}
                className="p-2 text-[#536471] hover:text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
                title="Refresh notifications"
              >
                <RefreshCw size={17} className={refreshing ? 'animate-spin text-[#7C3AED]' : ''} />
              </button>

              {notifications.length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isMarkingRead || unreadCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold text-[#7C3AED] hover:bg-[#7C3AED]/10 disabled:opacity-40 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={16} />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Event Filter Tabs */}
          <div className="flex overflow-x-auto no-scrollbar border-t border-[#EFF3F4]">
            {[
              { id: 'all', label: 'All' },
              { id: 'replies', label: 'Replies & Comments' },
              { id: 'likes', label: 'Likes' },
              { id: 'messages', label: 'Messages' },
              { id: 'follows', label: 'Follows' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-3 text-[14px] sm:text-[15px] font-bold text-center whitespace-nowrap transition-colors relative hover:bg-[#F7F9F9] ${
                  activeTab === tab.id ? 'text-[#0F1419]' : 'text-[#536471]'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#7C3AED] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-[14px] text-[#536471]">Checking notifications...</p>
          </div>
        ) : !currentUser?.username ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell size={26} />
            </div>
            <h3 className="text-[19px] font-bold text-[#0F1419]">Stay in the loop</h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1 mb-4">
              Sign in to see likes, replies, comments, follows, and direct messages in real time.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full shadow-sm transition-all"
            >
              Sign in to SOLITX
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-[#F7F9F9] text-[#536471] rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles size={26} />
            </div>
            <h3 className="text-[19px] font-bold text-[#0F1419]">
              {activeTab === 'replies'
                ? 'No replies or comments yet'
                : activeTab === 'likes'
                ? 'No likes yet'
                : activeTab === 'messages'
                ? 'No message notifications'
                : activeTab === 'follows'
                ? 'No new followers yet'
                : 'Nothing to see here — yet'}
            </h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1">
              Engage with other developers, like posts, reply to comments, or share technical insights to spark conversations!
            </p>
            <button
              onClick={() => navigate('/explore')}
              className="mt-4 px-5 py-2 bg-[#0F1419] hover:bg-[#272C30] text-white text-[14px] font-bold rounded-full transition-colors"
            >
              Explore Discussions
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#EFF3F4]">
            {filteredNotifications.map((notif) => {
              const isPostLike = notif.type === 'post_like' || notif.type === 'like';
              const isPostComment = notif.type === 'post_comment';
              const isCommentReply = notif.type === 'comment_reply' || notif.type === 'reply';
              const isCommentLike = notif.type === 'comment_like';
              const isMessage = notif.type === 'message';
              const isFollow = notif.type === 'follow';
              const isListAdd = notif.type === 'list_member_added';
              const isCommunityAdd = notif.type === 'community_member_added';
              const isCommunityJoin = notif.type === 'community_joined';

              // Navigation target
              const handleNotificationClick = () => {
                if (isMessage) {
                  navigate(`/messages?u=${notif.actor_username}`);
                } else if (isListAdd) {
                  navigate('/lists');
                } else if (isCommunityAdd || isCommunityJoin) {
                  navigate('/communities');
                } else if (notif.post_id) {
                  navigate(`/post/${notif.post_id}`);
                } else if (notif.actor_username) {
                  navigate(`/profile/${notif.actor_username}`);
                }
              };

              return (
                <div
                  key={notif.id}
                  onClick={handleNotificationClick}
                  className={`p-4 flex gap-3.5 hover:bg-[#F7F9F9] transition-colors cursor-pointer group relative ${
                    !notif.is_read ? 'bg-[#7C3AED]/5' : ''
                  }`}
                >
                  {/* Left Activity Icon */}
                  <div className="pt-0.5 flex-shrink-0">
                    {isPostLike && (
                      <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                        <Heart size={18} fill="#E11D48" className="text-rose-600" />
                      </div>
                    )}
                    {isPostComment && (
                      <div className="w-9 h-9 rounded-full bg-purple-100 text-[#7C3AED] flex items-center justify-center shadow-xs">
                        <MessageCircle size={18} />
                      </div>
                    )}
                    {isCommentReply && (
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                        <CornerDownRight size={18} />
                      </div>
                    )}
                    {isCommentLike && (
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                        <ThumbsUp size={18} fill="#059669" className="text-emerald-600" />
                      </div>
                    )}
                    {isMessage && (
                      <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shadow-xs">
                        <Mail size={18} />
                      </div>
                    )}
                    {isFollow && (
                      <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                        <UserPlus size={18} />
                      </div>
                    )}
                    {isListAdd && (
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                        <ListFilter size={18} />
                      </div>
                    )}
                    {(isCommunityAdd || isCommunityJoin) && (
                      <div className="w-9 h-9 rounded-full bg-purple-100 text-[#7C3AED] flex items-center justify-center shadow-xs">
                        <Users size={18} />
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${notif.actor_username}`);
                        }}
                        className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 cursor-pointer"
                      >
                        <img
                          src={getAvatarUrl(notif.actor_avatar_url || notif.actor_username)}
                          alt={notif.actor_username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${notif.actor_username}`);
                          }}
                          className="font-bold text-[14px] text-[#0F1419] hover:underline cursor-pointer"
                        >
                          {notif.actor_name || notif.actor_username}
                        </span>{' '}
                        <span className="text-[14px] text-[#536471]">
                          {isPostLike && 'liked your post'}
                          {isPostComment && 'commented on your post'}
                          {isCommentReply && 'replied to your comment'}
                          {isCommentLike && 'liked your comment'}
                          {isMessage && 'sent you a direct message'}
                          {isFollow && 'started following you'}
                          {isListAdd && `added you to the list "${notif.message_content || 'Curated List'}"`}
                          {isCommunityAdd && `added you to community "${notif.message_content || 'Developer Community'}"`}
                          {isCommunityJoin && `joined your community "${notif.message_content || 'Developer Community'}"`}
                        </span>
                      </div>

                      <span className="text-[12px] text-[#536471] ml-auto flex-shrink-0">
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>

                    {/* Preview details */}
                    {notif.message_content && (
                      <p className="text-[14px] text-[#0F1419] bg-[#F7F9F9] border border-gray-100 rounded-xl p-2.5 mt-2 leading-relaxed">
                        "{notif.message_content}"
                      </p>
                    )}
                    {notif.comment_content && !notif.message_content && (
                      <p className="text-[14px] text-[#0F1419] bg-[#F7F9F9] border border-gray-100 rounded-xl p-2.5 mt-2 leading-relaxed">
                        "{notif.comment_content}"
                      </p>
                    )}
                    {notif.post_content && (
                      <p className="text-[13px] text-[#536471] line-clamp-2 mt-1.5 pl-1 italic">
                        Post: "{notif.post_content}"
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="mt-2 flex items-center gap-2">
                      {isMessage && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#7C3AED] hover:underline">
                          Reply in chat <ArrowRight size={13} />
                        </span>
                      )}
                      {isFollow && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${notif.actor_username}`);
                          }}
                          className="px-3.5 py-1 text-[12px] font-bold bg-[#0F1419] hover:bg-[#272C30] text-white rounded-full transition-colors"
                        >
                          View Profile
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete / Dismiss Notification Button */}
                  <button
                    onClick={(e) => handleDeleteNotification(e, notif.id)}
                    className="absolute right-3 top-4 p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Dismiss notification"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Notifications;
