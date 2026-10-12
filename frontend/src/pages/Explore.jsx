import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Sparkles, Hash, X, ArrowLeft, RefreshCw } from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard from '../components/PostCard';
import api from '../api';

const CATEGORIES = ['For you', 'Trending', 'Tech & AI', 'Business', 'Sports', 'News', 'Entertainment'];

const Explore = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryFromUrl = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(queryFromUrl);
  const [activeCategory, setActiveCategory] = useState(queryFromUrl ? 'Tech & AI' : 'For you');
  
  const [posts, setPosts] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sync state when URL param changes
  useEffect(() => {
    setSearchInput(queryFromUrl);
    fetchExploreFeed(queryFromUrl);
  }, [queryFromUrl]);

  // Fetch live trending topics
  useEffect(() => {
    api.get('/posts/trending')
      .then((res) => setTrendingTopics(res.data?.data?.trends || []))
      .catch(() => {})
      .finally(() => setLoadingTrends(false));
  }, []);

  const fetchExploreFeed = async (query = '') => {
    try {
      setLoading(true);
      const params = {};
      if (query.trim()) {
        params.q = query.trim();
      }
      const res = await api.get('/posts/feed', { params });
      setPosts(res.data?.data?.posts || []);
    } catch (err) {
      console.error('Failed to load explore feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
    } else {
      setSearchParams({});
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const handleTagClick = (tag) => {
    setSearchInput(tag);
    setSearchParams({ q: tag });
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    if (cat === 'For you' || cat === 'Trending') {
      setSearchInput('');
      setSearchParams({});
    } else {
      setSearchInput(cat);
      setSearchParams({ q: cat });
    }
  };

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Search Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 py-2.5">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-[#536471] pointer-events-none" />
            <input
              type="text"
              placeholder="Search posts, tags, or developers..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#EFF3F4] focus:bg-white text-[#0F1419] placeholder:text-[#536471] rounded-full text-[15px] border border-transparent focus:border-[#7C3AED] outline-none transition-all shadow-inner"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 p-1 rounded-full text-[#536471] hover:text-[#0F1419] hover:bg-[#E7ECF0]"
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Categories Tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar pt-2.5 -mx-4 px-4 border-t border-[#EFF3F4]/50 mt-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-3.5 py-1.5 rounded-full text-[14px] font-bold whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#0F1419] text-white'
                    : 'text-[#536471] hover:bg-[#EFF3F4] hover:text-[#0F1419]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Section if no active search query */}
        {!queryFromUrl && (
          <div className="border-b border-[#EFF3F4]">
            <div className="relative p-5 bg-gradient-to-r from-[#7C3AED]/15 via-purple-50 to-pink-50 overflow-hidden">
              <div className="relative z-10 max-w-lg">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-[#7C3AED] text-white mb-2">
                  <Sparkles size={13} />
                  What's happening
                </span>
                <h1 className="text-[22px] sm:text-[24px] font-black text-[#0F1419] tracking-tight leading-snug">
                  Explore Trending Tech Discussions
                </h1>
                <p className="text-[#536471] text-[14px] mt-1">
                  Discover top technical insights, system design architecture, and discussions from the global developer network.
                </p>
              </div>
            </div>

            {/* Trending Topics Grid */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[17px] font-extrabold text-[#0F1419] flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#7C3AED]" />
                  Trending Topics
                </h2>
                <span className="text-[11px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded-full uppercase">Live</span>
              </div>
              {loadingTrends ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-3.5 rounded-2xl border border-[#EFF3F4] animate-pulse">
                      <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : trendingTopics.length === 0 ? (
                <div className="p-6 text-center border border-[#EFF3F4] rounded-2xl bg-[#F7F9F9]/50">
                  <p className="text-[14px] font-bold text-[#0F1419]">No trending hashtags yet</p>
                  <p className="text-[13px] text-[#536471] mt-1">
                    Include a #hashtag in any post to start a live trend on SOLITX!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {trendingTopics.map((topic) => (
                    <div
                      key={topic.tag}
                      onClick={() => handleTagClick(topic.tag)}
                      className="p-3.5 rounded-2xl border border-[#EFF3F4] hover:border-[#CFD9DE] hover:bg-[#F7F9F9] cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[12px] text-[#536471] font-medium">#{topic.rank} · Trending</span>
                        <span className="text-[12px] font-bold text-[#7C3AED] group-hover:underline">{topic.formatted_posts}</span>
                      </div>
                      <p className="font-extrabold text-[15px] text-[#0F1419] mt-0.5 group-hover:text-[#7C3AED] transition-colors">
                        {topic.tag}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Results / Feed Header */}
        <div className="px-4 py-3 border-b border-[#EFF3F4] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-[17px] text-[#0F1419]">
              {queryFromUrl ? `Results for "${queryFromUrl}"` : 'Recent Posts'}
            </h2>
            <span className="text-[13px] text-[#536471]">({posts.length})</span>
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              fetchExploreFeed(queryFromUrl);
            }}
            disabled={refreshing}
            className="p-1.5 text-[#536471] hover:text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
            title="Refresh feed"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>
        </div>

        {/* Posts Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-[14px] text-[#536471]">Searching SOLITX network...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <Search size={26} />
            </div>
            <h3 className="text-[18px] font-bold text-[#0F1419]">No results found</h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1">
              Try searching for common keywords like "postgres", "redis", "system design", or explore the trending topics above.
            </p>
            {queryFromUrl && (
              <button
                onClick={handleClearSearch}
                className="mt-4 px-5 py-2 bg-[#0F1419] text-white text-[14px] font-bold rounded-full hover:bg-[#272C30] transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EFF3F4]">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onNavigate={() => navigate(`/post/${post.id}`)}
                onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onPostUpdated={(updated) =>
                  setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Explore;
