import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ImageIcon,
  BarChart2,
  Smile,
  Calendar,
  MapPin,
  Sparkles,
  RefreshCw,
  X,
  Check,
  Loader2,
  AtSign
} from 'lucide-react';
import AppShell, { SolitxLogo } from '../components/AppShell';
import PostCard from '../components/PostCard';
import OnboardingModal from '../components/OnboardingModal';
import AuthRequiredModal from '../components/AuthRequiredModal';
import api from '../api';
import { uploadMediaDirectToS3 } from '../utils/mediaUpload';
import { getAvatarUrl } from '../utils/avatar';
import MentionDropdown, { useMentionAutocomplete } from '../components/MentionAutocomplete';

const Home = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('For you');
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUserUpdate = (e) => {
      try {
        const stored = localStorage.getItem('user');
        const parsed = e?.detail || (stored ? JSON.parse(stored) : null);
        if (parsed) {
          setUser(parsed);
          if (parsed.avatar_url && parsed.username) {
            setPosts((prev) =>
              prev.map((p) =>
                p.username === parsed.username
                  ? { ...p, author_avatar_url: parsed.avatar_url }
                  : p
              )
            );
          }
        }
      } catch {}
    };
    window.addEventListener('user-updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate);
    return () => {
      window.removeEventListener('user-updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, []);

  const [showOnboarding, setShowOnboarding] = useState(
    localStorage.getItem('show_onboarding') === 'true'
  );
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Composer State
  const [postText, setPostText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postError, setPostError] = useState('');

  // @Mention Autocomplete State
  const textareaRef = useRef(null);
  const {
    mentionState,
    suggestions,
    loading: mentionLoading,
    selectedIndex,
    checkMentionTrigger,
    selectUser,
    handleKeyDown: handleMentionKeyDown,
    triggerMention,
  } = useMentionAutocomplete({ text: postText, setText: setPostText, textareaRef });
  
  // Media Upload State
  const fileInputRef = useRef(null);
  const [mediaState, setMediaState] = useState(null);

  // Feed State
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const topicTabs = ['For you', 'Following', 'Trending', 'News', 'Sports', 'Entertainment', 'Tech & AI', 'Business'];

  // User check (do not force redirect to /auth for public feed)
  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      if (localStorage.getItem('show_onboarding') === 'true') {
        setShowOnboarding(true);
      }
    };

    handleSync();
    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  // Fetch Feed Function
  const fetchFeed = async (cursor = null, tab = activeTab) => {
    try {
      if (!cursor) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const queryParts = [];
      if (cursor) queryParts.push(`cursor=${encodeURIComponent(cursor)}`);
      
      if (tab === 'Following') {
        queryParts.push('filter=following');
      } else if (tab === 'Trending') {
        queryParts.push('filter=trending');
      } else if (tab !== 'For you') {
        queryParts.push(`category=${encodeURIComponent(tab)}`);
      }

      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const url = `/posts/feed${queryString}`;

      const res = await api.get(url);

      if (res.data?.data) {
        const fetchedPosts = res.data.data.posts || [];
        if (cursor) {
          setPosts(prev => [...prev, ...fetchedPosts]);
        } else {
          setPosts(fetchedPosts);
        }
        setNextCursor(res.data.data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial Load & Event Listener for posts created via ComposeModal
  useEffect(() => {
    fetchFeed(null, activeTab);

    const handleExternalPost = (e) => {
      const newPost = e.detail;
      if (newPost) {
        setPosts(prev => [newPost, ...prev]);
      }
    };

    window.addEventListener('post-created', handleExternalPost);
    return () => window.removeEventListener('post-created', handleExternalPost);
  }, [activeTab]);

  // File change handler for S3 direct upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setMediaState({
      file,
      previewUrl,
      mediaId: null,
      status: 'uploading',
      progress: 0,
      error: null,
    });
    setPostError('');

    try {
      const { mediaId } = await uploadMediaDirectToS3(file, (percent) => {
        setMediaState((prev) => (prev ? { ...prev, progress: percent } : null));
      });
      setMediaState((prev) => (prev ? { ...prev, mediaId, status: 'ready', progress: 100 } : null));
    } catch (err) {
      setMediaState((prev) => (prev ? { ...prev, status: 'error', error: err.message } : null));
      setPostError(err.message || 'Image upload failed');
    }
  };

  const handleRemoveMedia = () => {
    if (mediaState?.previewUrl) {
      URL.revokeObjectURL(mediaState.previewUrl);
    }
    setMediaState(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Post Submission from Inline Composer
  const handleCreatePost = async () => {
    if ((!postText.trim() && !mediaState?.mediaId) || isSubmitting || postText.length > 500) return;
    if (mediaState && mediaState.status === 'uploading') return;

    try {
      setIsSubmitting(true);
      setPostError('');
      const payload = { 
        content: postText.trim(),
        media_ids: mediaState?.mediaId ? [mediaState.mediaId] : undefined,
      };
      if (activeTab !== 'For you' && activeTab !== 'Following' && activeTab !== 'Trending') {
        payload.category = activeTab;
      }
      const res = await api.post('/posts', payload);
      if (res.data?.data?.post) {
        setPosts(prev => [res.data.data.post, ...prev]);
        setPostText('');
        handleRemoveMedia();
      }
    } catch (err) {
      setPostError(err.response?.data?.message || 'Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostDeleted = (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const charLeft = 500 - postText.length;

  return (
    <AppShell rightSidebar>
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-[#EFF3F4]">
        {/* Mobile Header Row */}
        <div className="md:hidden flex items-center justify-between px-4 h-[53px]">
          {user?.username ? (
            <button
              onClick={() => window.dispatchEvent(new Event('open-drawer'))}
              className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden active:scale-95 transition-transform"
            >
              <img
                src={getAvatarUrl(user)}
                alt="me"
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="px-3.5 py-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-bold rounded-full transition-all shadow-sm"
            >
              Sign in
            </button>
          )}
          <div
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="cursor-pointer hover:opacity-80 transition-all p-1 flex items-center justify-center active:scale-95"
            title="SOLITX Home"
          >
            <SolitxLogo size={36} className="text-[#0F1419] hover:text-[#7C3AED] transition-colors" />
          </div>
          <button
            onClick={() => fetchFeed()}
            className="p-1.5 text-[#536471] hover:text-[#7C3AED] rounded-full transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>
        </div>

        {/* Desktop Title */}
        <div className="hidden md:flex items-center justify-between px-4 h-[53px]">
          <h1
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-bold text-[19px] text-[#0F1419] cursor-pointer hover:opacity-80 transition-opacity"
            title="Back to Top"
          >
            Home
          </h1>
          <button
            onClick={() => fetchFeed()}
            title="Refresh Feed"
            className="p-2 text-[#536471] hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 rounded-full transition-all"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>
        </div>

        {/* Topic Tabs */}
        <div className="flex overflow-x-auto border-t border-[#EFF3F4]" style={{ scrollbarWidth: 'none' }}>
          {topicTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-3.5 text-[15px] transition-colors relative whitespace-nowrap
                ${activeTab === tab ? 'font-bold text-[#0F1419]' : 'text-[#536471] hover:bg-[#F7F9F9]'}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-3 right-3 h-1 bg-[#7C3AED] rounded-full" />
              )}
            </button>
          ))}
        </div>
        {loading && (
          <div className="h-0.5 w-full bg-purple-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#7C3AED] via-indigo-500 to-pink-500 w-full animate-pulse" />
          </div>
        )}
      </div>

      {/* Desktop Compose Box */}
      {user?.username ? (
        <div className="hidden md:flex gap-3 px-4 py-3 border-b border-[#EFF3F4]">
          <div
            onClick={() => navigate(`/profile/${user.username}`)}
            className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <img
              src={getAvatarUrl(user)}
              alt="me"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="relative">
              <textarea
                ref={textareaRef}
                placeholder="What is happening?!"
                className="w-full text-[17px] text-[#0F1419] placeholder:text-[#536471] border-none focus:ring-0 resize-none outline-none leading-snug pt-2 min-h-[60px]"
                value={postText}
                onChange={e => {
                  setPostText(e.target.value);
                  setTimeout(checkMentionTrigger, 0);
                }}
                onKeyUp={checkMentionTrigger}
                onClick={checkMentionTrigger}
                onKeyDown={(e) => {
                  handleMentionKeyDown(e);
                }}
                maxLength={500}
                rows={postText.length > 70 ? 3 : 2}
              />
              <MentionDropdown
                mentionState={mentionState}
                suggestions={suggestions}
                loading={mentionLoading}
                selectedIndex={selectedIndex}
                onSelect={selectUser}
                className="top-full left-0 mt-1"
              />
            </div>

            {/* Media Image Preview Container */}
            {mediaState && (
              <div className="relative mt-2 mb-3 rounded-2xl overflow-hidden border border-[#EFF3F4] bg-[#0F1419]/5 max-h-[260px] flex items-center justify-center group/img">
                <img
                  src={mediaState.previewUrl}
                  alt="Upload preview"
                  className="w-full h-full max-h-[260px] object-cover"
                />

                {/* Remove Image Button */}
                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full backdrop-blur-md transition-all shadow-md active:scale-95"
                  title="Remove image"
                >
                  <X size={16} />
                </button>

                {/* Uploading progress overlay */}
                {mediaState.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-md flex flex-col items-center justify-center text-white px-6 transition-all duration-200">
                    <div className="relative mb-3 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin" />
                      <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-ping opacity-30" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[14px] font-bold text-white tracking-wide">
                      <span>Uploading</span>
                      <span className="flex tracking-widest animate-pulse">...</span>
                      <span className="text-[12px] font-semibold text-violet-300 ml-1 tabular-nums">
                        {mediaState.progress}%
                      </span>
                    </div>
                    <div className="w-48 h-1.5 bg-white/15 rounded-full mt-3 overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-200 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                        style={{ width: `${mediaState.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Ready Badge */}
                {mediaState.status === 'ready' && (
                  <div className="absolute bottom-2.5 left-2.5 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold rounded-full flex items-center gap-1.5 shadow-md border border-white/10">
                    <Check size={12} className="text-emerald-400 stroke-[3]" />
                    <span>Photo attached</span>
                  </div>
                )}

                {/* Error State */}
                {mediaState.status === 'error' && (
                  <div className="absolute inset-0 bg-red-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-white px-4 text-center">
                    <p className="text-[13px] font-bold text-red-200 mb-2">
                      {mediaState.error || 'Upload failed'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="px-3.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full text-[12px] font-semibold transition-colors"
                    >
                      Remove & Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {postError && (
              <p className="text-red-500 text-[13px] font-medium mb-2">{postError}</p>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#EFF3F4] mt-1">
              <div className="flex items-center gap-0.5 text-[#7C3AED]">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mediaState?.status === 'uploading'}
                  className="p-2 rounded-full hover:bg-[#7C3AED]/10 disabled:opacity-40 transition-colors"
                  title="Add photos"
                >
                  <ImageIcon size={17} />
                </button>
                <button
                  type="button"
                  onClick={triggerMention}
                  className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"
                  title="Mention a developer (@)"
                >
                  <AtSign size={17} />
                </button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><BarChart2 size={17} /></button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><Smile size={17} /></button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><Calendar size={17} /></button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><MapPin size={17} /></button>
              </div>

              <div className="flex items-center gap-3">
                {postText.length > 0 && (
                  <span className={`text-[13px] font-medium ${charLeft < 20 ? 'text-red-500 font-bold' : 'text-[#536471]'}`}>
                    {charLeft}
                  </span>
                )}
                <button
                  onClick={handleCreatePost}
                  disabled={(!postText.trim() && !mediaState?.mediaId) || isSubmitting || postText.length > 500 || mediaState?.status === 'uploading'}
                  className="px-5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-full transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Posting...' : mediaState?.status === 'uploading' ? 'Uploading...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setShowAuthModal(true)}
          className="hidden md:flex items-center justify-between px-4 py-3.5 border-b border-[#EFF3F4] bg-[#F7F9F9]/40 hover:bg-[#F7F9F9] cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-bold text-[15px] text-[#0F1419]">Join the discussion on SOLITX</p>
              <p className="text-[13px] text-[#536471]">Sign in or create an account to publish posts and interact.</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
            className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full shadow-sm"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Feed Timeline */}
      <div className="pb-[72px] md:pb-12">
        {loading && posts.length === 0 ? (
          // Skeletons
          <div className="divide-y divide-[#EFF3F4]">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 px-4 py-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mb-4">
              <Sparkles size={28} />
            </div>
            {activeTab === 'Following' ? (
              !user ? (
                <>
                  <h2 className="font-extrabold text-[20px] text-[#0F1419] mb-1">
                    See posts from people you follow
                  </h2>
                  <p className="text-[15px] text-[#536471] max-w-sm mb-6 leading-relaxed">
                    Sign in to follow creators, developers, and builders, and see their posts here.
                  </p>
                  <button
                    onClick={() => navigate('/auth')}
                    className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full transition-all shadow-md active:scale-95"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  <h2 className="font-extrabold text-[20px] text-[#0F1419] mb-1">
                    You aren’t following anyone yet
                  </h2>
                  <p className="text-[15px] text-[#536471] max-w-sm mb-6 leading-relaxed">
                    When you follow accounts from Who to follow or user profiles, their posts will show up here.
                  </p>
                  <button
                    onClick={() => setActiveTab('For you')}
                    className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full transition-all shadow-md active:scale-95"
                  >
                    Explore For You
                  </button>
                </>
              )
            ) : activeTab !== 'For you' ? (
              <>
                <h2 className="font-extrabold text-[20px] text-[#0F1419] mb-1">No posts in {activeTab} yet</h2>
                <p className="text-[15px] text-[#536471] max-w-sm mb-6 leading-relaxed">
                  Be the first developer to start a discussion in #{activeTab}!
                </p>
                <button
                  onClick={() => window.dispatchEvent(new Event('open-compose'))}
                  className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full transition-all shadow-md active:scale-95"
                >
                  Write in {activeTab}
                </button>
              </>
            ) : (
              <>
                <h2 className="font-extrabold text-[20px] text-[#0F1419] mb-1">Welcome to SOLITX!</h2>
                <p className="text-[15px] text-[#536471] max-w-sm mb-6 leading-relaxed">
                  Your timeline is empty. Be the very first developer to publish a post and start the conversation!
                </p>
                <button
                  onClick={() => window.dispatchEvent(new Event('open-compose'))}
                  className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full transition-all shadow-md active:scale-95"
                >
                  Write a Post
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onNavigate={navigate}
                onPostDeleted={handlePostDeleted}
                onPostUpdated={handlePostUpdated}
              />
            ))}

            {/* Load More Button */}
            {nextCursor && (
              <div className="p-4 text-center border-t border-[#EFF3F4]">
                <button
                  onClick={() => fetchFeed(nextCursor, activeTab)}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-white hover:bg-[#F7F9F9] text-[#7C3AED] font-bold text-[14px] rounded-full border border-[#EFF3F4] transition-colors shadow-sm disabled:opacity-50"
                >
                  {loadingMore ? 'Loading more...' : 'Show more posts'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Onboarding Modal for New Users */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          const freshUser = JSON.parse(localStorage.getItem('user') || 'null');
          setUser(freshUser);
          fetchFeed();
        }}
      />

      {/* Auth Gate for Unauthenticated Users */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        actionName="create posts and participate in the timeline"
      />
    </AppShell>
  );
};

export default Home;
