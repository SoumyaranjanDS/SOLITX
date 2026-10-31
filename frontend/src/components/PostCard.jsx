import React, { useState, useEffect } from 'react';
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
  X,
  BarChart2,
  Bookmark
} from 'lucide-react';
import api from '../api';
import CommentModal from './CommentModal';
import { getAvatarUrl } from '../utils/avatar';
import MentionText from './MentionText';
import { redirectToAuth } from '../utils/authRedirect';

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

// Helper to format view impressions like X / Twitter (e.g. 1.2K, 45.8K, 1.2M)
export const formatViews = (views) => {
  const count = Number(views) || 0;
  if (count < 1000) return count.toLocaleString();
  if (count < 1000000) {
    const k = (count / 1000).toFixed(1);
    return `${k.endsWith('.0') ? k.slice(0, -2) : k}K`;
  }
  const m = (count / 1000000).toFixed(1);
  return `${m.endsWith('.0') ? m.slice(0, -2) : m}M`;
};

const PostCard = ({ post, onNavigate, onPostDeleted, onPostUpdated }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = currentUser?.username === post.username || currentUser?.id === post.author_id;

  const [liked, setLiked] = useState(Boolean(post.has_liked));
  const [likeCount, setLikeCount] = useState(parseInt(post.likes_count, 10) || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [reposted, setReposted] = useState(false);

  // Reply State
  const [replyCount, setReplyCount] = useState(parseInt(post.replies_count, 10) || 0);
  const [showCommentModal, setShowCommentModal] = useState(false);

  // Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (post.replies_count !== undefined) {
      setReplyCount(parseInt(post.replies_count, 10) || 0);
    }
  }, [post.replies_count]);

  // Menu and Modals
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [displayContent, setDisplayContent] = useState(post.content);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Copy Link State
  const [copied, setCopied] = useState(false);

  // Bookmark State
  const [bookmarked, setBookmarked] = useState(Boolean(post.has_bookmarked));
  const handleBookmarkToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.username) {
      redirectToAuth(null, `/post/${post.id}`);
      return;
    }

    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const res = await api.post(`/posts/${post.id}/bookmark`);
      if (res.data?.data) {
        setBookmarked(res.data.data.bookmarked);
      }
    } catch {
      setBookmarked(prev);
    }
  };

  // Like Toggle
  const handleLikeToggle = async (e) => {
    e.stopPropagation();
    if (!currentUser?.username) {
      redirectToAuth(null, `/post/${post.id}`);
      return;
    }
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
    if (!editContent.trim() || editContent.trim() === displayContent) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSavingEdit(true);
      const res = await api.put(`/posts/${post.id}`, { content: editContent.trim() });
      const newText = res.data?.data?.post?.content || editContent.trim();
      const newUpdatedAt = res.data?.data?.post?.updated_at || new Date().toISOString();
      setDisplayContent(newText);
      post.content = newText;
      post.updated_at = newUpdatedAt;
      setIsEditing(false);
      if (onPostUpdated && res.data?.data?.post) {
        onPostUpdated({
          ...post,
          content: newText,
          updated_at: newUpdatedAt,
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update post');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy Link / Share
  const handleCopyLink = async (e) => {
    e.stopPropagation();
    const postUrl = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by @${post.username} on SOLITX`,
          text: post.content.slice(0, 100),
          url: postUrl,
        });
        return;
      } catch (err) {}
    }
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setShowMenu(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  const isEdited = post.updated_at && post.updated_at !== post.created_at;

  return (
    <>
      <article
        onClick={() => onNavigate ? onNavigate(`/post/${post.id}`) : window.location.assign(`/post/${post.id}`)}
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
            src={getAvatarUrl(post)}
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
              {post.community_slug && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(`/communities/${post.community_slug}`);
                  }}
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 transition-colors"
                >
                  c/{post.community_slug}
                </button>
              )}
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
                className="w-full p-3 text-[15px] border border-[#CFD9DE] focus:border-[#0F1419] rounded-2xl focus:outline-none text-[#0F1419] resize-none leading-relaxed bg-white shadow-sm"
              />
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-[12px] text-[#536471]">
                  {editContent.length}/500
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditContent(displayContent);
                      setIsEditing(false);
                    }}
                    className="px-4 py-1.5 text-[13px] font-bold text-[#536471] hover:bg-[#EFF3F4] rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editContent.trim()}
                    className="px-5 py-1.5 text-[13px] font-bold bg-[#0F1419] hover:bg-[#272C30] disabled:opacity-40 text-white rounded-full transition-all shadow-sm active:scale-95"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          ) : (() => {
            const attachedMedia = Array.isArray(post.media) && post.media.length > 0 ? post.media : null;
            const mediaMatch = !attachedMedia && displayContent?.match(/(https?:\/\/[^\s]+(?:\.(?:jpg|jpeg|png|gif|webp|svg|bmp)|images\.unsplash\.com[^\s]+|imgur\.com[^\s]+))/i);
            const mediaUrl = mediaMatch ? mediaMatch[0] : null;
            const cleanContent = mediaUrl ? displayContent.replace(mediaUrl, '').trim() : displayContent;
            return (
              <>
                {cleanContent && (
                  <p className="text-[14px] sm:text-[15px] text-[#0F1419] mt-1 leading-[1.5] whitespace-pre-wrap break-words">
                    <MentionText text={cleanContent} />
                  </p>
                )}

                {/* Structured Attached Media from S3 Pipeline */}
                {attachedMedia && (
                  <div className="mt-2.5 space-y-2">
                    {attachedMedia.map((m) => {
                      const displaySrc = m.url_feed || m.url_full || m.url_thumb || m.url_raw;
                      const fullSrc = m.url_full || m.url_feed || m.url_thumb || m.url_raw;
                      if (!displaySrc) return null;
                      return (
                        <div
                          key={m.id || displaySrc}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(fullSrc);
                          }}
                          className="rounded-2xl overflow-hidden border border-[#EFF3F4] max-h-[420px] bg-black/5 relative group/img cursor-zoom-in"
                        >
                          <img
                            src={displaySrc}
                            alt="Post attachment"
                            className="w-full h-full object-cover max-h-[420px] hover:opacity-95 transition-opacity"
                            loading="lazy"
                          />
                          {m.status === 'processing' && (
                            <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold rounded-full">
                              Optimizing WebP...
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fallback Regex URL Media */}
                {!attachedMedia && mediaUrl && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxImage(mediaUrl);
                    }}
                    className="mt-2.5 rounded-2xl overflow-hidden border border-[#EFF3F4] max-h-[380px] bg-black/5 cursor-zoom-in"
                  >
                    <img
                      src={mediaUrl}
                      alt="Post attachment"
                      className="w-full h-full object-cover max-h-[380px] hover:opacity-95 transition-opacity"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                    />
                  </div>
                )}
              </>
            );
          })()}

          {/* Interaction Bar */}
          <div className="flex justify-between items-center mt-3 text-[#536471] max-w-[380px] sm:max-w-[460px] -ml-2">
            {/* Replies */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentUser?.username) {
                  redirectToAuth(null, `/post/${post.id}`);
                  return;
                }
                setShowCommentModal(true);
              }}
              className="flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 transition-colors group/reply"
              title="Reply"
            >
              <MessageCircle size={17} strokeWidth={1.8} className="group-hover/reply:text-[#7C3AED]" />
              <span className="text-[12px] sm:text-[13px]">{replyCount}</span>
            </button>

            {/* Repost */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentUser?.username) {
                  redirectToAuth(null, `/post/${post.id}`);
                  return;
                }
                setReposted((r) => !r);
              }}
              className={`flex items-center gap-1.5 p-2 rounded-full hover:bg-green-50 hover:text-green-600 active:bg-green-50 transition-colors group/rt ${
                reposted ? 'text-green-600' : ''
              }`}
              title="Repost"
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
              title="Like"
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

            {/* Views / Impressions */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onNavigate) onNavigate();
              }}
              className="flex items-center gap-1.5 p-2 rounded-full hover:bg-blue-50 hover:text-blue-500 active:bg-blue-50 transition-colors group/views"
              title={`${(Number(post.views_count) || 0).toLocaleString()} Views`}
            >
              <BarChart2 size={17} strokeWidth={1.8} className="group-hover/views:text-blue-500" />
              <span className="text-[12px] sm:text-[13px] group-hover/views:text-blue-500">
                {formatViews(post.views_count || 0)}
              </span>
            </button>

            {/* Bookmark */}
            <button
              onClick={handleBookmarkToggle}
              className={`flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 transition-colors group/bm ${
                bookmarked ? 'text-[#7C3AED]' : ''
              }`}
              title={bookmarked ? 'Remove Bookmark' : 'Bookmark'}
            >
              <Bookmark
                size={17}
                strokeWidth={1.8}
                fill={bookmarked ? '#7C3AED' : 'none'}
                className={bookmarked ? 'text-[#7C3AED] scale-110 transition-transform' : 'group-hover/bm:text-[#7C3AED]'}
              />
            </button>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 transition-colors"
              title="Share"
            >
              {copied ? (
                <Check size={17} className="text-green-600 animate-in zoom-in-50 duration-150" />
              ) : (
                <Share size={17} strokeWidth={1.8} />
              )}
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

      {/* Threaded Comment / Reply Modal */}
      <CommentModal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        post={post}
        onReplyCountUpdated={(count) => {
          setReplyCount(count);
          if (onPostUpdated) {
            onPostUpdated({ ...post, replies_count: count });
          }
        }}
      />

      {/* Full-Screen Media Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxImage(null);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
            className="absolute top-5 right-5 p-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95 z-50"
            title="Close image"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImage}
            alt="Full resolution preview"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default PostCard;
