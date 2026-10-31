import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogIn, UserPlus } from 'lucide-react';
import { SolitxLogo } from './AppShell';
import { redirectToAuth } from '../utils/authRedirect';

const AuthRequiredModal = ({ isOpen, onClose, actionName = 'interact with this post', redirectPath }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToAuth = () => {
    onClose();
    redirectToAuth(navigate, redirectPath);
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[24px] w-full max-w-[380px] p-6 sm:p-7 shadow-2xl text-center relative border border-gray-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors active:scale-95"
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Logo Icon */}
        <div className="w-13 h-13 rounded-2xl bg-[#0F1419] text-white flex items-center justify-center mx-auto mb-4 shadow-sm p-3">
          <SolitxLogo size={28} />
        </div>

        {/* Content */}
        <h2 className="text-[20px] sm:text-[22px] font-black text-[#0F1419] leading-snug mb-2">
          Join the conversation
        </h2>
        <p className="text-[14px] text-[#536471] leading-relaxed mb-6 px-2">
          To {actionName}, sign in or create your free account on SOLITX.
        </p>

        {/* Action Buttons (Mobile-friendly high touch targets) */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleGoToAuth}
            className="w-full h-12 bg-[#0F1419] hover:bg-[#272C30] text-white font-bold text-[15px] rounded-full transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            <span>Sign in</span>
          </button>

          <button
            onClick={handleGoToAuth}
            className="w-full h-12 bg-white hover:bg-[#F7F9F9] text-[#0F1419] font-bold text-[15px] rounded-full transition-all border border-[#CFD9DE] active:scale-98 flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            <span>Create account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthRequiredModal;
