import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Heart, 
  Repeat2, 
  MessageCircle, 
  Share, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Link as LinkIcon, 
  Check, 
  Send,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  MessageSquare,
  BarChart2
} from 'lucide-react';
import AppShell, { SolitxLogo } from '../components/AppShell';
import AuthRequiredModal from '../components/AuthRequiredModal';
import { formatViews } from '../components/PostCard';
import api from '../api';
import { getAvatarUrl } from '../utils/avatar';
import MentionText from '../components/MentionText';
import MentionDropdown, { useMentionAutocomplete } from '../components/MentionAutocomplete';

// YouTube-style natural English relative timestamp
export const formatYouTubeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.max(0, Math.floor((now - date) / 1000));

  if (diffInSeconds < 15) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
};

// Full date time for hover tooltips: "Oct 12, 2026, 10:42 PM"
const formatFullDateTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  const isAuthenticated = Boolean(currentUser?.username && token);

  // Post State
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Post Interactions
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lightbox Modal State
  const [lightboxImage, setLightboxImage] = useState(null);

  // Edit Post State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Auth Gate Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState('interact with this post');

  // Comments & Replies State
  const [rawComments, setRawComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [mainReplyText, setMainReplyText] = useState('');
  const [isSubmittingMainReply, setIsSubmittingMainReply] = useState(false);
  const [mainReplyError, setMainReplyError] = useState('');

  // @Mention Autocomplete for main reply
  const mainReplyTextareaRef = useRef(null);
  const {
    mentionState: mainMentionState,
    suggestions: mainSuggestions,
    loading: mainMentionLoading,
    selectedIndex: mainSelectedIndex,
    checkMentionTrigger: checkMainMention,
    selectUser: selectMainUser,
    handleKeyDown: handleMainMentionKeyDown,
  } = useMentionAutocomplete({ text: mainReplyText, setText: setMainReplyText, textareaRef: mainReplyTextareaRef });

  // YouTube Thread State: expanded reply drawers & active inline reply composer
  const [expandedThreads, setExpandedThreads] = useState(new Set());
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [inlineReplyText, setInlineReplyText] = useState('');
  const [isSubmittingInlineReply, setIsSubmittingInlineReply] = useState(false);
  const inlineInputRef = useRef(null);

  // Require Auth Helper
  const requireAuth = (actionDescription, callback) => {
    if (!isAuthenticated) {
      setAuthAction(actionDescription);
      setShowAuthModal(true);
      return false;
    }
    if (callback) callback();
    return true;
  };

  // Toast Helper
  const displayToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Fetch Post and Comments
  const fetchPostData = async () => {
    try {
      setLoading(true);
      setError('');
      const [postRes, commentsRes] = await Promise.all([
        api.get(`/posts/${id}`),
        api.get(`/posts/${id}/comments`),
      ]);

      if (postRes.data?.data?.post) {
        const p = postRes.data.data.post;
        setPost(p);
        setLiked(Boolean(p.has_liked));
        setLikeCount(parseInt(p.likes_count, 10) || 0);
        setEditContent(p.content);
      }
      const loadedComments = commentsRes.data?.data?.comments || [];
      setRawComments(loadedComments);
    } catch (err) {
      console.error('Failed to fetch post details:', err);
      setError(err.response?.data?.message || 'Post not found');
    } finally {
      setLoading(false);
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchPostData();
    }
  }, [id]);

  // Focus inline reply input when replyingToCommentId changes
  useEffect(() => {
    if (replyingToCommentId && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [replyingToCommentId]);

  // Organize Comments into Top-Level and Nested Replies (YouTube hierarchy)
  const topLevelComments = rawComments.filter((c) => !c.parent_id);
  const getRepliesForComment = (commentId) => {
    return rawComments.filter((c) => c.parent_id === commentId);
  };

  // Toggle Thread Expansion (View / Hide replies)
  const toggleThread = (commentId) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  // Toggle Post Like
  const handleLikeToggle = () => {
    requireAuth('like this post', async () => {
      const prevLiked = liked;
      const prevCount = likeCount;
      setLiked(!prevLiked);
      setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

      try {
        const response = await api.post(`/posts/${id}/like`);
        if (response.data?.data) {
          setLiked(response.data.data.liked);
          setLikeCount(response.data.data.likes_count);
        }
      } catch {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    });
  };

  // Toggle Comment or Reply Like
  const handleToggleCommentLike = (commentId) => {
    requireAuth('like comments', async () => {
      setRawComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            const nextLiked = !c.has_liked;
            return {
              ...c,
              has_liked: nextLiked,
              likes_count: nextLiked ? (c.likes_count || 0) + 1 : Math.max(0, (c.likes_count || 0) - 1),
            };
          }
          return c;
        })
      );

      try {
        const res = await api.post(`/posts/comments/${commentId}/like`);
        if (res.data?.data) {
          setRawComments((prev) =>
            prev.map((c) =>
              c.id === commentId
                ? { ...c, has_liked: res.data.data.liked, likes_count: res.data.data.likes_count }
                : c
            )
          );
        }
      } catch (err) {
        console.error('Comment like error:', err);
      }
    });
  };

  // Post Main Top-Level Comment
  const handlePostMainReply = async () => {
    if (!mainReplyText.trim() || isSubmittingMainReply) return;
    requireAuth('reply to this post', async () => {
      try {
        setIsSubmittingMainReply(true);
        setMainReplyError('');
        const res = await api.post(`/posts/${id}/comments`, {
          content: mainReplyText.trim(),
        });
        if (res.data?.data?.comment) {
          setRawComments((prev) => [...prev, res.data.data.comment]);
          setMainReplyText('');
          displayToast('Comment posted');
        }
      } catch (err) {
        setMainReplyError(err.response?.data?.message || 'Failed to post comment');
      } finally {
        setIsSubmittingMainReply(false);
      }
    });
  };

  // Start Inline Reply (YouTube style)
  const handleOpenInlineReply = (parentComment, targetUsername) => {
    requireAuth('reply to this thread', () => {
      const rootId = parentComment.id;
      setReplyingToCommentId(rootId);
      // Pre-fill @mention if replying to a child reply
      if (targetUsername && targetUsername !== parentComment.username) {
        setInlineReplyText(`@${targetUsername} `);
      } else {
        setInlineReplyText('');
      }
      // Ensure the thread is expanded so user sees context
      setExpandedThreads((prev) => new Set([...prev, rootId]));
    });
  };

  // Submit Inline Reply (Nested comment)
  const handleSubmitInlineReply = async (rootParentId) => {
    if (!inlineReplyText.trim() || isSubmittingInlineReply) return;
    requireAuth('post a reply', async () => {
      try {
        setIsSubmittingInlineReply(true);
        const res = await api.post(`/posts/${id}/comments`, {
          content: inlineReplyText.trim(),
          parent_id: rootParentId,
        });
        if (res.data?.data?.comment) {
          setRawComments((prev) => [...prev, res.data.data.comment]);
          setInlineReplyText('');
          setReplyingToCommentId(null);
          // Auto-expand thread
          setExpandedThreads((prev) => new Set([...prev, rootParentId]));
          displayToast('Reply posted');
        }
      } catch (err) {
        displayToast('Failed to post reply');
      } finally {
        setIsSubmittingInlineReply(false);
      }
    });
  };

  // Delete Comment / Reply
  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/posts/comments/${commentId}`);
      // Remove comment and any replies that pointed to it
      setRawComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
      displayToast('Comment deleted');
    } catch (err) {
      displayToast('Failed to delete comment');
    }
  };

  // Share Post (Mobile Web Share API + Clipboard Fallback)
  const handleSharePost = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: `${post?.username} on SOLITX`,
      text: post?.content?.slice(0, 100),
      url: shareUrl,
    };

    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      displayToast('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      displayToast('Failed to copy link');
    }
  };

  // Save Edit Post
  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSavingEdit) return;
    try {
      setIsSavingEdit(true);
      const res = await api.put(`/posts/${id}`, { content: editContent.trim() });
      if (res.data?.data?.post) {
        setPost(res.data.data.post);
        setIsEditing(false);
        displayToast('Post updated');
      }
    } catch (err) {
      displayToast('Failed to update post');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Post
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await api.delete(`/posts/${id}`);
      displayToast('Post deleted');
      setTimeout(() => navigate('/'), 600);
    } catch {
      displayToast('Failed to delete post');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const isPostOwner = currentUser?.username === post?.username || currentUser?.id === post?.author_id;
  const isEdited = post && post.updated_at && post.created_at && new Date(post.updated_at) > new Date(post.created_at);

  return (
    <AppShell>
      <div className="min-h-screen bg-white pb-20 sm:pb-12">
        {/* ── Mobile-Optimized Sticky Header ── */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EFF3F4] px-3 sm:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full hover:bg-[#EFF3F4] flex items-center justify-center text-[#0F1419] transition-colors active:scale-95"
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-[18px] sm:text-[20px] font-black text-[#0F1419] tracking-tight truncate">
              Post
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSharePost}
              className="w-9 h-9 rounded-full hover:bg-[#EFF3F4] flex items-center justify-center text-[#536471] hover:text-[#0F1419] transition-colors active:scale-95"
              title="Share"
            >
              {copied ? <Check size={18} className="text-green-600" /> : <Share size={18} />}
            </button>
          </div>
        </div>

        {/* ── Loading Skeleton ── */}
        {loading && (
          <div className="p-4 sm:p-6 space-y-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-1/6" />
              </div>
            </div>
            <div className="h-16 bg-gray-200 rounded-xl w-full" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
          </div>
        )}

        {/* ── Error State ── */}
        {!loading && error && (
          <div className="p-8 text-center space-y-3">
            <p className="text-[17px] font-bold text-[#0F1419]">{error}</p>
            <p className="text-[14px] text-[#536471]">
              This post may have been deleted or the link is incorrect.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-[#0F1419] text-white font-bold text-[14px] rounded-full hover:bg-[#272C30] transition-colors shadow-sm"
            >
              Return Home
            </button>
          </div>
        )}

        {/* ── Main Post View ── */}
        {!loading && post && (
          <div>
            <article className="p-4 sm:p-5 border-b border-[#EFF3F4]">
              {/* Community Context Badge if in a Community */}
              {post.community_slug && (
                <div className="flex items-center gap-1.5 mb-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/communities/${post.community_slug}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-black bg-gradient-to-r from-purple-100 to-indigo-100 text-[#7C3AED] hover:from-purple-200 hover:to-indigo-200 transition-all border border-purple-200/50 shadow-xs"
                  >
                    <span>c/{post.community_slug}</span>
                    {post.community_name && (
                      <span className="text-[#536471] font-semibold">· {post.community_name}</span>
                    )}
                  </button>
                </div>
              )}

              {/* Author Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => navigate(`/profile/${post.username}`)}
                    className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 hover:opacity-90 transition-opacity border border-gray-100"
                  >
                    <img
                      src={getAvatarUrl(post)}
                      alt={post.username}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="min-w-0">
                    <button
                      onClick={() => navigate(`/profile/${post.username}`)}
                      className="font-black text-[16px] text-[#0F1419] hover:underline truncate block text-left"
                    >
                      {post.username}
                    </button>
                    <span className="text-[14px] text-[#536471] truncate block text-left">
                      @{post.username}
                    </span>
                  </div>
                </div>

                {/* More Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowMenu((m) => !m)}
                    className="w-9 h-9 rounded-full hover:bg-[#EFF3F4] flex items-center justify-center text-[#536471] hover:text-[#0F1419] transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {showMenu && (
                    <div 
                      className="absolute right-0 top-10 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100"
                      onClick={() => setShowMenu(false)}
                    >
                      <button
                        onClick={handleSharePost}
                        className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-[#0F1419] hover:bg-[#F7F9F9] flex items-center gap-2.5"
                      >
                        <LinkIcon size={16} />
                        <span>Copy post link</span>
                      </button>

                      {isPostOwner && (
                        <>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-[#0F1419] hover:bg-[#F7F9F9] flex items-center gap-2.5"
                          >
                            <Edit3 size={16} />
                            <span>Edit post</span>
                          </button>
                          <button
                            onClick={() => setShowDeleteModal(true)}
                            className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                          >
                            <Trash2 size={16} />
                            <span>Delete post</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Post Content */}
              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="w-full p-3 text-[16px] border border-[#CFD9DE] focus:border-[#0F1419] rounded-2xl outline-none leading-relaxed resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#536471]">{editContent.length}/500</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditContent(post.content);
                          setIsEditing(false);
                        }}
                        className="px-4 py-1.5 text-[14px] font-bold text-[#536471] hover:bg-[#EFF3F4] rounded-full transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit || !editContent.trim()}
                        className="px-5 py-1.5 text-[14px] font-bold bg-[#0F1419] hover:bg-[#272C30] text-white rounded-full transition-colors"
                      >
                        {isSavingEdit ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[18px] sm:text-[20px] text-[#0F1419] leading-relaxed my-3 whitespace-pre-wrap break-words">
                  <MentionText text={post.content} />
                </p>
              )}

              {/* Media rendering (S3 pipeline or markdown/link fallback) */}
              {(() => {
                const attachedMedia = Array.isArray(post.media) && post.media.length > 0 ? post.media : null;
                const mediaMatch = !attachedMedia && post.content?.match(/(https?:\/\/[^\s]+(?:\.(?:jpg|jpeg|png|gif|webp|svg|bmp)|images\.unsplash\.com[^\s]+|imgur\.com[^\s]+))/i);
                const mediaUrl = mediaMatch ? mediaMatch[0] : null;

                if (attachedMedia) {
                  return (
                    <div className="my-3 space-y-3">
                      {attachedMedia.map((m) => {
                        const displaySrc = m.url_feed || m.url_full || m.url_thumb || m.url_raw;
                        const fullSrc = m.url_full || m.url_feed || m.url_thumb || m.url_raw;
                        if (!displaySrc) return null;
                        return (
                          <div
                            key={m.id || displaySrc}
                            onClick={() => setLightboxImage(fullSrc)}
                            className="rounded-2xl overflow-hidden border border-[#EFF3F4] max-h-[550px] bg-black/5 cursor-zoom-in relative group/img"
                          >
                            <img
                              src={displaySrc}
                              alt="Post media"
                              className="w-full h-full object-cover max-h-[550px] hover:opacity-95 transition-opacity"
                            />
                            {m.status === 'processing' && (
                              <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold rounded-full">
                                Optimizing WebP...
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                if (mediaUrl) {
                  return (
                    <div
                      onClick={() => setLightboxImage(mediaUrl)}
                      className="my-3 rounded-2xl overflow-hidden border border-[#EFF3F4] max-h-[500px] bg-black/5 cursor-zoom-in"
                    >
                      <img
                        src={mediaUrl}
                        alt="Post media"
                        className="w-full h-full object-cover max-h-[500px] hover:opacity-95 transition-opacity"
                        onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                      />
                    </div>
                  );
                }

                return null;
              })()}

              {/* YouTube / Twitter Style Timestamps & Views */}
              <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#536471] py-2.5 border-b border-[#EFF3F4]" title={formatFullDateTime(post.created_at)}>
                <span className="font-medium">{formatYouTubeTime(post.created_at)}</span>
                <span>·</span>
                <span className="text-[13px]">{formatFullDateTime(post.created_at)}</span>
                {isEdited && (
                  <>
                    <span>·</span>
                    <span className="italic">Edited</span>
                  </>
                )}
                <span>·</span>
                <span className="font-bold text-[#0F1419]">{(Number(post.views_count) || 0).toLocaleString()}</span>
                <span>Views</span>
              </div>

              {/* Engagement Numbers Row */}
              <div className="flex flex-wrap items-center gap-6 py-3 border-b border-[#EFF3F4] text-[14px]">
                <div>
                  <span className="font-black text-[#0F1419]">{reposted ? 1 : 0}</span>{' '}
                  <span className="text-[#536471]">Reposts</span>
                </div>
                <div>
                  <span className="font-black text-[#0F1419]">{likeCount}</span>{' '}
                  <span className="text-[#536471]">Likes</span>
                </div>
                <div>
                  <span className="font-black text-[#0F1419]">{rawComments.length}</span>{' '}
                  <span className="text-[#536471]">Comments</span>
                </div>
                <div>
                  <span className="font-black text-[#0F1419]">{(Number(post.views_count) || 0).toLocaleString()}</span>{' '}
                  <span className="text-[#536471]">Views</span>
                </div>
              </div>

              {/* Action Bar (Large touch targets for mobile) */}
              <div className="flex justify-around items-center pt-2 text-[#536471]">
                {/* Reply */}
                <button
                  onClick={() => {
                    requireAuth('reply to this post', () => {
                      const input = document.getElementById('main-reply-input');
                      if (input) input.focus();
                    });
                  }}
                  className="p-2 sm:px-4 rounded-full hover:bg-gray-100 flex items-center gap-2 transition-colors active:scale-95"
                  title="Comment"
                >
                  <MessageCircle size={20} />
                  <span className="text-[13px] font-bold">{rawComments.length}</span>
                </button>

                {/* Repost */}
                <button
                  onClick={() => {
                    requireAuth('repost this', () => setReposted((r) => !r));
                  }}
                  className={`p-2 sm:px-4 rounded-full hover:bg-green-50 flex items-center gap-2 transition-colors active:scale-95 ${
                    reposted ? 'text-green-600' : ''
                  }`}
                  title="Repost"
                >
                  <Repeat2 size={20} />
                  <span className="text-[13px] font-bold">{reposted ? 1 : 0}</span>
                </button>

                {/* Like */}
                <button
                  onClick={handleLikeToggle}
                  className={`p-2 sm:px-4 rounded-full hover:bg-rose-50 flex items-center gap-2 transition-colors active:scale-95 ${
                    liked ? 'text-[#E11D48]' : ''
                  }`}
                  title="Like"
                >
                  <Heart
                    size={20}
                    fill={liked ? '#E11D48' : 'none'}
                    className={liked ? 'scale-110 transition-transform' : ''}
                  />
                  <span className={`text-[13px] font-bold ${liked ? 'text-[#E11D48]' : ''}`}>
                    {likeCount}
                  </span>
                </button>

                {/* Views */}
                <div
                  className="p-2 sm:px-4 rounded-full flex items-center gap-2 text-[#536471] cursor-default"
                  title={`${(Number(post.views_count) || 0).toLocaleString()} Views`}
                >
                  <BarChart2 size={20} />
                  <span className="text-[13px] font-bold">
                    {formatViews(post.views_count || 0)}
                  </span>
                </div>

                {/* Share */}
                <button
                  onClick={handleSharePost}
                  className="p-2 sm:px-4 rounded-full hover:bg-gray-100 flex items-center gap-2 transition-colors active:scale-95"
                  title="Share"
                >
                  <Share size={20} />
                </button>
              </div>
            </article>

            {/* ── YouTube-Style Top-Level Comment Composer ── */}
            <div className="p-4 sm:p-5 border-b border-[#EFF3F4] bg-white">
              {isAuthenticated ? (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-100">
                    <img
                      src={getAvatarUrl(currentUser)}
                      alt="me"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      ref={mainReplyTextareaRef}
                      id="main-reply-input"
                      placeholder="Add a comment..."
                      value={mainReplyText}
                      onChange={(e) => {
                        setMainReplyText(e.target.value);
                        setTimeout(checkMainMention, 0);
                      }}
                      onKeyUp={checkMainMention}
                      onClick={checkMainMention}
                      onKeyDown={(e) => {
                        handleMainMentionKeyDown(e);
                      }}
                      maxLength={500}
                      rows={2}
                      className="w-full text-[15px] sm:text-[16px] text-[#0F1419] placeholder:text-[#536471] border-b border-[#EFF3F4] focus:border-[#0F1419] resize-none outline-none leading-snug pb-2 transition-colors"
                    />
                    <MentionDropdown
                      mentionState={mainMentionState}
                      suggestions={mainSuggestions}
                      loading={mainMentionLoading}
                      selectedIndex={mainSelectedIndex}
                      onSelect={selectMainUser}
                      className="top-full left-0 mt-1"
                    />

                    {mainReplyError && (
                      <p className="text-red-500 text-[13px] font-medium my-1">{mainReplyError}</p>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[12px] text-[#536471]">
                        {500 - mainReplyText.length} left
                      </span>
                      <div className="flex gap-2">
                        {mainReplyText.trim() && (
                          <button
                            type="button"
                            onClick={() => setMainReplyText('')}
                            className="px-4 py-1.5 text-[14px] font-bold text-[#536471] hover:bg-[#EFF3F4] rounded-full transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handlePostMainReply}
                          disabled={!mainReplyText.trim() || isSubmittingMainReply}
                          className="px-5 py-1.5 bg-[#0F1419] hover:bg-[#272C30] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-full transition-all shadow-sm active:scale-95"
                        >
                          {isSubmittingMainReply ? 'Posting...' : 'Comment'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => requireAuth('add a comment')}
                  className="cursor-pointer p-4 bg-[#F7F9F9] hover:bg-[#EFF3F4] rounded-2xl border border-dashed border-[#CFD9DE] text-center transition-colors"
                >
                  <p className="text-[15px] font-bold text-[#0F1419]">
                    Join the discussion
                  </p>
                  <p className="text-[13px] text-[#536471] mt-0.5">
                    Sign in to leave comments and replies on this post.
                  </p>
                  <button
                    type="button"
                    className="mt-3 px-6 py-2 bg-[#0F1419] hover:bg-[#272C30] text-white text-[13px] font-bold rounded-full transition-all shadow-sm"
                  >
                    Sign in to comment
                  </button>
                </div>
              )}
            </div>

            {/* ── YouTube-Style Comments & Replies Thread Section ── */}
            <div className="divide-y divide-[#EFF3F4]">
              <div className="px-4 sm:px-5 py-3 flex items-center justify-between bg-white">
                <h3 className="font-black text-[16px] text-[#0F1419]">
                  Comments ({rawComments.length})
                </h3>
              </div>

              {commentsLoading ? (
                <div className="p-4 sm:p-5 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4" />
                        <div className="h-3 bg-gray-200 rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topLevelComments.length === 0 ? (
                <div className="text-center py-12 px-4 text-[#536471]">
                  <MessageSquare size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="font-bold text-[16px] text-[#0F1419]">No comments yet</p>
                  <p className="text-[14px] mt-1">Be the first to share your thoughts!</p>
                </div>
              ) : (
                topLevelComments.map((comment) => {
                  const replies = getRepliesForComment(comment.id);
                  const isExpanded = expandedThreads.has(comment.id);
                  const isReplying = replyingToCommentId === comment.id;
                  const isCommentLiked = Boolean(comment.has_liked);
                  const commentLikes = parseInt(comment.likes_count, 10) || 0;
                  const isCommentOwner =
                    currentUser?.username === comment.username ||
                    currentUser?.id === comment.author_id ||
                    currentUser?.username === post.username;

                  return (
                    <div key={comment.id} className="p-4 sm:p-5 hover:bg-[#F7F9F9]/30 transition-colors">
                      {/* Top-Level Comment Row */}
                      <div className="flex gap-3 items-start">
                        {/* Avatar */}
                        <button
                          onClick={() => navigate(`/profile/${comment.username}`)}
                          className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 hover:opacity-90 transition-opacity border border-gray-100"
                        >
                          <img
                            src={getAvatarUrl(comment)}
                            alt={comment.username}
                            className="w-full h-full object-cover"
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          {/* Header: Author + YouTube Natural Timestamp */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <button
                                onClick={() => navigate(`/profile/${comment.username}`)}
                                className="font-black text-[14px] sm:text-[15px] text-[#0F1419] hover:underline truncate"
                              >
                                {comment.username}
                              </button>
                              <span 
                                className="text-[13px] text-[#536471]"
                                title={formatFullDateTime(comment.created_at)}
                              >
                                {formatYouTubeTime(comment.created_at)}
                              </span>
                            </div>

                            {/* Delete Option */}
                            {isCommentOwner && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                title="Delete comment"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {/* Comment Content */}
                          <p className="text-[14px] sm:text-[15px] text-[#0F1419] mt-1 leading-relaxed whitespace-pre-wrap break-words">
                            <MentionText text={comment.content} />
                          </p>

                          {/* YouTube-Style Actions Row: Like + Reply */}
                          <div className="flex items-center gap-4 sm:gap-6 mt-2 text-[#536471]">
                            {/* Like Button */}
                            <button
                              onClick={() => handleToggleCommentLike(comment.id)}
                              className={`flex items-center gap-1.5 text-[13px] font-medium hover:text-rose-600 transition-colors py-1 ${
                                isCommentLiked ? 'text-[#E11D48] font-bold' : ''
                              }`}
                            >
                              <Heart
                                size={15}
                                fill={isCommentLiked ? '#E11D48' : 'none'}
                                className={isCommentLiked ? 'scale-110 transition-transform' : ''}
                              />
                              <span>{commentLikes > 0 ? commentLikes : ''}</span>
                            </button>

                            {/* Reply Button (toggles inline composer) */}
                            <button
                              onClick={() => {
                                if (isReplying) {
                                  setReplyingToCommentId(null);
                                } else {
                                  handleOpenInlineReply(comment, comment.username);
                                }
                              }}
                              className="text-[13px] font-bold hover:text-[#0F1419] py-1 transition-colors"
                            >
                              Reply
                            </button>
                          </div>

                          {/* ── Inline Reply Composer (YouTube Style) ── */}
                          {isReplying && (
                            <div className="mt-3 pt-3 border-t border-[#EFF3F4] flex gap-2.5 items-start animate-in fade-in duration-150">
                              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                <img
                                  src={getAvatarUrl(currentUser)}
                                  alt="me"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <input
                                  ref={inlineInputRef}
                                  type="text"
                                  placeholder="Add a reply..."
                                  value={inlineReplyText}
                                  onChange={(e) => setInlineReplyText(e.target.value)}
                                  maxLength={500}
                                  className="w-full text-[14px] text-[#0F1419] placeholder:text-[#536471] border-b border-[#EFF3F4] focus:border-[#0F1419] outline-none pb-1 transition-colors"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSubmitInlineReply(comment.id);
                                    }
                                  }}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingToCommentId(null);
                                      setInlineReplyText('');
                                    }}
                                    className="px-3 py-1 text-[13px] font-bold text-[#536471] hover:bg-[#EFF3F4] rounded-full transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitInlineReply(comment.id)}
                                    disabled={!inlineReplyText.trim() || isSubmittingInlineReply}
                                    className="px-4 py-1 bg-[#0F1419] hover:bg-[#272C30] disabled:opacity-40 text-white font-bold text-[13px] rounded-full transition-all shadow-sm active:scale-95"
                                  >
                                    {isSubmittingInlineReply ? 'Replying...' : 'Reply'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── YouTube-Style Collapsible Replies Button ── */}
                          {replies.length > 0 && (
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={() => toggleThread(comment.id)}
                                className="inline-flex items-center gap-2 text-[13px] font-bold text-[#1D9BF0] hover:bg-[#1D9BF0]/10 py-1.5 px-3 rounded-full transition-colors active:scale-98"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                <span>
                                  {isExpanded ? 'Hide' : 'View'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                </span>
                              </button>

                              {/* ── Nested Replies List (Indented Thread) ── */}
                              {isExpanded && (
                                <div className="mt-3 space-y-3.5 border-l-2 border-[#EFF3F4] pl-3.5 sm:pl-4 ml-2 animate-in fade-in duration-200">
                                  {replies.map((child) => {
                                    const isChildLiked = Boolean(child.has_liked);
                                    const childLikes = parseInt(child.likes_count, 10) || 0;
                                    const isChildOwner =
                                      currentUser?.username === child.username ||
                                      currentUser?.id === child.author_id ||
                                      currentUser?.username === post.username;

                                    return (
                                      <div key={child.id} className="flex gap-2.5 items-start">
                                        <button
                                          onClick={() => navigate(`/profile/${child.username}`)}
                                          className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 hover:opacity-90 transition-opacity border border-gray-100"
                                        >
                                          <img
                                            src={getAvatarUrl(child)}
                                            alt={child.username}
                                            className="w-full h-full object-cover"
                                          />
                                        </button>

                                        <div className="flex-1 min-w-0">
                                          {/* Nested Author + Time */}
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                              <button
                                                onClick={() => navigate(`/profile/${child.username}`)}
                                                className="font-black text-[13px] sm:text-[14px] text-[#0F1419] hover:underline truncate"
                                              >
                                                {child.username}
                                              </button>
                                              <span 
                                                className="text-[12px] text-[#536471]"
                                                title={formatFullDateTime(child.created_at)}
                                              >
                                                {formatYouTubeTime(child.created_at)}
                                              </span>
                                            </div>

                                            {isChildOwner && (
                                              <button
                                                onClick={() => handleDeleteComment(child.id)}
                                                className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                                title="Delete reply"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            )}
                                          </div>

                                          {/* Nested Content with @mention highlight */}
                                          <p className="text-[13px] sm:text-[14px] text-[#0F1419] mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                            <MentionText text={child.content} />
                                          </p>

                                          {/* Nested Actions: Like + Reply */}
                                          <div className="flex items-center gap-4 mt-1.5 text-[#536471]">
                                            <button
                                              onClick={() => handleToggleCommentLike(child.id)}
                                              className={`flex items-center gap-1.5 text-[12px] font-medium hover:text-rose-600 transition-colors ${
                                                isChildLiked ? 'text-[#E11D48] font-bold' : ''
                                              }`}
                                            >
                                              <Heart
                                                size={14}
                                                fill={isChildLiked ? '#E11D48' : 'none'}
                                                className={isChildLiked ? 'scale-110 transition-transform' : ''}
                                              />
                                              <span>{childLikes > 0 ? childLikes : ''}</span>
                                            </button>

                                            <button
                                              onClick={() => handleOpenInlineReply(comment, child.username)}
                                              className="text-[12px] font-bold hover:text-[#0F1419] transition-colors"
                                            >
                                              Reply
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ── */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div 
              className="bg-white rounded-3xl w-full max-w-[320px] p-6 shadow-2xl text-center space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[18px] font-black text-[#0F1419]">Delete post?</h3>
              <p className="text-[14px] text-[#536471]">
                This can’t be undone and it will be removed from your profile and timeline.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[15px] rounded-full transition-colors shadow-sm"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-2.5 bg-white hover:bg-gray-100 text-[#0F1419] font-bold text-[15px] rounded-full border border-[#CFD9DE] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Auth Required Modal for Visitors ── */}
        <AuthRequiredModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          actionName={authAction}
        />

        {/* ── Mobile-Friendly Floating Toast ── */}
        {showToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1419] text-white text-[14px] font-semibold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <Check size={16} className="text-green-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ── Full-Screen Lightbox Modal ── */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
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
      </div>
    </AppShell>
  );
};

export default PostDetail;
