import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Sparkles, RefreshCw } from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard from '../components/PostCard';
import api from '../api';
import { redirectToAuth } from '../utils/authRedirect';

const Bookmarks = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      if (!currentUser?.username) {
        setBookmarks([]);
        return;
      }
      const res = await api.get('/posts/bookmarks/all');
      setBookmarks(res.data?.data?.posts || []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[19px] sm:text-[20px] font-black text-[#0F1419]">Bookmarks</h1>
            <p className="text-[13px] text-[#536471]">
              @{currentUser?.username || 'user'} · {bookmarks.length} {bookmarks.length === 1 ? 'post' : 'posts'}
            </p>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchBookmarks();
            }}
            disabled={refreshing}
            className="p-2 text-[#536471] hover:text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
            title="Refresh bookmarks"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-[14px] text-[#536471]">Loading your saved posts...</p>
          </div>
        ) : !currentUser?.username ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <Bookmark size={26} />
            </div>
            <h3 className="text-[19px] font-bold text-[#0F1419]">Save posts for later</h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1 mb-4">
              Sign in to save interesting architectural insights, code snippets, and posts to your private bookmarks.
            </p>
            <button
              onClick={() => redirectToAuth(navigate, '/bookmarks')}
              className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full shadow-sm transition-all"
            >
              Sign in to SOLITX
            </button>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-[#F7F9F9] text-[#536471] rounded-full flex items-center justify-center mx-auto mb-3">
              <Bookmark size={26} />
            </div>
            <h3 className="text-[20px] font-black text-[#0F1419]">Save posts for later</h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1 mb-5">
              Don’t let the good posts fly away! Bookmark posts from your feed to easily find them again anytime.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-[#0F1419] hover:bg-[#272C30] text-white font-bold text-[14px] rounded-full transition-colors"
            >
              Go to Home Timeline
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#EFF3F4]">
            {bookmarks.map((post) => (
              <PostCard
                key={post.id}
                post={{ ...post, has_bookmarked: true }}
                onNavigate={() => navigate(`/post/${post.id}`)}
                onPostDeleted={(id) => setBookmarks((prev) => prev.filter((p) => p.id !== id))}
                onPostUpdated={(updated) =>
                  setBookmarks((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Bookmarks;
