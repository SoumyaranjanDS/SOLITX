import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
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
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    
    try {
      const response = await api.post(endpoint, formData);
      const data = response.data;
      
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
      {/* 
        Mobile-first container. 
        On mobile, it fills the width (w-full). 
        On desktop, it restricts to max-w-md (448px) to keep inputs narrow.
        Strict adherence to Swiss Editorial: 1px border, NO drop shadows.
      */}
      <div className="w-full max-w-md bg-surface p-6 sm:p-10 border border-hairline rounded-md">
        
        {/* Logo */}
        <div className="flex justify-center items-center gap-1.5 mb-8">
          <span className="text-2xl font-bold tracking-tight text-ink">SOLIT</span>
          <span className="text-2xl font-bold text-accent">X</span>
        </div>

        {/* Headings */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-ink mb-2">
            {isLogin ? 'Welcome back.' : 'Join the network.'}
          </h2>
          <p className="text-sm text-ink-subtle">
            {isLogin 
              ? 'Enter your credentials to access your feed.' 
              : 'Create an account to start publishing.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 border border-red-200 bg-red-50 text-red-900 text-sm rounded-md text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-semibold mb-1.5 text-ink">
                Username
              </label>
              <input
                type="text"
                placeholder="@handle"
                className="w-full h-11 px-3 bg-surface border border-hairline rounded-md text-sm placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] uppercase tracking-widest font-semibold mb-1.5 text-ink">
              Email Address
            </label>
            <input
              type="email"
              placeholder="editor@solitx.press"
              className="w-full h-11 px-3 bg-surface border border-hairline rounded-md text-sm placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="block text-[11px] uppercase tracking-widest font-semibold text-ink">
                Password
              </label>
              {isLogin && (
                <button type="button" className="text-[12px] text-ink-subtle hover:text-ink font-medium transition-colors">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                className="w-full h-11 pl-3 pr-10 bg-surface border border-hairline rounded-md text-sm placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors tracking-widest"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 flex justify-center items-center gap-2 bg-ink text-canvas rounded-md text-[13px] font-semibold uppercase tracking-wider hover:bg-ink-subtle transition-colors disabled:opacity-70"
            >
              {isLogin ? 'Sign In To Solitx' : 'Create Account'}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-ink-subtle">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setFormData({username:'', email:'', password:''}) }}
            className="text-accent font-medium hover:underline"
          >
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </div>

      </div>

      {/* Footer Text */}
      <div className="mt-8 text-center px-4 max-w-[280px]">
        <p className="text-[12px] text-ink-subtle leading-relaxed">
          By continuing, you agree to SOLITX's{' '}
          <a href="#" className="underline hover:text-ink transition-colors">Terms of Service</a> and{' '}
          <a href="#" className="underline hover:text-ink transition-colors">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default Auth;
