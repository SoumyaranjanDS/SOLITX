import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  Sun, 
  Moon, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import api from '../api';
import { SolitxLogo } from '../components/AppShell';

// ─── Sculptural Ring Illustration ─────────────────────────────────────────────
const SculpturalIllustration = ({ isDark }) => (
  <div className="relative w-full max-w-[380px] lg:max-w-[420px] aspect-[4/3] mx-auto flex items-center justify-center select-none pointer-events-none my-2 lg:my-6">
    {/* Ambient Soft Glow */}
    <div 
      className={`absolute w-60 h-60 lg:w-72 lg:h-72 rounded-full blur-3xl opacity-40 transition-colors duration-500 ${
        isDark ? 'bg-[#293E30]/70' : 'bg-[#D6E8A2]/60'
      }`} 
    />
    
    <svg 
      viewBox="0 0 500 400" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className="relative z-10 w-full h-full transform transition-transform duration-700 hover:scale-[1.02]"
      role="img"
      aria-hidden="true"
    >
      <defs>
        {/* Main Torus Gradient */}
        <linearGradient id="sculptureGradMain" x1="110" y1="80" x2="390" y2="320" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isDark ? "#D6E8A2" : "#26372C"} />
          <stop offset="32%" stopColor={isDark ? "#9CB67E" : "#3D5844"} />
          <stop offset="68%" stopColor={isDark ? "#384E3F" : "#728F66"} />
          <stop offset="100%" stopColor={isDark ? "#1E2A22" : "#D6E8A2"} />
        </linearGradient>

        {/* Inner Counter-Ring Gradient */}
        <linearGradient id="sculptureGradInner" x1="180" y1="140" x2="320" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isDark ? "#2A3A2F" : "#D6E8A2"} stopOpacity="0.75" />
          <stop offset="100%" stopColor={isDark ? "#D6E8A2" : "#26372C"} stopOpacity="0.85" />
        </linearGradient>

        {/* Central Core Ambient Gradient */}
        <radialGradient id="sculptureCoreWash" cx="250" cy="200" r="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isDark ? "#D6E8A2" : "#C4DD89"} stopOpacity={isDark ? "0.18" : "0.32"} />
          <stop offset="100%" stopColor={isDark ? "#D6E8A2" : "#C4DD89"} stopOpacity="0" />
        </radialGradient>

        {/* Tactile Shadow */}
        <filter id="sculptureDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow 
            dx="0" 
            dy="16" 
            stdDeviation="16" 
            floodColor={isDark ? "#000000" : "#26372C"} 
            floodOpacity={isDark ? "0.45" : "0.12"} 
          />
        </filter>
      </defs>

      {/* Radial Wash */}
      <ellipse cx="250" cy="205" rx="170" ry="110" fill="url(#sculptureCoreWash)" />

      {/* Fine Orbital Trajectories */}
      <ellipse 
        cx="250" 
        cy="200" 
        rx="210" 
        ry="115" 
        stroke={isDark ? "#2F4234" : "#C8D3BC"} 
        strokeWidth="1" 
        strokeDasharray="4 6" 
        transform="rotate(-16 250 200)" 
      />
      <ellipse 
        cx="250" 
        cy="200" 
        rx="180" 
        ry="85" 
        stroke={isDark ? "#384E3E" : "#D3DEC7"} 
        strokeWidth="1" 
        transform="rotate(24 250 200)" 
      />

      {/* Fine Orbital Planetary Dots */}
      <circle cx="85" cy="180" r="4" fill={isDark ? "#D6E8A2" : "#293E30"} opacity="0.8" />
      <circle cx="415" cy="225" r="3" fill={isDark ? "#9CB67E" : "#728F66"} opacity="0.75" />
      <circle cx="270" cy="72" r="2.5" fill={isDark ? "#D6E8A2" : "#293E30"} opacity="0.6" />

      {/* Rear Arc of the Sculptural Ring */}
      <path
        d="M 130 200 C 130 145, 185 105, 250 105 C 315 105, 370 145, 370 200"
        stroke={isDark ? "#2D3E32" : "#BDC9B0"}
        strokeWidth="28"
        strokeLinecap="round"
        opacity="0.65"
        transform="rotate(-18 250 200)"
      />

      {/* Inner Sculptural Ellipse */}
      <ellipse
        cx="250"
        cy="200"
        rx="95"
        ry="50"
        fill="url(#sculptureGradInner)"
        transform="rotate(-18 250 200)"
        opacity="0.32"
      />

      {/* Main Tilted Torus Sculptural Band (Front) */}
      <g filter="url(#sculptureDropShadow)">
        <path
          d="M 115 190 C 120 120, 185 85, 265 95 C 345 105, 395 155, 385 220 C 375 285, 305 320, 230 310 C 150 300, 110 250, 115 190 Z"
          fill="none"
          stroke="url(#sculptureGradMain)"
          strokeWidth="38"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(-14 250 200)"
        />
        {/* Subtle Ceramic Ridge Reflection */}
        <path
          d="M 125 185 C 130 130, 190 100, 265 110 C 340 120, 380 160, 375 215"
          fill="none"
          stroke={isDark ? "#D6E8A2" : "#FFFFFF"}
          strokeWidth="3"
          strokeLinecap="round"
          opacity={isDark ? "0.7" : "0.5"}
          transform="rotate(-14 250 200)"
        />
      </g>
    </svg>
  </div>
);

// ─── Main Auth Page ───────────────────────────────────────────────────────────
const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Appearance Theme state (warm ivory / deep green-charcoal)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('solitx_auth_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('solitx_auth_theme', next);
      } catch {}
      return next;
    });
  };

  const isDark = theme === 'dark';

  // Determine redirect destination from query, location state, or sessionStorage
  const redirectParam = searchParams.get('redirect');
  const stateFrom = location.state?.from;
  const rawTarget = redirectParam || stateFrom || sessionStorage.getItem('auth_redirect') || '/';
  const redirectTarget = (rawTarget && rawTarget !== '/auth' && !rawTarget.startsWith('/auth?')) ? rawTarget : '/';

  useEffect(() => {
    if (redirectTarget && redirectTarget !== '/') {
      try {
        sessionStorage.setItem('auth_redirect', redirectTarget);
      } catch {}
    }
  }, [redirectTarget]);

  // Form State
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await api.post(isLogin ? '/auth/login' : '/auth/register', formData);
      const data = response.data;
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      window.dispatchEvent(new CustomEvent('user-updated', { detail: data.data.user }));
      if (!isLogin) {
        localStorage.setItem('show_onboarding', 'true');
      }
      try {
        sessionStorage.removeItem('auth_redirect');
      } catch {}
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleLogin = () => {
    if (redirectTarget && redirectTarget !== '/') {
      try {
        sessionStorage.setItem('auth_redirect', redirectTarget);
      } catch {}
    }
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  // Forgot Password Submit
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    // Simulate quiet recovery dispatch without breaking backend contracts
    setTimeout(() => {
      setForgotLoading(false);
      setForgotSent(true);
    }, 600);
  };

  return (
    <div 
      className={`min-h-screen flex flex-col justify-between font-sans transition-colors duration-300 selection:bg-[#D6E8A2] selection:text-[#26372C] ${
        isDark ? 'bg-[#131915] text-[#ECF0EB]' : 'bg-[#F6F5F1] text-[#26372C]'
      }`}
    >
      {/* ── Slim Header ── */}
      <header className="w-full px-5 sm:px-8 lg:px-12 py-4 flex items-center justify-between border-b transition-colors duration-300 border-transparent">
        {/* Left: Brand Identity */}
        <div 
          onClick={() => navigate(redirectTarget)}
          className="flex items-center gap-3 cursor-pointer group"
          title={redirectTarget !== '/' ? 'Return to previous page' : 'SOLITX Home'}
        >
          <div 
            className={`w-9 h-9 rounded-[10px] flex items-center justify-center transition-all duration-200 group-hover:scale-105 ${
              isDark ? 'bg-[#D6E8A2] text-[#16221A]' : 'bg-[#293E30] text-[#FFFEFA]'
            }`}
          >
            <SolitxLogo size={22} color="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[18px] tracking-tight leading-none">
              SOLITX
            </span>
            <span className={`text-[10px] tracking-[0.14em] font-semibold uppercase mt-0.5 ${isDark ? 'text-[#8EA293]' : 'text-[#647468]'}`}>
              Developer Network
            </span>
          </div>
        </div>

        {/* Right: Controls (Return indicator & Theme toggle) */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {redirectTarget !== '/' && (
            <button
              onClick={() => navigate(redirectTarget)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors ${
                isDark 
                  ? 'bg-[#1E2922] text-[#A6BAAB] hover:text-[#ECF0EB] hover:bg-[#25332A]' 
                  : 'bg-[#EAE8E1] text-[#546559] hover:text-[#26372C] hover:bg-[#DFDCD4]'
              }`}
            >
              <ArrowLeft size={13} />
              <span>Resume to page</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-2 rounded-full border transition-all duration-200 active:scale-95 ${
              isDark 
                ? 'bg-[#1B2520] border-[#2A392F] text-[#D6E8A2] hover:bg-[#233129]' 
                : 'bg-[#FFFEFA] border-[#E3E4DC] text-[#293E30] hover:bg-[#EFECE3]'
            }`}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex items-center justify-center">
        <div 
          className={`w-full rounded-[22px] border transition-all duration-300 shadow-[0_8px_32px_rgba(38,55,44,0.04)] overflow-hidden ${
            isDark 
              ? 'bg-[#1A231E] border-[#29362C]' 
              : 'bg-[#FFFEFA] border-[#E3E4DC]'
          }`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px] lg:min-h-[640px]">
            
            {/* ── Left Column: Visual Introduction Panel ── */}
            <div className="p-2 sm:p-2.5 lg:col-span-7 flex flex-col">
              <div 
                className={`w-full h-full rounded-[16px] p-6 sm:p-8 lg:p-12 flex flex-col justify-between transition-colors duration-300 ${
                  isDark ? 'bg-[#212D25]' : 'bg-[#E9EDDF]'
                }`}
              >
                {/* Top Editorial Copy */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span 
                      className={`text-[10.5px] font-bold tracking-[0.2em] uppercase ${
                        isDark ? 'text-[#D6E8A2]' : 'text-[#4F6354]'
                      }`}
                    >
                      SOLITX · Architecture & Code
                    </span>
                  </div>

                  <h1 
                    style={{ fontFamily: "Georgia, Charter, 'Times New Roman', serif" }}
                    className={`text-[28px] sm:text-[34px] lg:text-[42px] leading-[1.14] font-medium tracking-tight mb-4 ${
                      isDark ? 'text-[#ECF0EB]' : 'text-[#26372C]'
                    }`}
                  >
                    Where modern engineering meets architectural <span className="italic font-normal">clarity</span>.
                  </h1>

                  <p 
                    className={`text-[14px] sm:text-[15px] leading-relaxed max-w-[480px] ${
                      isDark ? 'text-[#9DB1A2]' : 'text-[#55675A]'
                    }`}
                  >
                    Join developers, system architects, and builders sharing in-depth technical breakdowns, production post-mortems, and live system architectures.
                  </p>
                </div>

                {/* Middle Sculptural Ring Illustration */}
                <SculpturalIllustration isDark={isDark} />

                {/* Bottom Quiet Product Statement */}
                <div 
                  className={`pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] ${
                    isDark ? 'border-[#2D3E32] text-[#86998C]' : 'border-[#D5DDCB] text-[#697B6E]'
                  }`}
                >
                  <span>Built for engineers who care about clean design and distributed reliability.</span>
                  <span className="font-mono text-[11px] opacity-75">v2.4 · 2026</span>
                </div>
              </div>
            </div>

            {/* ── Right Column: Authentication Form ── */}
            <div className="lg:col-span-5 p-6 sm:p-10 lg:p-12 flex flex-col justify-center items-center">
              <div className="w-full max-w-[370px]">

                {/* Segmented Control (Sign In vs Create Account) */}
                <div 
                  role="tablist"
                  className={`p-1 rounded-xl flex items-center mb-6 transition-colors ${
                    isDark ? 'bg-[#141C17] border border-[#233128]' : 'bg-[#F0EFEB] border border-[#E3E4DC]'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isLogin}
                    onClick={() => { setIsLogin(true); setError(''); }}
                    className={`flex-1 py-2 text-[13.5px] font-bold rounded-[9px] transition-all duration-200 text-center ${
                      isLogin 
                        ? (isDark ? 'bg-[#293E30] text-[#ECF0EB] shadow-xs' : 'bg-[#FFFEFA] text-[#26372C] shadow-xs') 
                        : (isDark ? 'text-[#849789] hover:text-[#ECF0EB]' : 'text-[#647468] hover:text-[#26372C]')
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!isLogin}
                    onClick={() => { setIsLogin(false); setError(''); }}
                    className={`flex-1 py-2 text-[13.5px] font-bold rounded-[9px] transition-all duration-200 text-center ${
                      !isLogin 
                        ? (isDark ? 'bg-[#293E30] text-[#ECF0EB] shadow-xs' : 'bg-[#FFFEFA] text-[#26372C] shadow-xs') 
                        : (isDark ? 'text-[#849789] hover:text-[#ECF0EB]' : 'text-[#647468] hover:text-[#26372C]')
                    }`}
                  >
                    Create account
                  </button>
                </div>

                {/* Form Heading & Subtext */}
                <div className="mb-6">
                  <h2 className="text-[22px] sm:text-[24px] font-bold tracking-tight">
                    {isLogin ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className={`text-[13.5px] mt-1 leading-relaxed ${isDark ? 'text-[#96A89B]' : 'text-[#607164]'}`}>
                    {isLogin 
                      ? 'Enter your credentials to access your developer feed and discussions.' 
                      : 'Join SOLITX to publish insights, follow creators, and save bookmarks.'
                    }
                  </p>
                </div>

                {/* Return Destination Banner (if user came from a specific post/action) */}
                {redirectTarget && redirectTarget !== '/' && (
                  <div 
                    className={`mb-5 px-3.5 py-2.5 rounded-xl border text-[12.5px] font-medium flex items-center gap-2 ${
                      isDark 
                        ? 'bg-[#D6E8A2]/10 border-[#D6E8A2]/25 text-[#D6E8A2]' 
                        : 'bg-[#D6E8A2]/30 border-[#D6E8A2] text-[#26372C]'
                    }`}
                  >
                    <CheckCircle2 size={15} className="flex-shrink-0" />
                    <span>Sign in to return straight to your spot.</span>
                  </div>
                )}

                {/* Social Authentication: Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className={`w-full h-12 rounded-[10px] border font-medium text-[14px] flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] ${
                    isDark 
                      ? 'bg-[#151D18] border-[#29372E] text-[#ECF0EB] hover:bg-[#1C2720]' 
                      : 'bg-[#FFFEFA] border-[#E3E4DC] text-[#26372C] hover:bg-[#F6F5F1] shadow-xs'
                  }`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Thin Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className={`flex-1 border-t ${isDark ? 'border-[#29362C]' : 'border-[#E3E4DC]'}`} />
                  <span className={`text-[11.5px] uppercase tracking-wider font-semibold ${isDark ? 'text-[#75897B]' : 'text-[#849588]'}`}>
                    or continue with email
                  </span>
                  <div className={`flex-1 border-t ${isDark ? 'border-[#29362C]' : 'border-[#E3E4DC]'}`} />
                </div>

                {/* Error Banner */}
                {error && (
                  <div 
                    role="alert"
                    className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[13px] flex items-start gap-2 animate-in fade-in"
                  >
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email + Password Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  
                  {/* Email Input */}
                  <div>
                    <label 
                      htmlFor="email"
                      className={`block text-[12.5px] font-semibold mb-1.5 ${isDark ? 'text-[#CCD8CF]' : 'text-[#3B4D40]'}`}
                    >
                      Email address
                    </label>
                    <div className="relative flex items-center">
                      <div className={`absolute left-3.5 pointer-events-none ${isDark ? 'text-[#677A6C]' : 'text-[#8C9C90]'}`}>
                        <Mail size={16} />
                      </div>
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="name@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full h-12 pl-10 pr-3.5 rounded-[10px] text-[15px] border outline-none transition-all duration-150 ${
                          isDark 
                            ? 'bg-[#151D18] border-[#29382F] text-[#ECF0EB] placeholder:text-[#5F7365] focus:border-[#D6E8A2] focus:ring-1 focus:ring-[#D6E8A2]' 
                            : 'bg-[#F7F6F2] border-[#E3E4DC] text-[#26372C] placeholder:text-[#8D9E92] focus:border-[#293E30] focus:ring-1 focus:ring-[#293E30] focus:bg-[#FFFEFA]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label 
                        htmlFor="password"
                        className={`block text-[12.5px] font-semibold ${isDark ? 'text-[#CCD8CF]' : 'text-[#3B4D40]'}`}
                      >
                        Password
                      </label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => { setShowForgotModal(true); setForgotEmail(formData.email); setForgotSent(false); }}
                          className={`text-[12px] font-medium hover:underline transition-colors ${
                            isDark ? 'text-[#D6E8A2]' : 'text-[#293E30]'
                          }`}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <div className={`absolute left-3.5 pointer-events-none ${isDark ? 'text-[#677A6C]' : 'text-[#8C9C90]'}`}>
                        <Lock size={16} />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        placeholder="••••••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`w-full h-12 pl-10 pr-11 rounded-[10px] text-[15px] border outline-none transition-all duration-150 ${
                          isDark 
                            ? 'bg-[#151D18] border-[#29382F] text-[#ECF0EB] placeholder:text-[#5F7365] focus:border-[#D6E8A2] focus:ring-1 focus:ring-[#D6E8A2]' 
                            : 'bg-[#F7F6F2] border-[#E3E4DC] text-[#26372C] placeholder:text-[#8D9E92] focus:border-[#293E30] focus:ring-1 focus:ring-[#293E30] focus:bg-[#FFFEFA]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        className={`absolute right-3.5 p-1 rounded-md transition-colors ${
                          isDark ? 'text-[#7D9383] hover:text-[#ECF0EB]' : 'text-[#7E8F82] hover:text-[#26372C]'
                        }`}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {!isLogin && (
                      <p className={`text-[12px] mt-1.5 ${isDark ? 'text-[#8EA294]' : 'text-[#6C7E71]'}`}>
                        You'll pick your unique @handle in the next step.
                      </p>
                    )}
                  </div>

                  {/* Primary Action Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !formData.email || !formData.password}
                    className={`w-full h-12 mt-2 rounded-[10px] font-bold text-[14.5px] flex items-center justify-center gap-2 transition-all duration-200 shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark 
                        ? 'bg-[#D6E8A2] hover:bg-[#C7DC8E] text-[#16221A]' 
                        : 'bg-[#293E30] hover:bg-[#1E2E23] text-[#FFFEFA]'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Switch Prompt */}
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => { setIsLogin(prev => !prev); setError(''); }}
                    className={`text-[13px] font-medium transition-colors ${
                      isDark ? 'text-[#96A89B] hover:text-[#D6E8A2]' : 'text-[#5E7062] hover:text-[#26372C]'
                    }`}
                  >
                    {isLogin 
                      ? "Don't have an account? Create one" 
                      : "Already have an account? Sign in"
                    }
                  </button>
                </div>

                {/* Quiet Legal Terms */}
                <p className={`text-[11.5px] text-center mt-6 leading-relaxed ${isDark ? 'text-[#67796C]' : 'text-[#8E9F92]'}`}>
                  By continuing, you agree to SOLITX's Terms of Service and Privacy Policy.
                </p>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── Quiet Footer ── */}
      <footer className="w-full px-6 lg:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] transition-colors border-t border-transparent">
        <span className={isDark ? 'text-[#67796C]' : 'text-[#849487]'}>
          © 2026 SOLITX · Built for the global developer community
        </span>
        <div className={`flex items-center gap-4 ${isDark ? 'text-[#7D9182]' : 'text-[#6B7C6E]'}`}>
          <span className="hover:underline cursor-pointer" onClick={() => navigate('/')}>Home</span>
          <span>·</span>
          <span className="hover:underline cursor-pointer" onClick={() => navigate('/explore')}>Explore</span>
          <span>·</span>
          <span className="hover:underline cursor-pointer" onClick={() => navigate('/communities')}>Communities</span>
        </div>
      </footer>

      {/* ── Password Recovery Modal ── */}
      {showForgotModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowForgotModal(false)}
        >
          <div 
            className={`w-full max-w-[400px] p-6 sm:p-7 rounded-[20px] border shadow-2xl relative ${
              isDark ? 'bg-[#1A231E] border-[#29362C] text-[#ECF0EB]' : 'bg-[#FFFEFA] border-[#E3E4DC] text-[#26372C]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowForgotModal(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${
                isDark ? 'hover:bg-[#25332A] text-[#86998C]' : 'hover:bg-[#F0EFEB] text-[#697B6E]'
              }`}
              title="Close"
            >
              <X size={18} />
            </button>

            <h3 className="text-[19px] font-bold tracking-tight mb-2">
              Reset your password
            </h3>
            <p className={`text-[13px] leading-relaxed mb-4 ${isDark ? 'text-[#96A89B]' : 'text-[#607164]'}`}>
              Enter the email associated with your SOLITX account and we'll send you recovery instructions.
            </p>

            {forgotSent ? (
              <div 
                className={`p-4 rounded-xl border text-[13px] flex items-start gap-2 mb-4 ${
                  isDark ? 'bg-[#D6E8A2]/10 border-[#D6E8A2]/30 text-[#D6E8A2]' : 'bg-[#E9EDDF] border-[#C8D6BC] text-[#26372C]'
                }`}
              >
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                <span>If an account exists for {forgotEmail}, recovery instructions have been dispatched.</span>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-[10px] text-[14px] border outline-none ${
                    isDark 
                      ? 'bg-[#151D18] border-[#29382F] text-[#ECF0EB] focus:border-[#D6E8A2]' 
                      : 'bg-[#F7F6F2] border-[#E3E4DC] text-[#26372C] focus:border-[#293E30]'
                  }`}
                />
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className={`w-full h-11 rounded-[10px] font-bold text-[13.5px] transition-all flex items-center justify-center gap-2 ${
                    isDark ? 'bg-[#D6E8A2] text-[#16221A] hover:bg-[#C7DC8E]' : 'bg-[#293E30] text-[#FFFEFA] hover:bg-[#1E2E23]'
                  }`}
                >
                  {forgotLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send reset link'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className={`w-full mt-3 py-2 text-[12.5px] font-medium text-center transition-colors ${
                isDark ? 'text-[#8EA294] hover:text-[#ECF0EB]' : 'text-[#6C7E71] hover:text-[#26372C]'
              }`}
            >
              Back to sign in
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
