import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  List as ListIcon, 
  Lock, 
  Users, 
  UserPlus, 
  Pin, 
  Trash2, 
  UserMinus, 
  X, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard from '../components/PostCard';
import api from '../api';

const ListDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [list, setList] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'members'
  
  // Feed state
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Members state
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Add Member Modal & Autocomplete Suggestions
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberUsername, setMemberUsername] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  const fetchListDetails = async () => {
    try {
      setLoadingList(true);
      const res = await api.get(`/lists/${id}`);
      setList(res.data?.data?.list || null);
    } catch (err) {
      console.error('Failed to load list details:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchListFeed = async () => {
    try {
      setLoadingFeed(true);
      const res = await api.get(`/lists/${id}/feed`);
      setPosts(res.data?.data?.posts || []);
    } catch (err) {
      console.error('Failed to load list feed:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await api.get(`/lists/${id}/members`);
      setMembers(res.data?.data?.members || []);
    } catch (err) {
      console.error('Failed to load list members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchListDetails();
    fetchListFeed();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    }
  }, [activeTab, id]);

  const toggleFollow = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      setList(prev => prev ? {
        ...prev,
        is_following: !prev.is_following,
        followers_count: !prev.is_following 
          ? parseInt(prev.followers_count || 0, 10) + 1 
          : Math.max(0, parseInt(prev.followers_count || 0, 10) - 1)
      } : null);

      const res = await api.post(`/lists/${id}/follow`);
      if (res.data?.data) {
        setList(prev => prev ? {
          ...prev,
          is_following: res.data.data.isFollowing,
          followers_count: res.data.data.followersCount
        } : null);
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      fetchListDetails();
    }
  };

  const togglePin = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      setList(prev => prev ? { ...prev, is_pinned: !prev.is_pinned } : null);
      const res = await api.post(`/lists/${id}/pin`);
      if (res.data?.data) {
        setList(prev => prev ? { ...prev, is_pinned: res.data.data.isPinned } : null);
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      fetchListDetails();
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm('Are you sure you want to delete this list?')) return;
    try {
      await api.delete(`/lists/${id}`);
      navigate('/lists');
    } catch (err) {
      console.error('Failed to delete list:', err);
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
    if (!target || addingMember) return;

    try {
      setAddingMember(true);
      setAddMemberError('');
      const res = await api.post(`/lists/${id}/members`, {
        username: target
      });

      if (res.data?.data?.member) {
        setMemberUsername('');
        setShowAddMemberModal(false);
        setList(prev => prev ? {
          ...prev,
          members_count: res.data.data.membersCount
        } : null);
        fetchMembers();
        fetchListFeed();
      }
    } catch (err) {
      setAddMemberError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from the list?')) return;
    try {
      const res = await api.delete(`/lists/${id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.id !== userId));
      setList(prev => prev ? {
        ...prev,
        members_count: res.data?.data?.membersCount ?? Math.max(0, parseInt(prev.members_count || 1, 10) - 1)
      } : null);
      fetchListFeed();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header with Back Button */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/lists')}
              className="p-2 -ml-2 text-[#0F1419] hover:bg-[#F7F9F9] rounded-full transition-colors active:scale-95"
              title="Back to Lists"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-[19px] font-black text-[#0F1419] flex items-center gap-1.5 leading-snug">
                {list?.name || 'List'}
                {list?.is_private && <Lock size={15} className="text-[#536471]" />}
              </h1>
              <p className="text-[12px] text-[#536471]">
                by @{list?.creator_username || 'user'}
              </p>
            </div>
          </div>

          {/* Header Action icons */}
          {list && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePin}
                className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                  list.is_pinned ? 'text-[#7C3AED]' : 'text-gray-400'
                }`}
                title={list.is_pinned ? 'Unpin list' : 'Pin list'}
              >
                <Pin size={18} className={list.is_pinned ? 'fill-[#7C3AED]' : ''} />
              </button>

              {list.is_creator ? (
                <>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] text-[13px] font-bold rounded-full transition-colors"
                  >
                    <UserPlus size={15} />
                    <span>Add Member</span>
                  </button>
                  <button
                    onClick={handleDeleteList}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Delete list"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              ) : (
                <button
                  onClick={toggleFollow}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                    list.is_following
                      ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                      : 'bg-[#0F1419] hover:bg-[#272C30] text-white shadow-sm'
                  }`}
                >
                  {list.is_following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* List Info Card */}
        {loadingList ? (
          <div className="p-4 border-b border-[#EFF3F4] animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
            <div className="h-3 bg-gray-200 rounded w-1/4" />
          </div>
        ) : list ? (
          <div className="p-4 border-b border-[#EFF3F4] bg-[#F7F9F9]/40">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[20px] font-black text-[#0F1419]">{list.name}</h2>
              {list.is_private && (
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#536471] bg-gray-200 px-2 py-0.5 rounded-md">
                  Private
                </span>
              )}
            </div>

            {list.description && (
              <p className="text-[15px] text-[#536471] mb-3 leading-relaxed">
                {list.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-[13px] text-[#536471]">
              <span className="cursor-pointer hover:underline" onClick={() => setActiveTab('members')}>
                <strong className="text-[#0F1419]">{list.members_count || 0}</strong> Members
              </span>
              <span>
                <strong className="text-[#0F1419]">{list.followers_count || 0}</strong> Followers
              </span>
              <span>
                Created by{' '}
                <button
                  onClick={() => navigate(`/profile/${list.creator_username}`)}
                  className="font-bold text-[#7C3AED] hover:underline"
                >
                  @{list.creator_username}
                </button>
              </span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[#536471]">
            List not found or private.
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
            Feed
            {activeTab === 'feed' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#7C3AED] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-[15px] font-bold text-center transition-colors relative hover:bg-[#F7F9F9] ${
              activeTab === 'members' ? 'text-[#0F1419]' : 'text-[#536471]'
            }`}
          >
            Members ({list?.members_count || 0})
            {activeTab === 'members' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#7C3AED] rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Feed Timeline */}
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
                  <Sparkles size={24} />
                </div>
                <h3 className="text-[18px] font-bold text-[#0F1419] mb-1">
                  No posts from list members yet
                </h3>
                <p className="text-[14px] text-[#536471] max-w-sm mx-auto mb-5 leading-relaxed">
                  When members of this list publish posts, their content will show up in this dedicated timeline.
                </p>
                {list?.is_creator && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full transition-colors shadow-sm"
                  >
                    Add Members to List
                  </button>
                )}
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
          <div className="divide-y divide-[#EFF3F4] pb-16">
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
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users size={24} />
                </div>
                <h3 className="text-[18px] font-bold text-[#0F1419] mb-1">No members added yet</h3>
                <p className="text-[14px] text-[#536471] max-w-sm mx-auto mb-5">
                  Curate your list by adding developers, engineers, and creators.
                </p>
                {list?.is_creator && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full shadow-sm"
                  >
                    Add First Member
                  </button>
                )}
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
                      <p className="font-bold text-[15px] text-[#0F1419] truncate">{member.name || member.username}</p>
                      <p className="text-[13px] text-[#536471] truncate">@{member.username}</p>
                      {member.bio && (
                        <p className="text-[13px] text-[#536471] mt-0.5 line-clamp-1">{member.bio}</p>
                      )}
                    </div>
                  </div>

                  {list?.is_creator && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0 ml-2"
                      title="Remove member"
                    >
                      <UserMinus size={18} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[420px] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFF3F4]">
              <h3 className="font-extrabold text-[17px] text-[#0F1419]">Add Member to List</h3>
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

export default ListDetail;
