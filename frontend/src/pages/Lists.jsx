import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { List as ListIcon, PlusCircle, Users, Lock, Pin, Trash2, X, RefreshCw, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import api from '../api';
import { redirectToAuth } from '../utils/authRedirect';

const Lists = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('discover'); // 'discover' | 'your' | 'pinned'
  const [searchQuery, setSearchQuery] = useState('');
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Create List Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lists');
      setLists(res.data?.data?.lists || []);
    } catch (err) {
      console.error('Failed to load lists:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const toggleFollowList = async (id) => {
    if (!user) {
      redirectToAuth(navigate, '/lists');
      return;
    }

    try {
      // Optimistic update
      setLists(prev =>
        prev.map(l => {
          if (l.id === id) {
            const nextFollowing = !l.is_following;
            const currentFollowers = parseInt(l.followers_count || 0, 10);
            return {
              ...l,
              is_following: nextFollowing,
              followers_count: nextFollowing ? currentFollowers + 1 : Math.max(0, currentFollowers - 1)
            };
          }
          return l;
        })
      );

      const res = await api.post(`/lists/${id}/follow`);
      if (res.data?.data) {
        setLists(prev =>
          prev.map(l =>
            l.id === id
              ? {
                  ...l,
                  is_following: res.data.data.isFollowing,
                  followers_count: res.data.data.followersCount
                }
              : l
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle follow list:', err);
      fetchLists();
    }
  };

  const togglePinList = async (id) => {
    if (!user) {
      redirectToAuth(navigate, '/lists');
      return;
    }

    try {
      // Optimistic update
      setLists(prev =>
        prev.map(l => (l.id === id ? { ...l, is_pinned: !l.is_pinned } : l))
      );

      const res = await api.post(`/lists/${id}/pin`);
      if (res.data?.data) {
        setLists(prev =>
          prev.map(l =>
            l.id === id ? { ...l, is_pinned: res.data.data.isPinned } : l
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle pin list:', err);
      fetchLists();
    }
  };

  const handleDeleteList = async (id) => {
    if (!window.confirm('Are you sure you want to delete this list?')) return;
    try {
      await api.delete(`/lists/${id}`);
      setLists(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim() || submitting) return;
    if (!user) {
      redirectToAuth(navigate, '/lists');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/lists', {
        name: newListName.trim(),
        description: newListDesc.trim(),
        is_private: isPrivate
      });

      if (res.data?.data?.list) {
        setNewListName('');
        setNewListDesc('');
        setIsPrivate(false);
        setShowCreateModal(false);
        await fetchLists();
        setActiveTab('your');
      }
    } catch (err) {
      console.error('Failed to create list:', err);
      alert(err.response?.data?.message || 'Failed to create list');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedLists = lists
    .filter((l) => {
      if (activeTab === 'pinned') return l.is_pinned;
      if (activeTab === 'your') return l.is_creator || l.is_following;
      return true; // 'discover'
    })
    .filter((l) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim().replace(/^@/, '');
      return (
        l.name?.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.creator_username && l.creator_username.toLowerCase().includes(q))
      );
    });

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-[20px] font-black text-[#0F1419]">Lists</h1>
              <p className="text-[13px] text-[#536471]">Curated developer feeds & timelines</p>
            </div>
            <button
              onClick={() => {
                if (!user) redirectToAuth(navigate, '/lists');
                else setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-bold rounded-full shadow-sm transition-all active:scale-95"
            >
              <PlusCircle size={16} />
              <span>Create List</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 pb-2.5">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3.5 top-3 text-[#536471] pointer-events-none" />
              <input
                type="text"
                placeholder="Search lists by name, description, or @creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-[#EFF3F4] text-[#0F1419] rounded-full text-[14px] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 border border-transparent focus:bg-white transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 rounded-full text-[#536471] hover:text-[#0F1419] hover:bg-[#CFD9DE]/50 transition-colors"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-[#EFF3F4]">
            {[
              { id: 'discover', label: 'Discover' },
              { id: 'your', label: 'Your Lists' },
              { id: 'pinned', label: 'Pinned' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-[15px] font-bold text-center transition-colors relative hover:bg-[#F7F9F9] ${
                  activeTab === tab.id ? 'text-[#0F1419]' : 'text-[#536471]'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#7C3AED] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Lists Content */}
        {loading ? (
          <div className="divide-y divide-[#EFF3F4]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex items-start gap-3.5 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedLists.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <ListIcon size={26} />
            </div>
            <h3 className="text-[19px] font-bold text-[#0F1419]">
              {searchQuery
                ? 'No lists found matching your search'
                : activeTab === 'pinned'
                ? 'No pinned lists yet'
                : activeTab === 'your'
                ? 'You haven’t created or followed any lists yet'
                : 'No lists created yet'}
            </h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1 mb-5">
              {searchQuery
                ? 'Try searching with a different keyword, list name, or @creator.'
                : activeTab === 'pinned'
                ? 'Pin your favorite developer lists to make them readily accessible.'
                : activeTab === 'your'
                ? 'Create custom lists to group the developers and topics you care about most.'
                : 'Be the first developer to create a curated list on SOLITX.'}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-6 py-2.5 bg-[#0F1419] hover:bg-[#272C30] text-white font-bold text-[14px] rounded-full shadow-md active:scale-95 transition-all"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!user) redirectToAuth(navigate, '/lists');
                  else setShowCreateModal(true);
                }}
                className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full shadow-md active:scale-95 transition-all"
              >
                Create a List
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EFF3F4]">
            {displayedLists.map((list) => {
              const followersCount = parseInt(list.followers_count || 0, 10);
              const membersCount = parseInt(list.members_count || 0, 10);
              return (
                <div
                  key={list.id}
                  onClick={() => navigate(`/lists/${list.id}`)}
                  className="p-4 hover:bg-[#F7F9F9] transition-colors flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-purple-400 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                    <ListIcon size={22} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-[16px] text-[#0F1419] group-hover:text-[#7C3AED] transition-colors">
                            {list.name}
                          </h3>
                          {list.is_private && <Lock size={14} className="text-[#536471]" />}
                        </div>
                        <p className="text-[12px] text-[#536471] mt-0.5">
                          {followersCount} {followersCount === 1 ? 'follower' : 'followers'} · by @{list.creator_username}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {list.is_creator && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteList(list.id);
                            }}
                            className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete list"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinList(list.id);
                          }}
                          className={`p-2 rounded-full hover:bg-gray-200 transition-colors ${
                            list.is_pinned ? 'text-[#7C3AED]' : 'text-gray-400'
                          }`}
                          title={list.is_pinned ? 'Unpin list' : 'Pin list'}
                        >
                          <Pin size={17} className={list.is_pinned ? 'fill-[#7C3AED]' : ''} />
                        </button>

                        {!list.is_creator && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFollowList(list.id);
                            }}
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
                    </div>

                    {list.description && (
                      <p className="text-[14px] text-[#536471] mt-1.5 leading-relaxed">
                        {list.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[420px] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFF3F4]">
              <h3 className="font-extrabold text-[18px] text-[#0F1419]">Create a new List</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#536471] hover:text-[#0F1419]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateList} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#536471] mb-1">List Name</label>
                <input
                  type="text"
                  placeholder="e.g. AI Engineers to Watch"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 border border-[#CFD9DE] rounded-xl text-[15px] outline-none focus:border-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#536471] mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="What is this list about?"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 border border-[#CFD9DE] rounded-xl text-[15px] outline-none focus:border-[#7C3AED] resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#F7F9F9] rounded-xl">
                <div>
                  <p className="font-bold text-[14px] text-[#0F1419]">Make Private</p>
                  <p className="text-[12px] text-[#536471]">When private, only you can see this list</p>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-5 h-5 accent-[#7C3AED] cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-bold text-[14px] text-[#536471] hover:bg-gray-100 rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim() || submitting}
                  className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white font-bold text-[14px] rounded-full transition-colors shadow-sm"
                >
                  {submitting ? 'Creating...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Lists;
