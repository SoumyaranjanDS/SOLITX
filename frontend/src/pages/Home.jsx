import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Heart, Repeat2, MessageCircle, Share, ImageIcon, BarChart2, Smile, Calendar, MapPin } from 'lucide-react';
import AppShell from '../components/AppShell';

// ─── Post Card ────────────────────────────────────────────────────────────────
const PostCard = ({ post, onNavigate }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [reposted, setReposted] = useState(false);

  return (
    <article
      className="flex gap-3 px-4 py-3 border-b border-[#EFF3F4] hover:bg-[#F7F9F9] cursor-pointer transition-colors group"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onNavigate(`/profile/${post.username}`); }}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 overflow-hidden hover:opacity-90 transition-opacity"
      >
        <img src={post.avatar} alt={post.name} className="w-full h-full object-cover" />
      </button>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap text-[14px] sm:text-[15px] min-w-0 flex-1">
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(`/profile/${post.username}`); }}
              className="font-bold text-[#0F1419] hover:underline truncate"
            >
              {post.name}
            </button>
            {post.verified && (
              <svg className="w-4 h-4 text-[#7C3AED] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1-2.52-1.27-3.91-.81C14.67 2.88 13.43 2 12 2c-1.43 0-2.67.88-3.34 2.19-1.39-.46-2.9-.2-3.91.81-1 1.01-1.27 2.52-.81 3.91C2.88 9.33 2 10.57 2 12c0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91 1.01 1 2.52 1.27 3.91.81C9.33 21.12 10.57 22 12 22c1.43 0 2.67-.88 3.34-2.19 1.39.46 2.9.2 3.91-.81 1-1.01 1.27-2.52.81-3.91C21.12 14.67 22 13.43 22 12zm-6.16-1.42l-3.8 3.79-1.43 1.43-3.07-3.07 1.42-1.42 1.65 1.64 3.8-3.79 1.43 1.42z"/>
              </svg>
            )}
            <span className="text-[#536471] truncate hidden sm:inline">@{post.username} · {post.date}</span>
            <span className="text-[#536471] truncate sm:hidden">· {post.date}</span>
          </div>
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 -mr-1 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 active:text-[#7C3AED] text-[#536471] md:opacity-0 md:group-hover:opacity-100 transition-all flex-shrink-0"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>

        {/* Content */}
        <p className="text-[14px] sm:text-[15px] text-[#0F1419] mt-0.5 leading-[1.5] whitespace-pre-wrap break-words">{post.content}</p>

        {/* Image if any */}
        {post.image && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-[#EFF3F4]">
            <img src={post.image} alt="Post media" className="w-full object-cover max-h-[400px]" />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-3 text-[#536471] max-w-[300px] sm:max-w-[420px] -ml-2">
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 sm:gap-2 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 active:text-[#7C3AED] transition-colors"
          >
            <MessageCircle size={17} strokeWidth={1.8} />
            <span className="text-[12px] sm:text-[13px]">{post.replies}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setReposted(r => !r); }}
            className={`flex items-center gap-1 sm:gap-2 p-2 rounded-full hover:bg-green-50 hover:text-green-600 active:bg-green-50 active:text-green-600 transition-colors ${reposted ? 'text-green-600' : ''}`}
          >
            <Repeat2 size={17} strokeWidth={1.8} />
            <span className="text-[12px] sm:text-[13px]">{post.retweets + (reposted ? 1 : 0)}</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }}
            className={`flex items-center gap-1 sm:gap-2 p-2 rounded-full hover:bg-pink-50 hover:text-pink-600 active:bg-pink-50 active:text-pink-600 transition-colors ${liked ? 'text-pink-600' : ''}`}
          >
            <Heart size={17} strokeWidth={1.8} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-[12px] sm:text-[13px]">{likeCount}</span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:flex items-center gap-2 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 active:text-[#7C3AED] transition-colors"
          >
            <BarChart2 size={17} strokeWidth={1.8} />
            {post.views && <span className="text-[13px]">{post.views}</span>}
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 sm:gap-2 p-2 rounded-full hover:bg-[#7C3AED]/10 hover:text-[#7C3AED] active:bg-[#7C3AED]/10 active:text-[#7C3AED] transition-colors"
          >
            <Share size={17} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </article>
  );
};

// ─── Home ─────────────────────────────────────────────────────────────────────
const Home = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('For you');
  const [user, setUser] = useState(null);
  const [postText, setPostText] = useState('');

  const topicTabs = ['For you', 'Following', 'SaaS Growth', 'AI Startups', 'Web 3', 'Product Design'];

  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    else navigate('/auth');
  }, [navigate]);

  if (!user) return null;

  return (
    <AppShell rightSidebar>
      {/* Sticky Top */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-[#EFF3F4]">
        {/* Mobile logo row */}
        <div className="md:hidden flex items-center justify-between px-4 h-[53px]">
          <button
            onClick={() => navigate(`/profile/${user.username}`)}
            className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden"
          >
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="me" className="w-full h-full object-cover" />
          </button>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <path d="M10 22 L16 10 L22 22" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="10" r="2.5" fill="#7C3AED"/>
            <path d="M10 22 H22" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div className="w-8" />
        </div>

        {/* Desktop home title */}
        <div className="hidden md:flex items-center px-4 h-[53px]">
          <h1 className="font-bold text-[19px] text-[#0F1419]">Home</h1>
        </div>

        {/* Topic Tabs — scrollable */}
        <div className="flex overflow-x-auto border-t border-[#EFF3F4]" style={{ scrollbarWidth: 'none' }}>
          {topicTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-4 text-[15px] transition-colors relative whitespace-nowrap
                ${activeTab === tab ? 'font-bold text-[#0F1419]' : 'text-[#536471] hover:bg-[#F7F9F9]'}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-3 right-3 h-1 bg-[#7C3AED] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Compose Box — hidden on mobile, use FAB instead */}
      <div className="hidden md:flex gap-3 px-4 py-3 border-b border-[#EFF3F4]">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="me" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <textarea
            placeholder="What is happening?!"
            className="w-full text-[17px] text-[#0F1419] placeholder:text-[#536471] border-none focus:ring-0 resize-none outline-none leading-snug pt-2 min-h-[52px]"
            value={postText}
            onChange={e => setPostText(e.target.value)}
            rows={postText.length > 60 ? 3 : 1}
          />
          <div className="flex items-center justify-between pt-2 border-t border-[#EFF3F4] mt-1">
            <div className="flex items-center gap-0.5 text-[#7C3AED]">
              <button className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><ImageIcon size={17} /></button>
              <button className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><BarChart2 size={17} /></button>
              <button className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><Smile size={17} /></button>
              <button className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><Calendar size={17} /></button>
              <button className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"><MapPin size={17} /></button>
            </div>
            <button
              disabled={postText.trim().length === 0}
              className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-full transition-colors"
            >
              Post
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="pb-[72px] md:pb-0">
        {posts.map(post => (
          <PostCard key={post.id} post={post} onNavigate={navigate} />
        ))}
      </div>
    </AppShell>
  );
};

export default Home;
