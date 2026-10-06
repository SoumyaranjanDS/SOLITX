import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';
import api from '../api';

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await api.post(isLogin ? '/auth/login' : '/auth/register', formData);
      const data = response.data;
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen relative font-sans flex items-center justify-center p-4">
      {/* Background Image - Sky with clouds */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=1600&q=80")' }}
      >
        {/* Subtle overlay to make it look dreamy like the reference */}
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]"></div>
        
        {/* Faint concentric circles from the reference design */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/3 w-[800px] h-[800px] rounded-full border border-white/30 pointer-events-none"></div>
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/3 w-[1200px] h-[1200px] rounded-full border border-white/20 pointer-events-none"></div>
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-8 h-8 bg-[#0F1419] rounded-[8px] flex items-center justify-center transform rotate-3">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M10 22 L16 10 L22 22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="10" r="3" fill="white"/>
            <path d="M10 22 H22" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="font-extrabold text-[20px] text-[#0F1419] tracking-tight">SOLITX</span>
      </div>

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-xl rounded-[32px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
        
        {/* Floating Icon inside card */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] flex items-center justify-center border border-gray-50">
            <LogIn size={24} className="text-[#0F1419]" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-bold text-[#0F1419] mb-3">
            {isLogin ? 'Sign in with email' : 'Create an account'}
          </h1>
          <p className="text-[14px] text-[#6B7280] leading-relaxed px-4">
            {isLogin 
              ? 'Make a new doc to bring your words, data, and teams together. For free'
              : 'Join SOLITX to bring your workflow, data, and teams together. For free'
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[14px] text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          
          {/* Username (Register only) */}
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-[#9CA3AF]" />
              </div>
              <input
                type="text"
                placeholder="Username"
                className="w-full h-[48px] pl-11 pr-4 bg-[#F3F4F6] hover:bg-[#E5E7EB] focus:bg-white border border-transparent focus:border-[#7C3AED] rounded-xl text-[14px] text-[#0F1419] outline-none transition-all placeholder:text-[#9CA3AF]"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required={!isLogin}
              />
            </div>
          )}

          {/* Email */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail size={18} className="text-[#9CA3AF]" />
            </div>
            <input
              type="email"
              placeholder="Email"
              className="w-full h-[48px] pl-11 pr-4 bg-[#F3F4F6] hover:bg-[#E5E7EB] focus:bg-white border border-transparent focus:border-[#7C3AED] rounded-xl text-[14px] text-[#0F1419] outline-none transition-all placeholder:text-[#9CA3AF]"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock size={18} className="text-[#9CA3AF]" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="w-full h-[48px] pl-11 pr-12 bg-[#F3F4F6] hover:bg-[#E5E7EB] focus:bg-white border border-transparent focus:border-[#7C3AED] rounded-xl text-[14px] text-[#0F1419] outline-none transition-all placeholder:text-[#9CA3AF]"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Forgot Password */}
          <div className="flex justify-end mt-1 mb-2">
            <button type="button" className="text-[13px] text-[#0F1419] font-medium hover:underline">
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[50px] bg-gradient-to-b from-[#2D333B] to-[#1E2329] hover:from-[#1E2329] hover:to-[#0F1419] text-white font-medium text-[15px] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-[#1E2329]"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLogin ? 'Get Started' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 mt-8 mb-6">
          <div className="flex-1 border-t border-dotted border-gray-300" />
          <span className="text-[12px] text-[#9CA3AF] font-medium">Or {isLogin ? 'sign in' : 'register'} with</span>
          <div className="flex-1 border-t border-dotted border-gray-300" />
        </div>

        {/* Social Buttons */}
        <div className="flex justify-center">
          <button
            onClick={handleGoogleLogin}
            className="w-full h-[48px] bg-white rounded-2xl flex items-center justify-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-50 hover:bg-gray-50 transition-colors text-[14px] font-medium text-[#4B5563]"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="mt-8 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setFormData({ username: '', email: '', password: '' }); }}
            className="text-[14px] text-[#6B7280] hover:text-[#0F1419] transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Auth;
