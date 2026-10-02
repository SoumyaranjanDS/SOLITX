import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Trash2 } from 'lucide-react';
import api from '../api';

const Home = () => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // 'logout' or 'delete'

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleAction = async () => {
    try {
      if (confirmAction === 'delete') {
        await api.delete('/auth/delete');
      } else {
        await api.post('/auth/logout');
      }
    } catch (err) {
      console.error("Action failed", err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/auth');
    }
  };

  const triggerConfirm = (action) => {
    setConfirmAction(action);
    setShowConfirm(true);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      
      {/* Mobile-optimized Header */}
      <header className="sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-md border-b border-hairline">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-bold tracking-tight text-ink">SOLIT</span>
            <span className="text-xl font-bold text-accent">X</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <span className="hidden sm:inline-block text-[11px] font-semibold tracking-widest uppercase text-ink-subtle">
              {user.username ? `@${user.username}` : 'Reader'}
            </span>
            <button 
              onClick={() => triggerConfirm('logout')}
              className="text-ink-subtle hover:text-ink transition-colors flex items-center gap-1.5"
              aria-label="Sign out"
            >
              <LogOut size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline-block text-[11px] font-semibold tracking-widest uppercase mt-0.5">
                Sign Out
              </span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Welcome Screen */}
      <main className="max-w-3xl mx-auto w-full px-4 py-20 sm:py-32 text-center">
        
        <h1 className="text-3xl sm:text-[40px] leading-tight font-semibold tracking-tight text-ink mb-4">
          Welcome to SOLITX.
        </h1>
        <p className="text-[15px] text-ink-subtle max-w-md mx-auto leading-relaxed">
          The foundation of the editorial network is built. You are securely authenticated.
        </p>

        {/* Danger Zone (Account Deletion) */}
        <div className="mt-24 sm:mt-32 max-w-lg mx-auto text-left">
          <div className="border border-red-200 bg-red-50/50 rounded-md p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[11px] font-semibold text-red-900 mb-1 uppercase tracking-widest">Danger Zone</h3>
              <p className="text-[13px] text-red-700/80 leading-relaxed max-w-[280px]">
                Permanently erase your identity and all data from the SOLITX network.
              </p>
            </div>
            <button 
              onClick={() => triggerConfirm('delete')}
              className="h-10 px-4 w-full sm:w-auto flex justify-center items-center gap-2 bg-red-600 text-white rounded-md text-[11px] font-semibold uppercase tracking-wider hover:bg-red-700 transition-colors shrink-0"
            >
              <Trash2 size={16} /> Delete Identity
            </button>
          </div>
        </div>
      </main>

      {/* Swiss Editorial Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-surface p-6 sm:p-8 border border-hairline rounded-md">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink mb-2">
              {confirmAction === 'delete' ? 'Delete Identity?' : 'Sign Out?'}
            </h2>
            <p className="text-[13px] text-ink-subtle mb-8 leading-relaxed">
              {confirmAction === 'delete' 
                ? 'This action is irreversible. All your editorial data, posts, and network connections will be permanently wiped.' 
                : 'You will need to re-authenticate to access the network feed and publish.'}
            </p>
            
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <button 
                onClick={() => setShowConfirm(false)}
                className="w-full h-11 border border-hairline rounded-md text-[12px] font-semibold text-ink uppercase tracking-wider hover:bg-surface-recessed transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAction}
                className={`w-full h-11 rounded-md text-[12px] font-semibold text-canvas uppercase tracking-wider transition-colors ${confirmAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-ink hover:bg-ink-subtle'}`}
              >
                {confirmAction === 'delete' ? 'Delete' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
