import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, PlusCircle, Search, ShieldCheck, Flame, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import api from '../api';

const GRADIENT_PRESETS = [
  'from-purple-600 to-indigo-800',
  'from-blue-600 to-cyan-700',
  'from-emerald-600 to-teal-800',
  'from-amber-600 to-orange-700',
  'from-fuchsia-600 to-pink-700'
];

const Communities = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'joined'
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [commName, setCommName] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0]);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communities');
      setCommunities(res.data?.data?.communities || []);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  const toggleJoinCommunity = async (id) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      // Optimistic update
      setCommunities(prev =>
        prev.map(c => {
          if (c.id === id) {
            const nextJoined = !c.is_joined;
            const currentCount = parseInt(c.members_count || 0, 10);
            return {
              ...c,
              is_joined: nextJoined,
              members_count: nextJoined ? currentCount + 1 : Math.max(0, currentCount - 1)
            };
          }
          return c;
        })
      );

      const res = await api.post(`/communities/${id}/join`);
      if (res.data?.data) {
        setCommunities(prev =>
          prev.map(c =>
            c.id === id
              ? {
                  ...c,
                  is_joined: res.data.data.isJoined,
                  members_count: res.data.data.membersCount
                }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle community join:', err);
      fetchCommunities();
    }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!commName.trim() || submitting) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/communities', {
        name: commName.trim(),
        description: commDesc.trim(),
        banner_gradient: selectedGradient
      });

      if (res.data?.data?.community) {
        setCommName('');
        setCommDesc('');
        setShowCreateModal(false);
        await fetchCommunities();
        setActiveTab('joined');
      }
    } catch (err) {
      console.error('Failed to create community:', err);
      alert(err.response?.data?.message || 'Failed to create community');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCommunities = communities
    .filter((c) => (activeTab === 'joined' ? c.is_joined : true))
    .filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4]">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h1 className="text-[20px] font-black text-[#0F1419]">Communities</h1>
              <p className="text-[13px] text-[#536471]">Connect with domain-specific developer groups</p>
            </div>
            <button
              onClick={() => {
                if (!user) navigate('/auth');
                else setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[13px] font-bold rounded-full shadow-sm transition-all active:scale-95"
            >
              <PlusCircle size={16} />
              <span>Create</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 pb-2.5">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-3 text-[#536471]" />
              <input
                type="text"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#EFF3F4] text-[#0F1419] rounded-full text-[14px] outline-none focus:border-[#7C3AED] border border-transparent focus:bg-white transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-[#EFF3F4]">
            {[
              { id: 'explore', label: 'Explore Communities' },
              { id: 'joined', label: 'Joined Communities' },
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
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-[#7C3AED] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Communities List */}
        {loading ? (
          <div className="divide-y divide-[#EFF3F4]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-16 rounded-2xl bg-gray-200 mb-3" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 bg-purple-50 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <Users size={26} />
            </div>
            <h3 className="text-[19px] font-bold text-[#0F1419]">
              {activeTab === 'joined'
                ? 'You haven’t joined any communities yet'
                : searchQuery
                ? 'No communities found matching your search'
                : 'No communities created yet'}
            </h3>
            <p className="text-[14px] text-[#536471] max-w-sm mx-auto mt-1 mb-5">
              {activeTab === 'joined'
                ? 'Join developer communities to engage in focused conversations with domain specialists.'
                : 'Be the pioneer to establish a specialized engineering hub on SOLITX.'}
            </p>
            {activeTab === 'joined' ? (
              <button
                onClick={() => setActiveTab('explore')}
                className="px-6 py-2.5 bg-[#0F1419] hover:bg-[#272C30] text-white font-bold text-[14px] rounded-full transition-colors shadow-sm"
              >
                Browse All Communities
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!user) navigate('/auth');
                  else setShowCreateModal(true);
                }}
                className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] rounded-full shadow-md active:scale-95 transition-all"
              >
                Create a Community
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EFF3F4]">
            {filteredCommunities.map((c) => {
              const membersCount = parseInt(c.members_count || 0, 10);
              return (
                <div 
                  key={c.id} 
                  onClick={() => navigate(`/communities/${c.slug}`)}
                  className="p-4 hover:bg-[#F7F9F9] transition-colors cursor-pointer group"
                >
                  {/* Banner */}
                  <div className={`h-16 rounded-2xl bg-gradient-to-r ${c.banner_gradient || 'from-purple-600 to-indigo-800'} p-3 flex items-end justify-between relative shadow-inner overflow-hidden mb-3`}>
                    <span className="text-[12px] font-bold text-white/95 bg-black/30 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                      c/{c.slug}
                    </span>
                    <span className="text-[12px] font-bold text-white/95 flex items-center gap-1 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      <Flame size={13} className="text-amber-300" />
                      by @{c.creator_username}
                    </span>
                  </div>

                  {/* Content row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-[17px] text-[#0F1419] group-hover:text-[#7C3AED] transition-colors leading-snug">
                          {c.name}
                        </h3>
                        <ShieldCheck size={16} className="text-[#7C3AED]" />
                      </div>
                      <p className="text-[12px] text-[#536471] mt-0.5 font-medium">
                        {membersCount} {membersCount === 1 ? 'member' : 'members'}
                      </p>
                      {c.description && (
                        <p className="text-[14px] text-[#536471] mt-1.5 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleJoinCommunity(c.id);
                      }}
                      className={`px-5 py-2 rounded-full text-[14px] font-bold transition-all flex-shrink-0 ${
                        c.is_joined
                          ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                          : 'bg-[#0F1419] hover:bg-[#272C30] text-white shadow-sm'
                      }`}
                    >
                      {c.is_joined ? 'Joined' : 'Join'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-[420px] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFF3F4]">
              <h3 className="font-extrabold text-[18px] text-[#0F1419]">Create a Community</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#536471] hover:text-[#0F1419]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[#536471] mb-1">Community Name</label>
                <input
                  type="text"
                  placeholder="e.g. Next.js Performance"
                  value={commName}
                  onChange={(e) => setCommName(e.target.value)}
                  maxLength={50}
                  className="w-full px-3.5 py-2.5 border border-[#CFD9DE] rounded-xl text-[15px] outline-none focus:border-[#7C3AED]"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#536471] mb-1">Topic & Rules</label>
                <textarea
                  rows={3}
                  placeholder="Describe your community topic, goals, and culture..."
                  value={commDesc}
                  onChange={(e) => setCommDesc(e.target.value)}
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 border border-[#CFD9DE] rounded-xl text-[15px] outline-none focus:border-[#7C3AED] resize-none"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#536471] mb-1.5">Banner Theme</label>
                <div className="flex gap-2">
                  {GRADIENT_PRESETS.map((grad) => (
                    <button
                      key={grad}
                      type="button"
                      onClick={() => setSelectedGradient(grad)}
                      className={`h-8 flex-1 rounded-xl bg-gradient-to-r ${grad} border-2 transition-all ${
                        selectedGradient === grad ? 'border-[#0F1419] scale-105 shadow-sm' : 'border-transparent opacity-70'
                      }`}
                    />
                  ))}
                </div>
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
                  disabled={!commName.trim() || submitting}
                  className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white font-bold text-[14px] rounded-full transition-colors shadow-sm"
                >
                  {submitting ? 'Creating...' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Communities;
