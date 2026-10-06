import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const SetupUsername = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState(null); // 'checking', 'available', 'taken'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) navigate('/auth');
  }, [token, navigate]);

  // Debounce the username check
  useEffect(() => {
    if (username.length < 3) {
      setStatus(null);
      return;
    }
    
    const checkUser = async () => {
      setStatus('checking');
      try {
        const res = await api.get(`/auth/check-username?username=${username}`);
        setStatus(res.data.data.available ? 'available' : 'taken');
      } catch (err) {
        setStatus('taken');
      }
    };

    const timeoutId = setTimeout(checkUser, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== 'available') return;
    
    setIsLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/google/complete', {
        tempToken: token,
        username
      });
      const data = response.data;
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative font-sans flex items-center justify-center p-4">
      {/* Background Image - Sky with clouds */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=1600&q=80")' }}
      >
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]"></div>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-xl rounded-[32px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
        <h1 className="text-[24px] font-bold text-[#0F1419] mb-2 text-center">Choose your username</h1>
        <p className="text-[14px] text-[#6B7280] text-center mb-6">You're almost there! Pick a unique username to complete registration.</p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 rounded-xl text-[14px] text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <div className={`flex items-center bg-[#F3F4F6] rounded-xl border ${status === 'available' ? 'border-green-500' : status === 'taken' ? 'border-red-500' : 'border-transparent'} transition-colors px-4`}>
              <span className="text-[#9CA3AF]">@</span>
              <input
                type="text"
                placeholder="username"
                className="w-full h-[48px] bg-transparent text-[14px] text-[#0F1419] outline-none px-2"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                required
                minLength={3}
              />
              {status === 'checking' && <div className="w-4 h-4 border-2 border-[#9CA3AF] border-t-transparent rounded-full animate-spin" />}
              {status === 'available' && <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              {status === 'taken' && <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
            </div>
            {status === 'taken' && <p className="text-red-500 text-[12px] mt-1 ml-1">Username is already taken</p>}
            {status === 'available' && <p className="text-green-500 text-[12px] mt-1 ml-1">Username is available!</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || status !== 'available'}
            className="w-full h-[50px] mt-4 bg-gradient-to-b from-[#2D333B] to-[#1E2329] hover:from-[#1E2329] hover:to-[#0F1419] text-white font-medium text-[15px] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupUsername;
