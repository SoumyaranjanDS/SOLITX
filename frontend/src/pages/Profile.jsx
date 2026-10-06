import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link as LinkIcon, Calendar, MessageCircle, Repeat2, Heart, Share, MoreHorizontal, BarChart2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import api from '../api';

const TABS = ['Posts', 'Replies', 'Media', 'Likes'];

const Profile = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const [activeTab, setActiveTab] = useState('Posts');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwnProfile = currentUser?.username === username;

  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/users/${username}`);
        const apiUser = response.data.data.user;
        setUser({
          name: apiUser.username,
          username: apiUser.username,
          bio: apiUser.bio || 'Building things on the internet. Engineering & design.',
          website: 'solitx.dev',
          joinDate: new Date(apiUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          following: apiUser.following_count || 0,
          followers: apiUser.followers_count || 0,
        });
      } catch {
        setUser({
          name: username, username,
          bio: 'Building things on the internet.',
          website: '', joinDate: 'October 2024',
          following: 0, followers: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    if (username) fetchProfile();
  }, [username]);

  if (loading) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    </AppShell>
  );

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
            <p className="text-[13px] text-[#536471]">{posts.length} posts</p>
          </div>
        </div>

        {/* Cover Photo */}
        <div className="h-[130px] sm:h-[200px] bg-[#CFD9DE] w-full" />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex justify-between items-end">
            {/* Avatar */}
            <div className="-mt-12 sm:-mt-16 w-[72px] h-[72px] sm:w-[134px] sm:h-[134px] rounded-full border-4 border-white bg-gray-200 overflow-hidden flex-shrink-0">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Action */}
            <div className="pb-1">
              {isOwnProfile ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('token');
                      localStorage.removeItem('user');
                      navigate('/auth');
                    }}
                    className="px-4 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 font-bold text-[14px] rounded-full transition-colors whitespace-nowrap"
                  >
                    Logout
                  </button>
                  <button className="px-4 py-1.5 border border-[#CFD9DE] hover:bg-[#F7F9F9] text-[#0F1419] font-bold text-[14px] rounded-full transition-colors whitespace-nowrap">
                    Edit profile
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsFollowing(f => !f)}
                  className={`px-4 py-1.5 font-bold text-[14px] rounded-full transition-colors whitespace-nowrap ${
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
            <button className="hover:underline">
              <span className="font-bold text-[#0F1419]">{user?.following}</span>{' '}
              <span className="text-[#536471]">Following</span>
            </button>
            <button className="hover:underline">
              <span className="font-bold text-[#0F1419]">{user?.followers}</span>{' '}
              <span className="text-[#536471]">Followers</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#EFF3F4] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[80px] px-4 py-4 text-[15px] transition-colors relative whitespace-nowrap
                ${activeTab === tab ? 'font-bold text-[#0F1419]' : 'text-[#536471] hover:bg-[#F7F9F9]'}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-3 right-3 h-1 bg-[#7C3AED] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="pb-[80px] md:pb-4">
          {posts.map(post => (
            <article key={post.id} className="flex gap-3 px-4 py-3 border-b border-[#EFF3F4] hover:bg-[#F7F9F9] active:bg-[#F7F9F9] cursor-pointer transition-colors group">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                <img src={post.avatar} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[14px] sm:text-[15px] min-w-0 flex-1 flex-wrap">
                    <span className="font-bold text-[#0F1419] truncate">{post.name}</span>
                    <span className="text-[#536471] truncate hidden sm:inline">@{post.username} · {post.date}</span>
                    <span className="text-[#536471] truncate sm:hidden">· {post.date}</span>
                  </div>
                  <button className="p-1.5 -mr-1 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 active:text-[#7C3AED] text-[#536471] md:opacity-0 md:group-hover:opacity-100 transition-all flex-shrink-0">
                    <MoreHorizontal size={17} />
                  </button>
                </div>
                <p className="text-[14px] sm:text-[15px] text-[#0F1419] mt-0.5 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
                <div className="flex justify-between items-center mt-3 text-[#536471] max-w-[300px] sm:max-w-[360px] -ml-2">
                  <button className="flex items-center gap-1 sm:gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:text-[#7C3AED] transition-colors">
                    <MessageCircle size={17} strokeWidth={1.8} /><span className="text-[13px]">{post.replies}</span>
                  </button>
                  <button className="flex items-center gap-1.5 p-2 rounded-full hover:bg-green-50 hover:text-green-600 active:text-green-600 transition-colors">
                    <Repeat2 size={17} strokeWidth={1.8} /><span className="text-[13px]">{post.retweets}</span>
                  </button>
                  <button className="flex items-center gap-1.5 p-2 rounded-full hover:bg-pink-50 hover:text-pink-600 active:text-pink-600 transition-colors">
                    <Heart size={17} strokeWidth={1.8} /><span className="text-[13px]">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:text-[#7C3AED] transition-colors">
                    <BarChart2 size={17} strokeWidth={1.8} /><span className="text-[13px]">{post.views}</span>
                  </button>
                  <button className="flex items-center gap-1.5 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:text-[#7C3AED] transition-colors">
                    <Share size={17} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
