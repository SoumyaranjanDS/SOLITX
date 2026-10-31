import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Palette, 
  Key, 
  Code2, 
  HelpCircle, 
  LogOut, 
  Shield, 
  Check, 
  ChevronRight, 
  Command, 
  Bell, 
  Globe 
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { redirectToAuth } from '../utils/authRedirect';

const ACCENT_COLORS = [
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Blue', hex: '#1D9BF0' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Rose', hex: '#F43F5E' },
];

const SHORTCUTS = [
  { key: 'N', desc: 'Compose new post' },
  { key: 'J / K', desc: 'Next / Previous post in feed' },
  { key: 'L', desc: 'Like focused post' },
  { key: 'R', desc: 'Reply to post' },
  { key: '/', desc: 'Focus search bar' },
  { key: 'Esc', desc: 'Close modals & drawers' },
];

const More = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedColor, setSelectedColor] = useState('#7C3AED');
  const [fontSize, setFontSize] = useState('Default');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white pb-12">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 py-3">
          <h1 className="text-[20px] font-black text-[#0F1419]">Settings & Tools</h1>
          <p className="text-[13px] text-[#536471]">Preferences, customization & developer tools</p>
        </div>

        <div className="divide-y divide-[#EFF3F4]">
          
          {/* Section: Display & Customization */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette size={20} className="text-[#7C3AED]" />
              <h2 className="font-extrabold text-[17px] text-[#0F1419]">Display & Customization</h2>
            </div>
            
            {/* Color Accent */}
            <div className="bg-[#F7F9F9] rounded-2xl p-4 mb-4">
              <p className="font-bold text-[14px] text-[#0F1419] mb-2">Accent Color</p>
              <div className="flex gap-4">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color.hex)}
                    style={{ backgroundColor: color.hex }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-transform active:scale-95"
                    title={color.name}
                  >
                    {selectedColor === color.hex && <Check size={18} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="bg-[#F7F9F9] rounded-2xl p-4">
              <p className="font-bold text-[14px] text-[#0F1419] mb-2">Font Sizing</p>
              <div className="flex gap-2">
                {['Small', 'Default', 'Large'].map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`flex-1 py-2 rounded-xl text-[14px] font-bold transition-all ${
                      fontSize === size
                        ? 'bg-[#0F1419] text-white shadow-sm'
                        : 'bg-white text-[#536471] border border-gray-200 hover:text-[#0F1419]'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Account & Security */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={20} className="text-[#7C3AED]" />
              <h2 className="font-extrabold text-[17px] text-[#0F1419]">Account & Security</h2>
            </div>

            <div className="space-y-1">
              <div 
                onClick={() => currentUser?.username ? navigate(`/profile/${currentUser.username}`) : redirectToAuth(navigate)}
                className="flex items-center justify-between p-3.5 rounded-xl hover:bg-[#F7F9F9] cursor-pointer transition-colors"
              >
                <div>
                  <p className="font-bold text-[15px] text-[#0F1419]">Profile Information</p>
                  <p className="text-[13px] text-[#536471]">
                    {currentUser?.username ? `@${currentUser.username} (${currentUser.name || 'Developer'})` : 'Sign in to manage profile'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-[#536471]" />
              </div>

              <div 
                onClick={() => navigate('/premium')}
                className="flex items-center justify-between p-3.5 rounded-xl hover:bg-[#F7F9F9] cursor-pointer transition-colors"
              >
                <div>
                  <p className="font-bold text-[15px] text-[#0F1419]">Subscription & Badges</p>
                  <p className="text-[13px] text-[#536471]">Manage verified status and creator perks</p>
                </div>
                <ChevronRight size={18} className="text-[#536471]" />
              </div>
            </div>
          </div>

          {/* Section: Shortcuts & Tools */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Command size={20} className="text-[#7C3AED]" />
              <h2 className="font-extrabold text-[17px] text-[#0F1419]">Quick Tools & Shortcuts</h2>
            </div>

            <button
              onClick={() => setShowShortcutsModal(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-[#F7F9F9] text-left transition-colors"
            >
              <div>
                <p className="font-bold text-[15px] text-[#0F1419]">Keyboard Shortcuts</p>
                <p className="text-[13px] text-[#536471]">View keyboard hotkeys for power-user navigation</p>
              </div>
              <ChevronRight size={18} className="text-[#536471]" />
            </button>
          </div>

          {/* Section: About & Terms */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 size={20} className="text-[#7C3AED]" />
              <h2 className="font-extrabold text-[17px] text-[#0F1419]">About SOLITX</h2>
            </div>
            <p className="text-[14px] text-[#536471] leading-relaxed">
              SOLITX is a high-performance developer community platform engineered with PostgreSQL, Redis distributed caching, and clean modern UI principles.
            </p>
            <div className="flex gap-4 mt-3 text-[13px] font-bold text-[#7C3AED]">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:underline">Documentation</a>
              <span>·</span>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:underline">API Reference</a>
              <span>·</span>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:underline">Release Notes</a>
            </div>
          </div>

          {/* Logout button */}
          {currentUser?.username && (
            <div className="p-5">
              <button
                onClick={() => setShowLogoutModal(true)}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[15px] rounded-full transition-colors flex items-center justify-center gap-2 border border-red-200"
              >
                <LogOut size={18} />
                <span>Log out @{currentUser.username}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[420px] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFF3F4]">
              <h3 className="font-extrabold text-[18px] text-[#0F1419]">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-[#536471] hover:text-[#0F1419] font-bold text-[14px]"
              >
                Done
              </button>
            </div>

            <div className="mt-4 divide-y divide-[#EFF3F4]">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="py-2.5 flex items-center justify-between">
                  <span className="text-[14px] text-[#536471]">{s.desc}</span>
                  <kbd className="px-2.5 py-1 bg-[#EFF3F4] text-[#0F1419] font-mono font-bold text-[13px] rounded-lg border border-gray-200 shadow-xs">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-[320px] p-6 text-center shadow-2xl">
            <h3 className="font-bold text-[20px] text-[#0F1419] mb-2">Log out of SOLITX?</h3>
            <p className="text-[#536471] text-[14px] mb-6">
              You can log back in at any time with your email and password.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleLogout}
                className="w-full py-2.5 bg-[#0F1419] hover:bg-[#272C30] text-white font-bold text-[15px] rounded-full transition-colors"
              >
                Log out
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-2.5 bg-white border border-[#CFD9DE] hover:bg-gray-50 text-[#0F1419] font-bold text-[15px] rounded-full transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default More;
