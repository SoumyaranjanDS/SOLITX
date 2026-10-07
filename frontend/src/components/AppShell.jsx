import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Bell, Mail, Bookmark, User, Feather, List, Users, MoreHorizontal, Star, LogOut } from 'lucide-react';

// ─── SOLITX Logo ──────────────────────────────────────────────────────────────
export const SolitxLogo = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M10 22 L16 10 L22 22" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="16" cy="10" r="2.5" fill="#7C3AED"/>
    <path d="M10 22 H22" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

// ─── Nav Item ─────────────────────────────────────────────────────────────────
const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-2.5 py-2 rounded-full w-fit xl:w-full transition-all duration-150
      ${active ? 'font-bold text-[#0F1419]' : 'text-[#536471] hover:bg-[#F7F9F9] hover:text-[#0F1419]'}`}
  >
    <div className="relative flex-shrink-0">
      <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#7C3AED] rounded-full" />
      )}
    </div>
    <span className={`hidden xl:block text-[16px] ${active ? 'font-bold' : 'font-normal'}`}>{label}</span>
  </button>
);

// ─── App Shell ────────────────────────────────────────────────────────────────
const AppShell = ({ children, rightSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const navItems = [
    { icon: Home,     label: 'Home',          path: '/' },
    { icon: Search,   label: 'Explore',       path: '/explore' },
    { icon: Bell,     label: 'Notifications', path: '/notifications', badge: true },
    { icon: Mail,     label: 'Messages',      path: '/messages' },
    { icon: Star,     label: 'Premium',       path: '/premium' },
    { icon: List,     label: 'Lists',         path: '/lists' },
    { icon: Bookmark, label: 'Bookmarks',     path: '/bookmarks' },
    { icon: Users,    label: 'Communities',   path: '/communities' },
    { icon: User,     label: 'Profile',       path: `/profile/${user.username}` },
    { icon: MoreHorizontal, label: 'More',    path: '/more' },
  ];

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  React.useEffect(() => {
    const handleOpen = () => setIsDrawerOpen(true);
    window.addEventListener('open-drawer', handleOpen);
    return () => window.removeEventListener('open-drawer', handleOpen);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-white flex justify-center">

      {/* Left Sidebar */}
      <aside className="hidden md:flex flex-col w-[60px] xl:w-[240px] h-screen sticky top-0 pt-1 px-1.5 xl:px-3 overflow-y-auto flex-shrink-0">

        {/* Logo */}
        <div
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F7F9F9] cursor-pointer transition-colors mb-0.5"
          onClick={() => navigate('/')}
        >
          <SolitxLogo size={24} />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map(item => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))}
              onClick={() => navigate(item.path)}
              badge={item.badge}
            />
          ))}
        </nav>

        {/* Post Button */}
        <div className="mt-3 mb-3 xl:pr-2">
          <button className="w-9 h-9 xl:w-full xl:h-auto xl:py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full transition-all flex items-center justify-center gap-2 shadow-sm">
            <Feather size={17} fill="white" className="xl:hidden" />
            <span className="hidden xl:block">Post</span>
          </button>
        </div>

        {/* Logout Button (Desktop) */}
        <div className="mb-2 mt-auto xl:pr-2">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-3 px-2.5 py-2 rounded-full w-fit xl:w-full transition-all duration-150 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <div className="relative flex-shrink-0">
              <LogOut size={20} strokeWidth={2} />
            </div>
            <span className="hidden xl:block text-[16px] font-bold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main + Right */}
      <div className="flex flex-1 max-w-[990px] min-w-0">

        {/* Center */}
        <main className="flex-1 min-w-0 min-h-screen border-x border-[#EFF3F4] pb-20 md:pb-0">
          {children}
        </main>

        {/* Right Sidebar */}
        {rightSidebar && (
          <aside className="hidden lg:block w-[360px] pl-8 pt-3 flex-shrink-0">
            <div className="sticky top-3 flex flex-col gap-4">

              {/* Search */}
              <div className="flex items-center gap-3 bg-[#EFF3F4] hover:bg-[#E7ECF0] border border-transparent focus-within:bg-white focus-within:border-[#7C3AED] rounded-full px-4 py-2.5 transition-all">
                <Search size={18} className="text-[#536471] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search"
                  className="bg-transparent border-none focus:outline-none w-full text-[#0F1419] placeholder:text-[#536471] text-[15px]"
                />
              </div>

              {/* Who to follow */}
              <div className="bg-[#F7F9F9] rounded-2xl overflow-hidden">
                <h2 className="font-extrabold text-[19px] text-[#0F1419] px-4 pt-4 pb-3">Who to follow</h2>
                {[].map(person => (
                  <div key={person.handle} className="flex items-center justify-between px-4 py-3 hover:bg-[#E7ECF0] cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person.handle}`} alt={person.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="font-bold text-[15px] text-[#0F1419]">{person.name}</p>
                          {person.verified && (
                            <svg className="w-4 h-4 text-[#7C3AED]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1-2.52-1.27-3.91-.81C14.67 2.88 13.43 2 12 2c-1.43 0-2.67.88-3.34 2.19-1.39-.46-2.9-.2-3.91.81-1 1.01-1.27 2.52-.81 3.91C2.88 9.33 2 10.57 2 12c0 1.43.88 2.67 2.19 3.34-.46 1.39-.2 2.9.81 3.91 1.01 1 2.52 1.27 3.91.81C9.33 21.12 10.57 22 12 22c1.43 0 2.67-.88 3.34-2.19 1.39.46 2.9.2 3.91-.81 1-1.01 1.27-2.52.81-3.91C21.12 14.67 22 13.43 22 12zm-6.16-1.42l-3.8 3.79-1.43 1.43-3.07-3.07 1.42-1.42 1.65 1.64 3.8-3.79 1.43 1.42z"/>
                            </svg>
                          )}
                        </div>
                        <p className="text-[14px] text-[#536471]">@{person.handle}</p>
                      </div>
                    </div>
                    <button className="px-4 py-1.5 bg-[#0F1419] hover:bg-[#272c30] text-white font-bold text-[14px] rounded-full transition-colors">
                      Follow
                    </button>
                  </div>
                ))}
                <button className="w-full px-4 py-4 text-[#7C3AED] hover:bg-[#E7ECF0] transition-colors text-[15px] text-left rounded-b-2xl">
                  Show more
                </button>
              </div>

              {/* Trends */}
              <div className="bg-[#F7F9F9] rounded-2xl overflow-hidden">
                <h2 className="font-extrabold text-[19px] text-[#0F1419] px-4 pt-4 pb-3">Trending</h2>
                {[
                  { n: 1, cat: 'Technology', tag: '#PostgreSQL17', posts: '45.2K' },
                  { n: 2, cat: 'Engineering', tag: '#SystemDesign', posts: '235K' },
                  { n: 3, cat: 'Backend Dev', tag: '#Redis', posts: '68K' },
                  { n: 4, cat: 'Trending', tag: '#OpenSource', posts: '45.2K' },
                ].map(item => (
                  <div key={item.tag} className="px-4 py-3 hover:bg-[#E7ECF0] cursor-pointer transition-colors flex items-start justify-between group">
                    <div>
                      <p className="text-[13px] text-[#536471]">{item.n} · {item.cat} · Trending</p>
                      <p className="font-bold text-[15px] text-[#0F1419] mt-0.5">{item.tag}</p>
                      <p className="text-[13px] text-[#536471] mt-0.5">{item.posts} posts</p>
                    </div>
                    <button className="p-1.5 rounded-full hover:bg-[#7C3AED]/10 text-[#536471] hover:text-[#7C3AED] opacity-0 group-hover:opacity-100 transition-all">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                ))}
                <button className="w-full px-4 py-4 text-[#7C3AED] hover:bg-[#E7ECF0] transition-colors text-[15px] text-left rounded-b-2xl">
                  Show more
                </button>
              </div>

            </div>
          </aside>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[53px] bg-white/95 backdrop-blur-xl border-t border-[#EFF3F4] flex justify-around items-center z-30">
        {navItems.slice(0, 4).map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`p-3 relative transition-colors ${location.pathname === item.path ? 'text-[#0F1419]' : 'text-[#536471]'}`}
          >
            <item.icon size={24} strokeWidth={location.pathname === item.path ? 2.5 : 1.8} />
            {item.badge && <span className="absolute top-2 right-2 w-2 h-2 bg-[#7C3AED] rounded-full" />}
          </button>
        ))}
      </div>

      {/* Mobile FAB */}
      <button className="md:hidden fixed bottom-[64px] right-4 w-14 h-14 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full flex items-center justify-center shadow-[0_2px_16px_rgba(124,58,237,0.4)] z-20 transition-all active:scale-95">
        <Feather size={22} fill="white" />
      </button>

      {/* Mobile Sidebar Drawer */}
      {isDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className="relative w-[280px] max-w-[80%] bg-white h-full shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-left duration-300">
            {/* Drawer Header: Profile Info */}
            <div className="p-4 border-b border-[#EFF3F4]">
              <div className="flex justify-between items-start mb-2">
                <div 
                  onClick={() => { setIsDrawerOpen(false); navigate(`/profile/${user.username}`); }}
                  className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden cursor-pointer"
                >
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 -mr-2 text-[#0F1419] hover:bg-[#F7F9F9] rounded-full">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div onClick={() => { setIsDrawerOpen(false); navigate(`/profile/${user.username}`); }} className="cursor-pointer">
                <h3 className="font-bold text-[17px] text-[#0F1419] leading-tight">{user.name || user.username}</h3>
                <p className="text-[15px] text-[#536471]">@{user.username}</p>
              </div>
              <div className="flex gap-4 mt-3 text-[14px]">
                <div className="flex gap-1 hover:underline cursor-pointer"><span className="font-bold text-[#0F1419]">124</span><span className="text-[#536471]">Following</span></div>
                <div className="flex gap-1 hover:underline cursor-pointer"><span className="font-bold text-[#0F1419]">1,402</span><span className="text-[#536471]">Followers</span></div>
              </div>
            </div>

            {/* Drawer Nav Items */}
            <nav className="flex-1 py-2">
              {navItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => { setIsDrawerOpen(false); navigate(item.path); }}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#F7F9F9] transition-colors text-left"
                >
                  <item.icon size={22} className="text-[#0F1419]" strokeWidth={2} />
                  <span className="font-bold text-[17px] text-[#0F1419]">{item.label}</span>
                  {item.badge && <span className="ml-auto w-1.5 h-1.5 bg-[#7C3AED] rounded-full" />}
                </button>
              ))}
            </nav>

            {/* Logout Section */}
            <div className="p-4 border-t border-[#EFF3F4]">
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[15px] rounded-full transition-colors border border-red-200"
              >
                Log out @{user.username}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsLogoutModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-[320px] p-8 text-center shadow-xl">
            <h2 className="font-bold text-[20px] text-[#0F1419] mb-2">Log out of SOLITX?</h2>
            <p className="text-[#536471] text-[15px] mb-6 leading-relaxed">
              You can always log back in at any time. If you just want to switch accounts, you can do that by adding an existing account.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-[#0F1419] hover:bg-[#272c30] text-white font-bold text-[15px] rounded-full transition-colors"
              >
                Log out
              </button>
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="w-full py-3 bg-white hover:bg-[#E7ECF0] text-[#0F1419] font-bold text-[15px] rounded-full transition-colors border border-[#CFD9DE]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppShell;
