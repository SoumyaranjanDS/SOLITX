import React, { useState, useEffect } from 'react';
import { X, Send, Trash2, MessageCircle } from 'lucide-react';
import { formatRelativeTime } from './PostCard';
import api from '../api';

const CommentModal = ({ isOpen, onClose, post, onReplyCountUpdated }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch comments when modal opens
  useEffect(() => {
    if (isOpen && post?.id) {
      setLoading(true);
      setError('');
      api.get(`/posts/${post.id}/comments`)
        .then((res) => {
          setComments(res.data?.data?.comments || []);
        })
        .catch((err) => {
          console.error('Failed to fetch comments:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setComments([]);
      setReplyText('');
    }
  }, [isOpen, post?.id]);

  if (!isOpen || !post) return null;

  // Handle Post Reply
  const handleSendReply = async () => {
    if (!replyText.trim() || isSubmitting || replyText.length > 500) return;

    try {
      setIsSubmitting(true);
      setError('');
      const res = await api.post(`/posts/${post.id}/comments`, {
        content: replyText.trim(),
      });

      if (res.data?.data?.comment) {
        const newComment = res.data.data.comment;
        setComments((prev) => [...prev, newComment]);
        setReplyText('');
        if (onReplyCountUpdated && res.data.data.replies_count !== undefined) {
          onReplyCountUpdated(res.data.data.replies_count);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (commentId) => {
    try {
      const res = await api.delete(`/posts/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (onReplyCountUpdated && res.data?.data?.replies_count !== undefined) {
        onReplyCountUpdated(res.data.data.replies_count);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete reply');
    }
  };

  const charLeft = 500 - replyText.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-[550px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EFF3F4] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="font-bold text-[18px] text-[#0F1419]">Reply</h2>
          </div>
          <span className="text-[13px] text-[#536471] font-medium">
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>

        {/* Scrollable Thread Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Parent Tweet */}
          <div className="flex gap-3 relative">
            {/* Thread Connector Line */}
            <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-[#CFD9DE] -mb-4 z-0" />

            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 z-10">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.username}`}
                alt={post.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[15px] text-[#0F1419] truncate">{post.username}</span>
                <span className="text-[#536471] text-[14px]">@{post.username} · {formatRelativeTime(post.created_at)}</span>
              </div>
              <p className="text-[15px] text-[#0F1419] mt-1 leading-relaxed whitespace-pre-wrap break-words">
                {post.content}
              </p>
              <p className="text-[13px] text-[#536471] mt-2">
                Replying to <span className="text-[#7C3AED] font-medium">@{post.username}</span>
              </p>
            </div>
          </div>

          {/* Reply Compose Area */}
          <div className="flex gap-3 pt-2">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 z-10">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username}`}
                alt="me"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <textarea
                autoFocus
                placeholder="Post your reply"
                className="w-full text-[16px] text-[#0F1419] placeholder:text-[#536471] border-none focus:ring-0 resize-none outline-none leading-snug min-h-[70px] pt-1"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={500}
              />

              {error && (
                <p className="text-red-500 text-[13px] font-medium mb-1">{error}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#EFF3F4]">
                <span className={`text-[12px] ${charLeft < 20 ? 'text-red-500 font-bold' : 'text-[#536471]'}`}>
                  {charLeft}
                </span>
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSubmitting || replyText.length > 500}
                  className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-full transition-all shadow-sm active:scale-95"
                >
                  {isSubmitting ? 'Replying...' : 'Reply'}
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#EFF3F4] my-2" />

          {/* Comments List */}
          <div>
            <h3 className="font-bold text-[14px] text-[#536471] uppercase tracking-wider mb-3">
              Replies
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-[#536471]">
                <MessageCircle size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-[14px]">No replies yet. Be the first to join the conversation!</p>
              </div>
            ) : (
              <div className="divide-y divide-[#EFF3F4]">
                {comments.map((comment) => {
                  const isCommentOwner =
                    currentUser?.username === comment.username ||
                    currentUser?.id === comment.author_id ||
                    currentUser?.username === post.username;

                  return (
                    <div key={comment.id} className="py-3 flex gap-3 group">
                      <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.username}`}
                          alt={comment.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[14px] text-[#0F1419]">{comment.username}</span>
                            <span className="text-[13px] text-[#536471]">
                              @{comment.username} · {formatRelativeTime(comment.created_at)}
                            </span>
                          </div>

                          {isCommentOwner && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete reply"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p className="text-[14px] text-[#0F1419] mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentModal;
