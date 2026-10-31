import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X
} from 'lucide-react';
import api from '../api';
import { SolitxLogo } from '../components/AppShell';

// ─── Sculptural Ring Illustration (Desktop Hero Only) ─────────────────────────
const SculpturalIllustration = () => (
  <div className="relative w-full max-w-[390px] xl:max-w-[440px] aspect-[4/3] mx-auto flex items-center justify-center select-none pointer-events-none my-4 xl:my-6">
    {/* Ambient Soft Glow */}
    <div className="absolute w-64 h-64 xl:w-76 xl:h-76 rounded-full blur-3xl opacity-40 bg-[#D6E8A2]/60" />
    
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
          <stop offset="0%" stopColor="#26372C" />
          <stop offset="32%" stopColor="#3D5844" />
          <stop offset="68%" stopColor="#728F66" />
          <stop offset="100%" stopColor="#D6E8A2" />
        </linearGradient>

        {/* Inner Counter-Ring Gradient */}
        <linearGradient id="sculptureGradInner" x1="180" y1="140" x2="320" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D6E8A2" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#26372C" stopOpacity="0.85" />
        </linearGradient>

        {/* Central Core Ambient Gradient */}
        <radialGradient id="sculptureCoreWash" cx="250" cy="200" r="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4DD89" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#C4DD89" stopOpacity="0" />
        </radialGradient>

        {/* Tactile Shadow */}
        <filter id="sculptureDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow 
            dx="0" 
            dy="16" 
            stdDeviation="16" 
            floodColor="#26372C" 
            floodOpacity="0.12" 
          />
        </filter>
      </defs>

      {/* Radial Soft Wash */}
      <ellipse cx="250" cy="205" rx="170" ry="110" fill="url(#sculptureCoreWash)" />

      {/* Fine Orbital Trajectories */}
      <ellipse 
        cx="250" 
        cy="200" 
        rx="210" 
        ry="115" 
        stroke="#C8D3BC" 
        strokeWidth="1" 
        strokeDasharray="4 6" 
        transform="rotate(-16 250 200)" 
      />
      <ellipse 
        cx="250" 
        cy="200" 
        rx="180" 
        ry="85" 
        stroke="#D3DEC7" 
        strokeWidth="1" 
        transform="rotate(24 250 200)" 
      />

      {/* Planetary Dots */}
      <circle cx="85" cy="180" r="4" fill="#293E30" opacity="0.8" />
      <circle cx="415" cy="225" r="3" fill="#728F66" opacity="0.75" />
      <circle cx="270" cy="72" r="2.5" fill="#293E30" opacity="0.6" />

      {/* Rear Arc */}
      <path
        d="M 130 200 C 130 145, 185 105, 250 105 C 315 105, 370 145, 370 200"
        stroke="#BDC9B0"
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
        {/* Subtle Ceramic Reflection */}
        <path
          d="M 125 185 C 130 130, 190 100, 265 110 C 340 120, 380 160, 375 215"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
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
    setTimeout(() => {
      setForgotLoading(false);
      setForgotSent(true);
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FFFEFA] text-[#26372C] font-sans selection:bg-[#D6E8A2] selection:text-[#26372C]">
      
      {/* ── Left Half: Full-Height Hero Section (Desktop Only, Edge-to-Edge) ── */}
      <section className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between bg-[#E9EDDF] border-r border-[#E3E4DC] p-10 lg:p-14 xl:p-16 relative overflow-hidden select-none">
        
        {/* Top: Brand Identity Header */}
        <div 
          onClick={() => navigate(redirectTarget)}
          className="flex items-center gap-3 cursor-pointer group w-fit"
          title={redirectTarget !== '/' ? 'Return to previous page' : 'SOLITX Home'}
        >
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center bg-[#293E30] text-[#FFFEFA] transition-transform duration-200 group-hover:scale-105 shadow-xs">
            <SolitxLogo size={24} color="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[20px] tracking-tight leading-none text-[#26372C]">
              SOLITX
            </span>
            <span className="text-[10.5px] tracking-[0.14em] font-semibold uppercase mt-0.5 text-[#5A6D5F]">
              Social Network
            </span>
          </div>
        </div>

        {/* Center: Social Editorial Headline & Sculptural Form */}
        <div className="my-auto py-8">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[#D6E8A2]/40 border border-[#D6E8A2]">
            <span className="text-[10.5px] font-bold tracking-[0.2em] uppercase text-[#293E30]">
              Happening now · Join the conversation
            </span>
          </div>

          <h1 
            style={{ fontFamily: "Georgia, Charter, 'Times New Roman', serif" }}
            className="text-[38px] xl:text-[48px] leading-[1.12] font-medium tracking-tight mb-4 text-[#26372C]"
          >
            Where real conversations come to <span className="italic font-normal">life</span>.
          </h1>

          <p className="text-[15.5px] xl:text-[16.5px] leading-relaxed max-w-[520px] text-[#55675A]">
            Discover breaking updates, follow interesting voices, share what's on your mind, and participate in lively threads across tech, culture, and creativity.
          </p>

          {/* Center Sculptural Torus Artwork */}
          <SculpturalIllustration />
        </div>

        {/* Bottom: Quiet Social Product Statement */}
        <div className="pt-4 border-t border-[#D5DDCB] flex items-center justify-between text-[12.5px] text-[#697B6E]">
          <span>Connect with voices worldwide. Live updates, direct messages, and trending topics.</span>
          <span className="font-semibold text-[12px] opacity-75">© 2026 SOLITX</span>
        </div>
      </section>

      {/* ── Right Half: Full-Height Auth Form (Full Screen on Mobile & Desktop) ── */}
      <section className="w-full lg:w-[48%] xl:w-[45%] min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 bg-[#FFFEFA] overflow-y-auto">
        
        {/* Top Bar (Mobile Brand & Desktop Return Action) */}
        <div className="w-full flex items-center justify-between min-h-[44px]">
          {/* Mobile-Only Header Brand */}
          <div 
            onClick={() => navigate(redirectTarget)}
            className="lg:hidden flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#293E30] text-[#FFFEFA] shadow-xs">
              <SolitxLogo size={22} color="currentColor" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[17px] tracking-tight leading-none text-[#26372C]">
                SOLITX
              </span>
              <span className="text-[10px] tracking-[0.14em] font-semibold uppercase mt-0.5 text-[#647468]">
                Social Network
              </span>
            </div>
          </div>

          {/* Return to Page Indicator (if redirected from post/comment) */}
          {redirectTarget !== '/' && (
            <button
              onClick={() => navigate(redirectTarget)}
              className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium bg-[#F0EFEB] text-[#546559] hover:text-[#26372C] hover:bg-[#EAE8E1] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Resume to page</span>
            </button>
          )}
        </div>

        {/* Center: Auth Form Container */}
        <div className="w-full max-w-[390px] mx-auto my-auto py-6">

          {/* Segmented Control (Sign In vs Create Account) */}
          <div 
            role="tablist"
            className="p-1 rounded-xl flex items-center mb-6 bg-[#F0EFEB] border border-[#E3E4DC]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2 text-[13.5px] font-bold rounded-[9px] transition-all duration-200 text-center ${
                isLogin 
                  ? 'bg-[#FFFEFA] text-[#26372C] shadow-xs' 
                  : 'text-[#647468] hover:text-[#26372C]'
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
                  ? 'bg-[#FFFEFA] text-[#26372C] shadow-xs' 
                  : 'text-[#647468] hover:text-[#26372C]'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Heading & Social Copy */}
          <div className="mb-6">
            <h2 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-[#26372C]">
              {isLogin ? 'Welcome back' : 'Join SOLITX today'}
            </h2>
            <p className="text-[13.5px] mt-1 leading-relaxed text-[#607164]">
              {isLogin 
                ? 'Sign in to check your timeline, replies, and notifications.' 
                : 'Create an account to start posting, sharing thoughts, and following people.'
              }
            </p>
          </div>

          {/* Return Destination Banner (if user came from a specific post/action) */}
          {redirectTarget && redirectTarget !== '/' && (
            <div className="mb-5 px-3.5 py-2.5 rounded-xl border text-[12.5px] font-medium flex items-center gap-2 bg-[#D6E8A2]/30 border-[#D6E8A2] text-[#26372C]">
              <CheckCircle2 size={15} className="flex-shrink-0 text-[#293E30]" />
              <span>Sign in to return straight to your conversation.</span>
            </div>
          )}

          {/* Social Auth: Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full h-12 rounded-[10px] border border-[#E3E4DC] bg-[#FFFEFA] text-[#26372C] hover:bg-[#F6F5F1] font-medium text-[14px] flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] shadow-xs"
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
            <div className="flex-1 border-t border-[#E3E4DC]" />
            <span className="text-[11.5px] uppercase tracking-wider font-semibold text-[#849588]">
              or continue with email
            </span>
            <div className="flex-1 border-t border-[#E3E4DC]" />
          </div>

          {/* Error Banner */}
          {error && (
            <div 
              role="alert"
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[13px] flex items-start gap-2 animate-in fade-in"
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
                className="block text-[12.5px] font-semibold mb-1.5 text-[#3B4D40]"
              >
                Email address
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-[#8C9C90]">
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
                  className="w-full h-12 pl-10 pr-3.5 rounded-[10px] text-[16px] sm:text-[14.5px] bg-[#F7F6F2] border border-[#E3E4DC] text-[#26372C] placeholder:text-[#8D9E92] focus:border-[#293E30] focus:ring-1 focus:ring-[#293E30] focus:bg-[#FFFEFA] outline-none transition-all duration-150"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label 
                  htmlFor="password"
                  className="block text-[12.5px] font-semibold text-[#3B4D40]"
                >
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setShowForgotModal(true); setForgotEmail(formData.email); setForgotSent(false); }}
                    className="text-[12px] font-medium text-[#293E30] hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-[#8C9C90]">
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
                  className="w-full h-12 pl-10 pr-11 rounded-[10px] text-[16px] sm:text-[14.5px] bg-[#F7F6F2] border border-[#E3E4DC] text-[#26372C] placeholder:text-[#8D9E92] focus:border-[#293E30] focus:ring-1 focus:ring-[#293E30] focus:bg-[#FFFEFA] outline-none transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 p-1 rounded-md text-[#7E8F82] hover:text-[#26372C] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!isLogin && (
                <p className="text-[12px] mt-1.5 text-[#6C7E71]">
                  You'll choose your unique @handle right after signing up.
                </p>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isLoading || !formData.email || !formData.password}
              className="w-full h-12 mt-2 rounded-[10px] font-bold text-[14.5px] flex items-center justify-center gap-2 bg-[#293E30] hover:bg-[#1E2E23] text-[#FFFEFA] transition-all duration-200 shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="text-[13px] font-medium text-[#5E7062] hover:text-[#26372C] transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Create one" 
                : "Already have an account? Sign in"
              }
            </button>
          </div>

          {/* Legal Terms */}
          <p className="text-[11.5px] text-center mt-6 leading-relaxed text-[#8E9F92]">
            By continuing, you agree to SOLITX's Terms of Service and Privacy Policy.
          </p>

        </div>

        {/* Bottom Footer Links */}
        <footer className="w-full pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-[#849487]">
          <span>© 2026 SOLITX</span>
          <div className="flex items-center gap-3.5 text-[#6B7C6E]">
            <span className="hover:underline cursor-pointer" onClick={() => navigate('/')}>Home</span>
            <span>·</span>
            <span className="hover:underline cursor-pointer" onClick={() => navigate('/explore')}>Explore</span>
            <span>·</span>
            <span className="hover:underline cursor-pointer" onClick={() => navigate('/communities')}>Communities</span>
          </div>
        </footer>

      </section>

      {/* ── Password Recovery Modal ── */}
      {showForgotModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowForgotModal(false)}
        >
          <div 
            className="w-full max-w-[400px] p-6 sm:p-7 rounded-[20px] border border-[#E3E4DC] bg-[#FFFEFA] text-[#26372C] shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#F0EFEB] text-[#697B6E] transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>

            <h3 className="text-[19px] font-bold tracking-tight mb-2">
              Reset your password
            </h3>
            <p className="text-[13px] leading-relaxed mb-4 text-[#607164]">
              Enter the email associated with your SOLITX account and we'll send you recovery instructions.
            </p>

            {forgotSent ? (
              <div className="p-4 rounded-xl border bg-[#E9EDDF] border-[#C8D6BC] text-[#26372C] text-[13px] flex items-start gap-2 mb-4">
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
                  className="w-full h-11 px-3.5 rounded-[10px] text-[14px] bg-[#F7F6F2] border border-[#E3E4DC] text-[#26372C] focus:border-[#293E30] outline-none"
                />
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full h-11 rounded-[10px] font-bold text-[13.5px] bg-[#293E30] text-[#FFFEFA] hover:bg-[#1E2E23] transition-all flex items-center justify-center gap-2"
                >
                  {forgotLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send reset link'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full mt-3 py-2 text-[12.5px] font-medium text-center text-[#6C7E71] hover:text-[#26372C] transition-colors"
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
