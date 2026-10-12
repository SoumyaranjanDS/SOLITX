import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Link as LinkIcon, 
  Calendar, 
  Edit3, 
  Sparkles, 
  X 
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard from '../components/PostCard';
import api from '../api';

const TABS = ['Posts', 'Replies', 'Media', 'Likes'];

const Profile = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const [activeTab, setActiveTab] = useState('Posts');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [posts, setPosts] = useState([]);

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwnProfile = currentUser?.username === username;

  // Fetch Profile Info
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${username}`);
      const apiUser = response.data?.data?.user;
      if (apiUser) {
        setUser({
          name: apiUser.username,
          username: apiUser.username,
          bio: apiUser.bio || 'Building things on the internet. Engineering & system design.',
          website: 'solitx.dev',
          joinDate: new Date(apiUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          following: parseInt(apiUser.following_count, 10) || 0,
          followers: parseInt(apiUser.followers_count, 10) || 0,
        });
        setIsFollowing(Boolean(apiUser.is_following));
        setEditBio(apiUser.bio || '');
      }
    } catch {
      setUser({
        name: username,
        username,
        bio: 'Building things on the internet.',
        website: '',
        joinDate: 'October 2024',
        following: 0,
        followers: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch User Posts
  const fetchUserPosts = async () => {
    try {
      setPostsLoading(true);
      const res = await api.get(`/posts/user/${username}`);
      if (res.data?.data) {
        setPosts(res.data.data.posts || []);
      }
    } catch (err) {
      console.error('Failed to fetch user posts:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (username) {
      fetchProfile();
      fetchUserPosts();
    }
  }, [username]);

  // Toggle Follow
  const handleToggleFollow = async () => {
    try {
      const prevFollowing = isFollowing;
      setIsFollowing(!prevFollowing);
      setUser(prev => ({
        ...prev,
        followers: prevFollowing ? Math.max(0, prev.followers - 1) : prev.followers + 1
      }));

      const res = await api.post(`/users/${username}/follow`);
      if (res.data?.data) {
        setIsFollowing(res.data.data.isFollowing);
        setUser(prev => ({ ...prev, followers: res.data.data.followers_count }));
      }
    } catch (err) {
      // Rollback
      setIsFollowing(!isFollowing);
    }
  };

  // Save Bio
  const handleSaveBio = async () => {
    try {
      setIsSavingBio(true);
      const res = await api.put(`/users/${username}`, { bio: editBio.trim() });
      if (res.data?.data?.user) {
        setUser(prev => ({ ...prev, bio: res.data.data.user.bio }));
        // Update local storage user too
        if (isOwnProfile) {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...stored, bio: res.data.data.user.bio }));
        }
      }
      setShowEditModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update bio');
    } finally {
      setIsSavingBio(false);
    }
  };

  const handlePostDeleted = (id) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-[#EFF3F4] px-4 h-[53px] flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-[#EFF3F4] text-[#0F1419] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-[19px] text-[#0F1419] leading-tight">{user?.name}</h1>
            <p className="text-[13px] text-[#536471]">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
          </div>
        </div>

        {/* Cover Photo */}
        <div className="h-[130px] sm:h-[200px] bg-[#CFD9DE] w-full" />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex justify-between items-start">
            {/* Avatar */}
            <div className="-mt-12 sm:-mt-16 w-[72px] h-[72px] sm:w-[134px] sm:h-[134px] rounded-full border-4 border-white bg-gray-200 overflow-hidden flex-shrink-0 relative z-10">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Action */}
            <div className="mt-3">
              {isOwnProfile ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowEditModal(true)}
                    className="px-4 py-1.5 border border-[#CFD9DE] hover:bg-[#F7F9F9] text-[#0F1419] font-bold text-[14px] rounded-full transition-colors whitespace-nowrap active:scale-95"
                  >
                    Edit profile
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleToggleFollow}
                  className={`px-5 py-1.5 font-bold text-[14px] rounded-full transition-colors whitespace-nowrap active:scale-95 ${
                    isFollowing
                      ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                      : 'bg-[#0F1419] hover:bg-[#272c30] text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          {/* Name / Handle */}
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-[19px] text-[#0F1419]">{user?.name}</h2>
              <svg className="w-5 h-5 text-[#7C3AED]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1-2.52-1.27-3.91-.81C14.67 2.88 13.43 2 12 2c-1.43 0-2.67.88-3.34 2.19-1.39-.46-2.9-.2-3.91.81-1 1.01-1.27 2.52-.81 3.91C2.88 9.33 2 10.57 2 12c0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91 1.01 1 2.52 1.27 3.91.81C9.33 21.12 10.57 22 12 22c1.43 0 2.67-.88 3.34-2.19 1.39.46 2.9.2 3.91-.81 1-1.01 1.27-2.52.81-3.91C21.12 14.67 22 13.43 22 12zm-6.16-1.42l-3.8 3.79-1.43 1.43-3.07-3.07 1.42-1.42 1.65 1.64 3.8-3.79 1.43 1.42z"/>
              </svg>
            </div>
            <p className="text-[15px] text-[#536471]">@{user?.username}</p>
          </div>

          {/* Bio */}
          <p className="mt-3 text-[15px] text-[#0F1419] leading-relaxed">{user?.bio}</p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[15px] text-[#536471]">
            {user?.website && (
              <div className="flex items-center gap-1">
                <LinkIcon size={16} />
                <a href={`https://${user.website}`} className="text-[#7C3AED] hover:underline">{user.website}</a>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Joined {user?.joinDate}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-5 mt-3 text-[15px]">
            <div className="hover:underline cursor-pointer">
              <span className="font-bold text-[#0F1419]">{user?.following}</span>{' '}
              <span className="text-[#536471]">Following</span>
            </div>
            <div className="hover:underline cursor-pointer">
              <span className="font-bold text-[#0F1419]">{user?.followers}</span>{' '}
              <span className="text-[#536471]">Followers</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#EFF3F4] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[80px] px-4 py-3.5 text-[15px] transition-colors relative whitespace-nowrap
                ${activeTab === tab ? 'font-bold text-[#0F1419]' : 'text-[#536471] hover:bg-[#F7F9F9]'}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-3 right-3 h-1 bg-[#7C3AED] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* User Posts Timeline */}
        <div className="pb-[80px] md:pb-12">
          {postsLoading ? (
            <div className="divide-y divide-[#EFF3F4]">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-3 px-4 py-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab !== 'Posts' ? (
            <div className="p-8 text-center text-[#536471]">
              <p className="text-[15px]">No {activeTab.toLowerCase()} yet.</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-[#536471] flex items-center justify-center mb-3">
                <Sparkles size={22} />
              </div>
              <h3 className="font-bold text-[18px] text-[#0F1419] mb-1">@{user?.username} hasn't posted yet</h3>
              <p className="text-[14px] text-[#536471] max-w-xs">
                When they post updates, they will appear here.
              </p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onNavigate={navigate}
                onPostDeleted={handlePostDeleted}
                onPostUpdated={handlePostUpdated}
              />
            ))
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-[480px] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EFF3F4]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 -ml-1 text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="font-bold text-[18px] text-[#0F1419]">Edit profile</h3>
              </div>
              <button
                onClick={handleSaveBio}
                disabled={isSavingBio}
                className="px-5 py-1.5 bg-[#0F1419] hover:bg-[#272c30] disabled:opacity-50 text-white font-bold text-[14px] rounded-full transition-colors"
              >
                {isSavingBio ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="pt-4">
              <label className="block text-[13px] font-bold text-[#536471] mb-1.5">Bio</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="Describe who you are, what you build, and what technologies you love..."
                className="w-full p-3 border border-[#CFD9DE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] rounded-xl text-[15px] outline-none resize-none leading-relaxed text-[#0F1419]"
              />
              <div className="flex justify-end text-[12px] text-[#536471] mt-1">
                {editBio.length}/200
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Profile;
