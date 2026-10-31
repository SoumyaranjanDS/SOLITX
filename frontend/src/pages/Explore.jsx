import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  TrendingUp, 
  Sparkles, 
  Hash, 
  X, 
  RefreshCw, 
  User, 
  Users, 
  List as ListIcon, 
  MessageCircle,
  Lock,
  ArrowRight
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard from '../components/PostCard';
import api from '../api';
import { getAvatarUrl } from '../utils/avatar';
import { redirectToAuth } from '../utils/authRedirect';

const CATEGORIES = ['For you', 'Trending', 'Tech & AI', 'Business', 'Sports', 'News', 'Entertainment'];

const Explore = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryFromUrl = searchParams.get('q') || '';
  const tabFromUrl = searchParams.get('tab') || (queryFromUrl.startsWith('@') ? 'people' : 'top');

  const [searchInput, setSearchInput] = useState(queryFromUrl);
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [activeCategory, setActiveCategory] = useState(queryFromUrl ? 'Tech & AI' : 'For you');

  const [searchResults, setSearchResults] = useState({
    users: [],
    posts: [],
    communities: [],
    lists: []
  });
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  // Sync state when URL params change
  useEffect(() => {
    setSearchInput(queryFromUrl);
    if (queryFromUrl) {
      const targetTab = searchParams.get('tab') || (queryFromUrl.startsWith('@') ? 'people' : 'top');
      setActiveTab(targetTab);
      fetchSearchResults(queryFromUrl);
    } else {
      fetchDefaultFeed();
    }
  }, [queryFromUrl, searchParams.get('tab')]);

  // Sync tab with URL
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (queryFromUrl) {
      setSearchParams({ q: queryFromUrl, tab: tabId });
    }
  };

  // Fetch live trending topics
  useEffect(() => {
    api.get('/posts/trending')
      .then((res) => setTrendingTopics(res.data?.data?.trends || []))
      .catch(() => {})
      .finally(() => setLoadingTrends(false));
  }, []);

  const fetchSearchResults = async (query) => {
    try {
      setLoading(true);
      const res = await api.get('/search', { params: { q: query.trim(), limit: 30 } });
      const data = res.data?.data || {};
      setSearchResults({
        users: data.users || [],
        posts: data.posts || [],
        communities: data.communities || [],
        lists: data.lists || []
      });
    } catch (err) {
      console.error('Failed to load search results:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDefaultFeed = async () => {
    try {
      setLoading(true);
      const res = await api.get('/posts/feed');
      setSearchResults({
        users: [],
        posts: res.data?.data?.posts || [],
        communities: [],
        lists: []
      });
    } catch (err) {
      console.error('Failed to load default feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    if (q) {
      const defaultTab = q.startsWith('@') ? 'people' : 'top';
      setSearchParams({ q, tab: defaultTab });
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
    setSearchParams({ q: tag, tab: 'top' });
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    if (cat === 'For you' || cat === 'Trending') {
      setSearchInput('');
      setSearchParams({});
    } else {
      setSearchInput(cat);
      setSearchParams({ q: cat, tab: 'top' });
    }
  };

  // Follow / Unfollow user handler
  const handleFollowUser = async (targetUsername) => {
    if (!currentUser) {
      redirectToAuth(navigate, `/explore?q=${encodeURIComponent(queryFromUrl)}`);
      return;
    }
    try {
      setSearchResults(prev => ({
        ...prev,
        users: prev.users.map(u => {
          if (u.username === targetUsername) {
            const nextFollow = !u.is_following;
            const curCount = parseInt(u.followers_count || 0, 10);
            return {
              ...u,
              is_following: nextFollow,
              followers_count: nextFollow ? curCount + 1 : Math.max(0, curCount - 1)
            };
          }
          return u;
        })
      }));

      const res = await api.post(`/users/${targetUsername}/follow`);
      if (res.data?.data) {
        setSearchResults(prev => ({
          ...prev,
          users: prev.users.map(u =>
            u.username === targetUsername ? { ...u, is_following: res.data.data.isFollowing } : u
          )
        }));
      }
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  // Join / Leave community handler
  const handleJoinCommunity = async (commId) => {
    if (!currentUser) {
      redirectToAuth(navigate, `/explore?q=${encodeURIComponent(queryFromUrl)}`);
      return;
    }
    try {
      setSearchResults(prev => ({
        ...prev,
        communities: prev.communities.map(c => {
          if (c.id === commId) {
            const nextJoined = !c.is_joined;
            const curCount = parseInt(c.members_count || 0, 10);
            return {
              ...c,
              is_joined: nextJoined,
              members_count: nextJoined ? curCount + 1 : Math.max(0, curCount - 1)
            };
          }
          return c;
        })
      }));

      const res = await api.post(`/communities/${commId}/join`);
      if (res.data?.data) {
        setSearchResults(prev => ({
          ...prev,
          communities: prev.communities.map(c =>
            c.id === commId
              ? { ...c, is_joined: res.data.data.isJoined, members_count: res.data.data.membersCount }
              : c
          )
        }));
      }
    } catch (err) {
      console.error('Join community error:', err);
    }
  };

  // Follow / Unfollow list handler
  const handleFollowList = async (listId) => {
    if (!currentUser) {
      redirectToAuth(navigate, `/explore?q=${encodeURIComponent(queryFromUrl)}`);
      return;
    }
    try {
      setSearchResults(prev => ({
        ...prev,
        lists: prev.lists.map(l => {
          if (l.id === listId) {
            const nextFollow = !l.is_following;
            const curCount = parseInt(l.followers_count || 0, 10);
            return {
              ...l,
              is_following: nextFollow,
              followers_count: nextFollow ? curCount + 1 : Math.max(0, curCount - 1)
            };
          }
          return l;
        })
      }));

      const res = await api.post(`/lists/${listId}/follow`);
      if (res.data?.data) {
        setSearchResults(prev => ({
          ...prev,
          lists: prev.lists.map(l =>
            l.id === listId
              ? { ...l, is_following: res.data.data.isFollowing, followers_count: res.data.data.followersCount }
              : l
          )
        }));
      }
    } catch (err) {
      console.error('Follow list error:', err);
    }
  };

  // Render Person / Account Card
  const renderUserCard = (user) => {
    const isMe = currentUser?.username === user.username;
    return (
      <div
        key={user.id}
        onClick={() => navigate(`/profile/${user.username}`)}
        className="p-4 hover:bg-[#F7F9F9] cursor-pointer transition-colors flex items-start justify-between gap-3"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            <img src={getAvatarUrl(user)} alt={user.username} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-[15px] text-[#0F1419] hover:underline truncate">
                {user.name || user.username}
              </span>
            </div>
            <p className="text-[14px] text-[#536471] truncate">@{user.username}</p>
            {user.bio && (
              <p className="text-[14px] text-[#0F1419] mt-1.5 line-clamp-2 leading-relaxed">
                {user.bio}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-[13px] text-[#536471]">
              <span>
                <strong className="text-[#0F1419]">{user.followers_count || 0}</strong> {user.followers_count === 1 ? 'follower' : 'followers'}
              </span>
            </div>
          </div>
        </div>
        {!isMe && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFollowUser(user.username);
            }}
            className={`px-4 py-1.5 text-[14px] font-bold rounded-full transition-all flex-shrink-0 active:scale-95 ${
              user.is_following
                ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                : 'bg-[#0F1419] hover:bg-[#272C30] text-white shadow-sm'
            }`}
          >
            {user.is_following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
    );
  };

  // Render Community Card
  const renderCommunityCard = (comm) => (
    <div
      key={comm.id}
      onClick={() => navigate(`/community/${comm.slug || comm.id}`)}
      className="border border-[#EFF3F4] rounded-2xl p-4 hover:border-[#CFD9DE] hover:shadow-sm transition-all cursor-pointer bg-white flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${comm.banner_gradient || 'from-purple-600 to-indigo-600'} flex items-center justify-center text-white font-black text-xl shadow-sm flex-shrink-0`}>
            {comm.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleJoinCommunity(comm.id);
            }}
            className={`px-4 py-1.5 text-[13px] font-bold rounded-full transition-all flex-shrink-0 active:scale-95 ${
              comm.is_joined
                ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-sm'
            }`}
          >
            {comm.is_joined ? 'Joined' : 'Join'}
          </button>
        </div>
        <h3 className="font-extrabold text-[16px] text-[#0F1419] leading-snug line-clamp-1">
          {comm.name}
        </h3>
        {comm.description && (
          <p className="text-[13px] text-[#536471] mt-1 line-clamp-2 leading-relaxed">
            {comm.description}
          </p>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[#EFF3F4] flex items-center justify-between text-[12px] text-[#536471]">
        <span className="font-semibold text-[#0F1419]">
          {comm.members_count || 0} {(comm.members_count === 1) ? 'member' : 'members'}
        </span>
        {comm.creator_username && (
          <span>by @{comm.creator_username}</span>
        )}
      </div>
    </div>
  );

  // Render List Card
  const renderListCard = (list) => (
    <div
      key={list.id}
      onClick={() => navigate(`/lists/${list.id}`)}
      className="border border-[#EFF3F4] rounded-2xl p-4 hover:border-[#CFD9DE] hover:shadow-sm transition-all cursor-pointer bg-white flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[#7C3AED] flex items-center justify-center flex-shrink-0">
            <ListIcon size={22} />
          </div>
          {!list.is_creator && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFollowList(list.id);
              }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-full transition-all flex-shrink-0 active:scale-95 ${
                list.is_following
                  ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                  : 'bg-[#0F1419] hover:bg-[#272C30] text-white shadow-sm'
              }`}
            >
              {list.is_following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-extrabold text-[16px] text-[#0F1419] leading-snug line-clamp-1">
            {list.name}
          </h3>
          {list.is_private && <Lock size={13} className="text-[#536471] flex-shrink-0" />}
        </div>
        {list.description && (
          <p className="text-[13px] text-[#536471] mt-1 line-clamp-2 leading-relaxed">
            {list.description}
          </p>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[#EFF3F4] flex items-center justify-between text-[12px] text-[#536471]">
        <span>
          <strong className="text-[#0F1419]">{list.members_count || 0}</strong> members · <strong className="text-[#0F1419]">{list.followers_count || 0}</strong> followers
        </span>
        {list.creator_username && (
          <span>by @{list.creator_username}</span>
        )}
      </div>
    </div>
  );

  const hasAnyResults = 
    searchResults.users.length > 0 || 
    searchResults.posts.length > 0 || 
    searchResults.communities.length > 0 || 
    searchResults.lists.length > 0;

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Search Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 pt-2.5 pb-2">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-[#536471] pointer-events-none" />
            <input
              type="text"
              placeholder="Search posts, @accounts, communities, or lists..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#EFF3F4] focus:bg-white text-[#0F1419] placeholder:text-[#536471] rounded-full text-[15px] border border-transparent focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 outline-none transition-all shadow-inner"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 p-1 rounded-full text-[#536471] hover:text-[#0F1419] hover:bg-[#E7ECF0] transition-colors"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Search Navigation Tabs (when active search query) */}
          {queryFromUrl ? (
            <div className="flex border-t border-[#EFF3F4]/80 mt-2.5 overflow-x-auto no-scrollbar -mx-4 px-4">
              {[
                { id: 'top', label: 'Top' },
                { id: 'posts', label: `Posts (${searchResults.posts.length})` },
                { id: 'people', label: `People (${searchResults.users.length})` },
                { id: 'communities', label: `Communities (${searchResults.communities.length})` },
                { id: 'lists', label: `Lists (${searchResults.lists.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2.5 text-[14px] font-bold text-center whitespace-nowrap transition-colors relative hover:bg-[#F7F9F9] ${
                    activeTab === tab.id ? 'text-[#0F1419]' : 'text-[#536471]'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#7C3AED] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            /* Categories Tabs (when not searching) */
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
          )}
        </div>

        {/* Hero Section if no active search query */}
        {!queryFromUrl && (
          <div className="border-b border-[#EFF3F4]">
            <div className="relative p-5 bg-gradient-to-r from-[#7C3AED]/15 via-purple-50 to-pink-50 overflow-hidden">
              <div className="relative z-10 max-w-lg">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-[#7C3AED] text-white mb-2 shadow-sm">
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
                <span className="text-[11px] font-bold text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Live</span>
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

        {/* Results Header */}
        <div className="px-4 py-3 border-b border-[#EFF3F4] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-[17px] text-[#0F1419]">
              {queryFromUrl ? `Results for "${queryFromUrl}"` : 'Recent Posts'}
            </h2>
            {queryFromUrl && (
              <span className="text-[13px] text-[#536471]">
                ({activeTab === 'posts' ? searchResults.posts.length
                  : activeTab === 'people' ? searchResults.users.length
                  : activeTab === 'communities' ? searchResults.communities.length
                  : activeTab === 'lists' ? searchResults.lists.length
                  : searchResults.posts.length + searchResults.users.length + searchResults.communities.length + searchResults.lists.length})
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setRefreshing(true);
              if (queryFromUrl) fetchSearchResults(queryFromUrl);
              else fetchDefaultFeed();
            }}
            disabled={refreshing}
            className="p-1.5 text-[#536471] hover:text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
            title="Refresh results"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>
        </div>

        {/* Content Views */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            <p className="text-[14px] text-[#536471]">Searching SOLITX network...</p>
          </div>
        ) : queryFromUrl && !hasAnyResults ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <Search size={26} />
            </div>
            <h3 className="text-[18px] font-bold text-[#0F1419]">No results found for "{queryFromUrl}"</h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1">
              Try searching for a different keyword, account handles with @handle, community name, or explore trending topics above.
            </p>
            <button
              onClick={handleClearSearch}
              className="mt-4 px-5 py-2 bg-[#0F1419] text-white text-[14px] font-bold rounded-full hover:bg-[#272C30] transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div>
            {/* 1. TOP TAB: Unified View */}
            {activeTab === 'top' && (
              <div>
                {/* People Highlights */}
                {searchResults.users.length > 0 && (
                  <div className="border-b border-[#EFF3F4] bg-white">
                    <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                      <h3 className="font-extrabold text-[16px] text-[#0F1419] flex items-center gap-2">
                        <User size={18} className="text-[#7C3AED]" />
                        People
                      </h3>
                      {searchResults.users.length > 3 && (
                        <button
                          onClick={() => handleTabChange('people')}
                          className="text-[13px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                        >
                          View all ({searchResults.users.length})
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-[#EFF3F4]">
                      {searchResults.users.slice(0, 3).map(renderUserCard)}
                    </div>
                  </div>
                )}

                {/* Communities Highlights */}
                {searchResults.communities.length > 0 && (
                  <div className="border-b border-[#EFF3F4] bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-extrabold text-[16px] text-[#0F1419] flex items-center gap-2">
                        <Users size={18} className="text-[#7C3AED]" />
                        Communities
                      </h3>
                      {searchResults.communities.length > 2 && (
                        <button
                          onClick={() => handleTabChange('communities')}
                          className="text-[13px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                        >
                          View all ({searchResults.communities.length})
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchResults.communities.slice(0, 2).map(renderCommunityCard)}
                    </div>
                  </div>
                )}

                {/* Lists Highlights */}
                {searchResults.lists.length > 0 && (
                  <div className="border-b border-[#EFF3F4] bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-extrabold text-[16px] text-[#0F1419] flex items-center gap-2">
                        <ListIcon size={18} className="text-[#7C3AED]" />
                        Lists
                      </h3>
                      {searchResults.lists.length > 2 && (
                        <button
                          onClick={() => handleTabChange('lists')}
                          className="text-[13px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                        >
                          View all ({searchResults.lists.length})
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchResults.lists.slice(0, 2).map(renderListCard)}
                    </div>
                  </div>
                )}

                {/* Posts Feed */}
                {searchResults.posts.length > 0 ? (
                  <div>
                    {queryFromUrl && (searchResults.users.length > 0 || searchResults.communities.length > 0 || searchResults.lists.length > 0) && (
                      <div className="px-4 py-2.5 bg-[#F7F9F9] border-b border-[#EFF3F4]">
                        <h3 className="font-extrabold text-[14px] text-[#536471] uppercase tracking-wider flex items-center gap-1.5">
                          <MessageCircle size={14} className="text-[#7C3AED]" />
                          Posts
                        </h3>
                      </div>
                    )}
                    <div className="divide-y divide-[#EFF3F4]">
                      {searchResults.posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onNavigate={() => navigate(`/post/${post.id}`)}
                          onPostDeleted={(id) =>
                            setSearchResults((prev) => ({
                              ...prev,
                              posts: prev.posts.filter((p) => p.id !== id),
                            }))
                          }
                          onPostUpdated={(updated) =>
                            setSearchResults((prev) => ({
                              ...prev,
                              posts: prev.posts.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  !queryFromUrl && (
                    <div className="text-center py-16 text-[#536471]">
                      No posts available right now.
                    </div>
                  )
                )}
              </div>
            )}

            {/* 2. POSTS TAB */}
            {activeTab === 'posts' && (
              <div className="divide-y divide-[#EFF3F4]">
                {searchResults.posts.length === 0 ? (
                  <div className="text-center py-20 px-4">
                    <p className="text-[16px] font-bold text-[#0F1419]">No posts match "{queryFromUrl}"</p>
                    <p className="text-[13px] text-[#536471] mt-1">Try another search term or check spelling.</p>
                  </div>
                ) : (
                  searchResults.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onNavigate={() => navigate(`/post/${post.id}`)}
                      onPostDeleted={(id) =>
                        setSearchResults((prev) => ({
                          ...prev,
                          posts: prev.posts.filter((p) => p.id !== id),
                        }))
                      }
                      onPostUpdated={(updated) =>
                        setSearchResults((prev) => ({
                          ...prev,
                          posts: prev.posts.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
                        }))
                      }
                    />
                  ))
                )}
              </div>
            )}

            {/* 3. PEOPLE TAB */}
            {activeTab === 'people' && (
              <div className="divide-y divide-[#EFF3F4]">
                {searchResults.users.length === 0 ? (
                  <div className="text-center py-20 px-4">
                    <p className="text-[16px] font-bold text-[#0F1419]">No accounts match "{queryFromUrl}"</p>
                    <p className="text-[13px] text-[#536471] mt-1">Try searching for their username or display name.</p>
                  </div>
                ) : (
                  searchResults.users.map(renderUserCard)
                )}
              </div>
            )}

            {/* 4. COMMUNITIES TAB */}
            {activeTab === 'communities' && (
              <div className="p-4">
                {searchResults.communities.length === 0 ? (
                  <div className="text-center py-20 px-4">
                    <p className="text-[16px] font-bold text-[#0F1419]">No communities match "{queryFromUrl}"</p>
                    <p className="text-[13px] text-[#536471] mt-1">Try searching by topic, domain, or community name.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResults.communities.map(renderCommunityCard)}
                  </div>
                )}
              </div>
            )}

            {/* 5. LISTS TAB */}
            {activeTab === 'lists' && (
              <div className="p-4">
                {searchResults.lists.length === 0 ? (
                  <div className="text-center py-20 px-4">
                    <p className="text-[16px] font-bold text-[#0F1419]">No lists match "{queryFromUrl}"</p>
                    <p className="text-[13px] text-[#536471] mt-1">Try searching for curated lists by name or description.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {searchResults.lists.map(renderListCard)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Explore;
