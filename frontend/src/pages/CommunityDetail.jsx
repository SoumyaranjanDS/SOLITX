import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  ShieldCheck, 
  Sparkles, 
  SquarePen, 
  Flame, 
  Send,
  UserPlus,
  X
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard from '../components/PostCard';
import api from '../api';

const CommunityDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [community, setCommunity] = useState(null);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'members'
  
  // Feed state
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Members state
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // In-community Post Composer
  const [postText, setPostText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState('');

  // Add Member Modal State & Autocomplete
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberUsername, setMemberUsername] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const fetchCommunityDetails = async () => {
    try {
      setLoadingCommunity(true);
      const res = await api.get(`/communities/${slug}`);
      setCommunity(res.data?.data?.community || null);
    } catch (err) {
      console.error('Failed to load community details:', err);
    } finally {
      setLoadingCommunity(false);
    }
  };

  const fetchCommunityFeed = async () => {
    try {
      setLoadingFeed(true);
      const res = await api.get(`/communities/${slug}/feed`);
      setPosts(res.data?.data?.posts || []);
    } catch (err) {
      console.error('Failed to load community feed:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  const fetchCommunityMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await api.get(`/communities/${slug}/members`);
      setMembers(res.data?.data?.members || []);
    } catch (err) {
      console.error('Failed to load community members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchCommunityDetails();
    fetchCommunityFeed();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'members') {
      fetchCommunityMembers();
    }
  }, [activeTab, slug]);

  const toggleJoin = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!community) return;

    try {
      const nextJoined = !community.is_joined;
      const currentCount = parseInt(community.members_count || 0, 10);
      setCommunity(prev => prev ? {
        ...prev,
        is_joined: nextJoined,
        members_count: nextJoined ? currentCount + 1 : Math.max(0, currentCount - 1)
      } : null);

      const res = await api.post(`/communities/${community.id}/join`);
      if (res.data?.data) {
        setCommunity(prev => prev ? {
          ...prev,
          is_joined: res.data.data.isJoined,
          members_count: res.data.data.membersCount
        } : null);
        if (activeTab === 'members') fetchCommunityMembers();
      }
    } catch (err) {
      console.error('Failed to toggle join:', err);
      fetchCommunityDetails();
    }
  };

  // Live autocomplete suggestions when modal is open
  useEffect(() => {
    if (!showAddMemberModal) {
      setSuggestions([]);
      setMemberUsername('');
      setAddMemberError('');
      return;
    }

    const timer = setTimeout(() => {
      setLoadingSuggestions(true);
      const params = memberUsername.trim() ? { q: memberUsername.trim() } : {};
      api.get('/users/suggestions', { params })
        .then((res) => {
          setSuggestions(res.data?.data?.users || []);
        })
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [memberUsername, showAddMemberModal]);

  const handleAddMember = async (e, directUsername = null) => {
    if (e?.preventDefault) e.preventDefault();
    const target = (directUsername || memberUsername).trim().replace(/^@/, '');
    if (!target || addingMember || !community) return;

    try {
      setAddingMember(true);
      setAddMemberError('');
      const res = await api.post(`/communities/${community.id}/members`, {
        username: target
      });

      if (res.data?.data?.member) {
        setMemberUsername('');
        setShowAddMemberModal(false);
        setCommunity(prev => prev ? {
          ...prev,
          members_count: res.data.data.membersCount
        } : null);
        fetchCommunityMembers();
      }
    } catch (err) {
      setAddMemberError(err.response?.data?.message || 'Failed to add member to community');
    } finally {
      setAddingMember(false);
    }
  };

  const handleCreatePost = async (e) => {
    e?.preventDefault();
    if (!postText.trim() || isPosting || !community) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!community.is_joined && !community.is_creator) {
      setPostError(`You must join c/${community.slug} before posting.`);
      return;
    }

    try {
      setIsPosting(true);
      setPostError('');
      const res = await api.post('/posts', {
        content: postText.trim(),
        community_id: community.id
      });

      if (res.data?.data?.post) {
        setPosts(prev => [res.data.data.post, ...prev]);
        setPostText('');
        setCommunity(prev => prev ? {
          ...prev,
          posts_count: (parseInt(prev.posts_count || 0, 10) + 1)
        } : null);
      }
    } catch (err) {
      setPostError(err.response?.data?.message || 'Failed to post in community');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header with Back Button */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/communities')}
              className="p-2 -ml-2 text-[#0F1419] hover:bg-[#F7F9F9] rounded-full transition-colors active:scale-95"
              title="Back to Communities"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-[19px] font-black text-[#0F1419] flex items-center gap-1.5 leading-snug">
                {community?.name || 'Community'}
                <ShieldCheck size={16} className="text-[#7C3AED]" />
              </h1>
              <p className="text-[12px] text-[#536471]">
                c/{community?.slug || slug}
              </p>
            </div>
          </div>

          {community && (
            <button
              onClick={toggleJoin}
              className={`px-5 py-2 rounded-full text-[14px] font-bold transition-all shadow-sm ${
                community.is_joined
                  ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                  : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white active:scale-95'
              }`}
            >
              {community.is_joined ? 'Joined' : 'Join Community'}
            </button>
          )}
        </div>

        {/* Community Hero & Banner */}
        {loadingCommunity ? (
          <div className="p-4 animate-pulse">
            <div className="h-28 rounded-2xl bg-gray-200 mb-4" />
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        ) : community ? (
          <div>
            <div className={`h-32 sm:h-36 rounded-b-2xl bg-gradient-to-r ${community.banner_gradient || 'from-purple-600 to-indigo-800'} p-4 flex flex-col justify-end relative shadow-inner`}>
              <div className="flex items-center justify-between text-white/95">
                <span className="text-[13px] font-bold bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
                  c/{community.slug}
                </span>
                <span className="text-[12px] font-semibold bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  Admin: @{community.creator_username}
                </span>
              </div>
            </div>

            <div className="p-4 border-b border-[#EFF3F4]">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[22px] font-black text-[#0F1419]">{community.name}</h2>
                <ShieldCheck size={20} className="text-[#7C3AED]" />
              </div>

              {community.description && (
                <p className="text-[15px] text-[#536471] mb-3 leading-relaxed">
                  {community.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-[14px] text-[#536471]">
                <span className="cursor-pointer hover:underline" onClick={() => setActiveTab('members')}>
                  <strong className="text-[#0F1419]">{community.members_count || 0}</strong> Members
                </span>
                <span>
                  <strong className="text-[#0F1419]">{community.posts_count || posts.length}</strong> Discussions
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[#536471]">
            Community not found.
          </div>
        )}

        {/* In-Community Post Composer */}
        {community && (
          <div className="p-4 border-b border-[#EFF3F4] bg-[#F7F9F9]/50">
            {!user ? (
              <div 
                onClick={() => navigate('/auth')}
                className="p-3.5 bg-white rounded-2xl border border-[#EFF3F4] flex items-center justify-between cursor-pointer hover:border-[#7C3AED]/40 transition-colors"
              >
                <div className="flex items-center gap-2 text-[14px] text-[#536471]">
                  <SquarePen size={17} className="text-[#7C3AED]" />
                  <span>Sign in to start a discussion in this community</span>
                </div>
                <button className="px-4 py-1.5 bg-[#7C3AED] text-white text-[13px] font-bold rounded-full">
                  Sign in
                </button>
              </div>
            ) : (!community.is_joined && !community.is_creator) ? (
              <div className="p-4 bg-white rounded-2xl border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-[#7C3AED] flex items-center justify-center flex-shrink-0">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0F1419]">Join this community to post</p>
                    <p className="text-[12px] text-[#536471]">Only members of c/{community.slug} can participate in discussions.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleJoin}
                  disabled={isJoining}
                  className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[13px] rounded-full transition-all shadow-sm active:scale-95 flex-shrink-0"
                >
                  {isJoining ? 'Joining...' : 'Join Community'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePost}>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                      alt={user.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <textarea
                      rows={2}
                      placeholder={`Share something with c/${community.slug}...`}
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      maxLength={500}
                      className="w-full bg-white border border-[#EFF3F4] focus:border-[#7C3AED] rounded-2xl p-3 text-[15px] outline-none resize-none transition-colors shadow-xs"
                    />
                    {postError && (
                      <p className="text-[12px] text-red-500 mb-2 font-medium">{postError}</p>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[12px] text-[#536471]">
                        {500 - postText.length} characters left
                      </span>
                      <button
                        type="submit"
                        disabled={!postText.trim() || isPosting}
                        className="px-5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white font-bold text-[13px] rounded-full transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <Send size={14} />
                        <span>{isPosting ? 'Posting...' : 'Post'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#EFF3F4]">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-3 text-[15px] font-bold text-center transition-colors relative hover:bg-[#F7F9F9] ${
              activeTab === 'feed' ? 'text-[#0F1419]' : 'text-[#536471]'
            }`}
          >
            Discussions
            {activeTab === 'feed' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#7C3AED] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-[15px] font-bold text-center transition-colors relative hover:bg-[#F7F9F9] ${
              activeTab === 'members' ? 'text-[#0F1419]' : 'text-[#536471]'
            }`}
          >
            Members ({community?.members_count || 0})
            {activeTab === 'members' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#7C3AED] rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Discussions Feed */}
        {activeTab === 'feed' && (
          <div className="pb-16">
            {loadingFeed ? (
              <div className="divide-y divide-[#EFF3F4]">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 px-4 py-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Flame size={24} />
                </div>
                <h3 className="text-[18px] font-bold text-[#0F1419] mb-1">
                  No discussions in this community yet
                </h3>
                <p className="text-[14px] text-[#536471] max-w-sm mx-auto mb-5 leading-relaxed">
                  Be the very first developer to kick off the conversation in c/{community?.slug}!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EFF3F4]">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onNavigate={navigate}
                    onPostDeleted={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
                    onPostUpdated={(updated) =>
                      setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Members List */}
        {activeTab === 'members' && (
          <div className="pb-16">
            {(community?.is_creator || community?.role === 'admin') && (
              <div className="px-4 py-3 bg-[#F7F9F9]/80 border-b border-[#EFF3F4] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#536471]">
                  Community Members ({community.members_count || 0})
                </span>
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-bold rounded-full transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <UserPlus size={14} />
                  <span>Add Member</span>
                </button>
              </div>
            )}

            <div className="divide-y divide-[#EFF3F4]">
              {loadingMembers ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 bg-gray-200 rounded w-1/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="p-12 text-center text-[#536471]">
                  No members found in this community.
                </div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="p-4 flex items-center justify-between hover:bg-[#F7F9F9] transition-colors">
                    <div 
                      onClick={() => navigate(`/profile/${member.username}`)}
                      className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.username}`}
                          alt={member.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[15px] text-[#0F1419] truncate">{member.name || member.username}</p>
                          {member.role === 'admin' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#7C3AED] text-white">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#536471] truncate">@{member.username}</p>
                        {member.bio && (
                          <p className="text-[13px] text-[#536471] mt-0.5 line-clamp-1">{member.bio}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Add Member to Community Modal with Live Suggestions */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[420px] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFF3F4]">
              <h3 className="font-extrabold text-[17px] text-[#0F1419]">Add Member to Community</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-[#536471] hover:text-[#0F1419]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#536471] mb-1">
                  Developer Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#536471] font-bold">@</span>
                  <input
                    type="text"
                    placeholder="Search or enter username..."
                    value={memberUsername}
                    onChange={(e) => setMemberUsername(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-[#CFD9DE] rounded-xl text-[14px] outline-none focus:border-[#7C3AED]"
                    autoFocus
                  />
                </div>
                {addMemberError && (
                  <p className="text-[12px] text-red-500 mt-1 font-medium">{addMemberError}</p>
                )}

                {/* Suggestions List */}
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#536471] mb-1.5">
                    {memberUsername.trim() ? 'Matching Developers' : 'Suggested Developers'}
                  </p>

                  {loadingSuggestions ? (
                    <div className="py-4 text-center text-[13px] text-[#536471] flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                      <span>Searching developers...</span>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <p className="text-[13px] text-[#536471] py-2 text-center bg-gray-50 rounded-xl">
                      No matching developers found.
                    </p>
                  ) : (
                    <div className="max-h-[190px] overflow-y-auto space-y-1 pr-1 divide-y divide-gray-100 border border-gray-100 rounded-xl p-1.5 bg-[#F7F9F9]/50">
                      {suggestions.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition-colors group cursor-pointer"
                          onClick={() => handleAddMember(null, u.username)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                              <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                                alt={u.username}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[13px] text-[#0F1419] truncate leading-tight">
                                {u.name || u.username}
                              </p>
                              <p className="text-[12px] text-[#536471] truncate leading-tight">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={addingMember}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddMember(null, u.username);
                            }}
                            className="px-3 py-1 bg-purple-100 hover:bg-[#7C3AED] text-[#7C3AED] hover:text-white text-[12px] font-bold rounded-full transition-colors flex-shrink-0 shadow-xs"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EFF3F4]">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 font-bold text-[14px] text-[#536471] hover:bg-gray-100 rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!memberUsername.trim() || addingMember}
                  className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white font-bold text-[14px] rounded-full transition-colors shadow-sm"
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default CommunityDetail;
