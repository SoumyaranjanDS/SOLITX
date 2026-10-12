import React, { useState } from 'react';
import { 
  Heart, 
  Repeat2, 
  MessageCircle, 
  Share, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Link as LinkIcon, 
  Check, 
  X 
} from 'lucide-react';
import api from '../api';

// Helper to format timestamps like Twitter (e.g. 5m, 2h, Oct 12)
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${Math.max(diffInSeconds, 1)}s`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const PostCard = ({ post, onNavigate, onPostDeleted, onPostUpdated }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = currentUser?.username === post.username || currentUser?.id === post.author_id;

  const [liked, setLiked] = useState(Boolean(post.has_liked));
  const [likeCount, setLikeCount] = useState(parseInt(post.likes_count, 10) || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [reposted, setReposted] = useState(false);

  // Menu and Modals
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Copy Link State
  const [copied, setCopied] = useState(false);

  // Like Toggle
  const handleLikeToggle = async (e) => {
    e.stopPropagation();
    if (isLiking) return;

    // Optimistic Update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    setIsLiking(true);

    try {
      const response = await api.post(`/posts/${post.id}/like`);
      if (response.data?.data) {
        setLiked(response.data.data.liked);
        setLikeCount(response.data.data.likes_count);
      }
    } catch (err) {
      // Rollback on failure
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  // Delete Post
  const handleDeletePost = async () => {
    try {
      setIsDeleting(true);
      await api.delete(`/posts/${post.id}`);
      setShowDeleteModal(false);
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent.trim() === post.content) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSavingEdit(true);
      const res = await api.put(`/posts/${post.id}`, { content: editContent.trim() });
      setIsEditing(false);
      if (onPostUpdated && res.data?.data?.post) {
        onPostUpdated({
          ...post,
          content: res.data.data.post.content,
          updated_at: res.data.data.post.updated_at,
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update post');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy Link
  const handleCopyLink = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/profile/${post.username}`);
    setCopied(true);
    setShowMenu(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  return (
    <>
      <article
        onClick={() => onNavigate(`/profile/${post.username}`)}
        className="flex gap-3 px-4 py-3 border-b border-[#EFF3F4] hover:bg-[#F7F9F9]/60 cursor-pointer transition-colors relative group"
      >
        {/* Author Avatar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/profile/${post.username}`);
          }}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 overflow-hidden hover:opacity-90 transition-opacity"
        >
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}`}
            alt={post.username}
            className="w-full h-full object-cover"
          />
        </button>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap text-[14px] sm:text-[15px] min-w-0 flex-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(`/profile/${post.username}`);
                }}
                className="font-bold text-[#0F1419] hover:underline truncate"
              >
                {post.username}
              </button>
              <span className="text-[#536471] truncate text-[14px]">
                @{post.username} · {formatRelativeTime(post.created_at)}
              </span>
              {isEdited && (
                <span className="text-[12px] text-[#536471] italic ml-0.5">(edited)</span>
              )}
            </div>

            {/* Three Dots Menu Button */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowMenu((prev) => !prev)}
                className="p-1.5 -mr-1 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 text-[#536471] transition-all"
              >
                <MoreHorizontal size={17} />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-7 w-48 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#EFF3F4] py-1.5 z-50 text-[14px] font-semibold animate-in fade-in zoom-in-95 duration-100">
                    {isOwner ? (
                      <>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setIsEditing(true);
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-[#F7F9F9] text-[#0F1419] transition-colors text-left"
                        >
                          <Edit3 size={16} className="text-[#536471]" />
                          <span>Edit post</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowDeleteModal(true);
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-red-50 text-red-600 transition-colors text-left"
                        >
                          <Trash2 size={16} className="text-red-500" />
                          <span>Delete post</span>
                        </button>
                      </>
                    ) : null}
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-[#F7F9F9] text-[#0F1419] transition-colors text-left"
                    >
                      {copied ? (
                        <>
                          <Check size={16} className="text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon size={16} className="text-[#536471]" />
                          <span>Copy link</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Post Content */}
          {isEditing ? (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full p-2.5 text-[15px] border border-[#7C3AED] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#7C3AED] text-[#0F1419] resize-none leading-relaxed"
              />
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-[12px] text-[#536471]">
                  {editContent.length}/500
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditContent(post.content);
                      setIsEditing(false);
                    }}
                    className="px-3 py-1 text-[13px] font-bold text-[#536471] hover:bg-[#EFF3F4] rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editContent.trim()}
                    className="px-4 py-1 text-[13px] font-bold bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-full transition-colors"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[14px] sm:text-[15px] text-[#0F1419] mt-1 leading-[1.5] whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}

          {/* Interaction Bar */}
          <div className="flex justify-between items-center mt-3 text-[#536471] max-w-[340px] sm:max-w-[420px] -ml-2">
            {/* Replies */}
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 transition-colors group/reply"
            >
              <MessageCircle size={17} strokeWidth={1.8} className="group-hover/reply:text-[#7C3AED]" />
              <span className="text-[12px] sm:text-[13px]">0</span>
            </button>

            {/* Repost */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReposted((r) => !r);
              }}
              className={`flex items-center gap-1.5 p-2 rounded-full hover:bg-green-50 hover:text-green-600 active:bg-green-50 transition-colors group/rt ${
                reposted ? 'text-green-600' : ''
              }`}
            >
              <Repeat2 size={17} strokeWidth={1.8} />
              <span className="text-[12px] sm:text-[13px]">{reposted ? 1 : 0}</span>
            </button>

            {/* Heart / Like */}
            <button
              onClick={handleLikeToggle}
              className={`flex items-center gap-1.5 p-2 rounded-full hover:bg-pink-50 hover:text-pink-600 active:bg-pink-50 transition-colors group/heart ${
                liked ? 'text-pink-600' : ''
              }`}
            >
              <Heart
                size={17}
                strokeWidth={1.8}
                fill={liked ? '#E11D48' : 'none'}
                className={liked ? 'text-[#E11D48] scale-110 transition-transform' : 'group-hover/heart:text-pink-600'}
              />
              <span className={`text-[12px] sm:text-[13px] ${liked ? 'font-bold text-[#E11D48]' : ''}`}>
                {likeCount}
              </span>
            </button>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 transition-colors"
            >
              <Share size={17} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </article>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-[320px] p-6 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-[19px] text-[#0F1419] mb-2 leading-snug">
              Delete post?
            </h3>
            <p className="text-[#536471] text-[14px] leading-relaxed mb-6">
              This can’t be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-[15px] rounded-full transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-2.5 bg-white hover:bg-[#EFF3F4] text-[#0F1419] font-bold text-[15px] rounded-full transition-colors border border-[#CFD9DE]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PostCard;
