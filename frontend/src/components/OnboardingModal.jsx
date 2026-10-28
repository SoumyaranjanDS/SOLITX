import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  ArrowLeft, 
  X, 
  RefreshCw, 
  AlertCircle,
  Camera,
  Upload,
  Sparkles
} from 'lucide-react';
import { SolitxLogo } from './AppShell';
import api from '../api';
import { getAvatarUrl } from '../utils/avatar';
import { uploadMediaDirectToS3 } from '../utils/mediaUpload';

// Comprehensive mainstream categories matching Twitter / X explore topics
const INTEREST_CATEGORIES = [
  {
    category: 'Entertainment & Pop Culture',
    topics: [
      'Movies & Cinema', 
      'Anime & Manga', 
      'Gaming & Esports', 
      'Music & Concerts', 
      'TV Shows & Series', 
      'Pop Culture', 
      'Streaming', 
      'Marvel & DC', 
      'Comedy & Memes'
    ],
  },
  {
    category: 'Sports & Athletics',
    topics: [
      'Football / Soccer', 
      'NBA & Basketball', 
      'Formula 1', 
      'Cricket', 
      'Champions League', 
      'Combat Sports & MMA', 
      'Tennis', 
      'Gym & Fitness', 
      'NFL'
    ],
  },
  {
    category: 'News & Current Events',
    topics: [
      'World News', 
      'Geopolitics', 
      'Climate & Earth', 
      'Science Discoveries', 
      'Space Exploration', 
      'History', 
      'Philosophy'
    ],
  },
  {
    category: 'Technology & Science',
    topics: [
      'Artificial Intelligence', 
      'Software Engineering', 
      'Tech Startups', 
      'Consumer Gadgets', 
      'Robotics', 
      'Web3 & Crypto', 
      'Cybersecurity', 
      'Open Source'
    ],
  },
  {
    category: 'Business & Finance',
    topics: [
      'Stock Market', 
      'Venture Capital', 
      'Personal Finance', 
      'Real Estate', 
      'Global Economy', 
      'Crypto & Bitcoin', 
      'Indie Hacking', 
      'Entrepreneurship'
    ],
  },
  {
    category: 'Lifestyle, Arts & Culture',
    topics: [
      'Travel & Adventure', 
      'Photography', 
      'UI/UX Design', 
      'Food & Dining', 
      'Fashion & Style', 
      'Books & Literature', 
      'Architecture', 
      'Mindfulness'
    ],
  },
];

const OnboardingModal = ({ isOpen, onComplete }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [step, setStep] = useState(1); // 1: Unique Username, 2: Universal Interests, 3: Who to Follow, 4: Profile Photo & Bio

  // ── Step 1: Unique Username State ──
  const [usernameInput, setUsernameInput] = useState(currentUser?.username || '');
  const [usernameStatus, setUsernameStatus] = useState('available'); // 'checking' | 'available' | 'taken' | 'invalid'
  const [usernameError, setUsernameError] = useState('');
  const [suggestionsList, setSuggestionsList] = useState([]);
  const checkTimeoutRef = useRef(null);

  // ── Step 2: Interests State ──
  const [selectedTopics, setSelectedTopics] = useState(
    new Set(['Movies & Cinema', 'Artificial Intelligence', 'Football / Soccer'])
  );

  // ── Step 3: Follows State ──
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [followedUsernames, setFollowedUsernames] = useState(new Set());

  // ── Step 4: Profile Photo & Bio State ──
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [avatarUploadError, setAvatarUploadError] = useState('');
  const [bioInput, setBioInput] = useState(currentUser?.bio || '');
  const [isFinishing, setIsFinishing] = useState(false);
  const fileInputRef = useRef(null);

  // Generate clean Twitter-style username alternatives when taken
  const generateSuggestions = (base) => {
    const clean = base.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10) || 'user';
    const rand1 = Math.floor(10 + Math.random() * 89);
    const rand2 = Math.floor(100 + Math.random() * 899);
    return [`${clean}_${rand1}`, `${clean}${rand2}`, `the_${clean}`, `${clean}_official`];
  };

  // Synchronize with fresh user data when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const freshUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (freshUser?.username && (!usernameInput || usernameInput === 'solitx_user')) {
          setUsernameInput(freshUser.username);
        }
        if (freshUser?.avatar_url && !avatarUrl) {
          setAvatarUrl(freshUser.avatar_url);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen]);

  // Debounced Username Availability Check
  useEffect(() => {
    if (step !== 1) return;

    const trimmed = usernameInput.trim().toLowerCase();
    const activeUsername = JSON.parse(localStorage.getItem('user') || '{}')?.username?.toLowerCase();

    // If matches user's current username, it's valid
    if (trimmed && (trimmed === currentUser?.username?.toLowerCase() || trimmed === activeUsername)) {
      setUsernameStatus('available');
      setUsernameError('');
      setSuggestionsList([]);
      return;
    }

    if (!trimmed) {
      setUsernameStatus('invalid');
      setUsernameError('Please enter a username');
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameError('3-20 characters (letters, numbers, or underscores only)');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(trimmed)}`);
        if (res.data?.data?.available) {
          setUsernameStatus('available');
          setUsernameError('');
          setSuggestionsList([]);
        } else {
          setUsernameStatus('taken');
          setUsernameError('That username has already been taken. Pick one below or try another:');
          setSuggestionsList(generateSuggestions(trimmed));
        }
      } catch (err) {
        setUsernameStatus('available');
      }
    }, 350);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [usernameInput, step, currentUser?.username]);

  // Load Who to Follow on Step 3
  useEffect(() => {
    if (isOpen && step === 3) {
      setLoadingSuggestions(true);
      api.get('/users/suggestions')
        .then((res) => {
          setSuggestedUsers(res.data?.data?.users || []);
        })
        .catch(() => {})
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  // Toggle Topic selection
  const handleToggleTopic = (topic) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  // Toggle Follow
  const handleToggleFollow = async (targetUsername) => {
    try {
      const res = await api.post(`/users/${targetUsername}/follow`);
      const isNowFollowing = res.data?.data?.isFollowing;
      setFollowedUsernames((prev) => {
        const next = new Set(prev);
        if (isNowFollowing) next.add(targetUsername);
        else next.delete(targetUsername);
        return next;
      });
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  // Direct Profile Photo Upload for Onboarding
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      setAvatarUploadProgress(0);
      setAvatarUploadError('');

      const { publicUrl, urlFeed } = await uploadMediaDirectToS3(file, (percent) => {
        setAvatarUploadProgress(percent);
      }, { entityType: 'avatar' });

      setAvatarUrl(urlFeed || publicUrl);
    } catch (err) {
      setAvatarUploadError(err.message || 'Failed to upload profile photo');
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // Finish Onboarding & Save
  const handleFinishOnboarding = async () => {
    try {
      setIsFinishing(true);
      const cleanUsername = usernameInput.trim().toLowerCase();
      const freshUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentParamUsername = freshUser?.username || currentUser?.username;

      const payload = {
        bio: bioInput.trim(),
        avatar_url: avatarUrl ? avatarUrl.trim() : null,
        newUsername: cleanUsername && cleanUsername !== currentParamUsername ? cleanUsername : undefined,
      };

      if (currentParamUsername) {
        const res = await api.put(`/users/${currentParamUsername}`, payload);
        if (res.data?.data?.user) {
          const updatedUser = res.data.data.user;
          localStorage.setItem('user', JSON.stringify(updatedUser));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser }));
        }
      }
    } catch (err) {
      console.warn('Finish onboarding error:', err);
    } finally {
      setIsFinishing(false);
      localStorage.removeItem('show_onboarding');
      localStorage.setItem('onboarding_completed', 'true');
      if (onComplete) onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[4px] animate-in fade-in duration-150">
      <div 
        className="bg-white w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-[590px] sm:rounded-[22px] shadow-[0_24px_64px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col border border-[#EFF3F4]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="h-14 px-5 border-b border-[#EFF3F4] flex items-center justify-between flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="w-9 h-9 rounded-full hover:bg-[#EFF3F4] flex items-center justify-center text-[#0F1419] transition-colors"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>

          {/* Centered SOLITX Logo */}
          <div className="flex items-center justify-center">
            <SolitxLogo size={24} />
          </div>

          {/* Right Step Counter / Skip */}
          <div className="flex items-center gap-3 w-20 justify-end">
            <span className="text-[13px] font-bold text-[#536471]">
              {step}/4
            </span>
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="text-[13px] text-[#536471] hover:text-[#0F1419] font-medium transition-colors"
            >
              Skip
            </button>
          </div>
        </div>

        {/* Twitter-style thin progress line */}
        <div className="w-full bg-[#EFF3F4] h-[3px] flex-shrink-0">
          <div 
            className="bg-[#0F1419] h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {/* ══════════════ STEP 1: CHOOSE UNIQUE USERNAME ══════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[26px] sm:text-[30px] font-black text-[#0F1419] tracking-tight leading-snug">
                  What should we call you?
                </h2>
                <p className="text-[15px] text-[#536471] mt-1.5 leading-relaxed">
                  Your @username is unique to you on SOLITX. You can always change it later in settings.
                </p>
              </div>

              {/* Twitter Signature Input Box */}
              <div className="space-y-2 pt-2">
                <div 
                  className={`relative rounded-[14px] border-2 transition-all p-3.5 flex items-center bg-white ${
                    usernameStatus === 'available'
                      ? 'border-[#00BA7C] focus-within:ring-2 focus-within:ring-[#00BA7C]/15'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'border-[#F4212E] focus-within:ring-2 focus-within:ring-[#F4212E]/15'
                      : 'border-[#CFD9DE] focus-within:border-[#1D9BF0]'
                  }`}
                >
                  <span className="text-[18px] font-black text-[#536471] select-none mr-1.5">@</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                    placeholder="yourhandle"
                    maxLength={20}
                    autoFocus
                    className="w-full bg-transparent text-[17px] font-bold text-[#0F1419] outline-none placeholder:text-[#9CA3AF]"
                  />

                  {/* Indicator Icon */}
                  <div className="flex-shrink-0 ml-2">
                    {usernameStatus === 'checking' && (
                      <div className="w-5 h-5 border-2 border-[#536471] border-t-transparent rounded-full animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <div className="w-6 h-6 rounded-full bg-[#00BA7C]/10 text-[#00BA7C] flex items-center justify-center">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                      <div className="w-6 h-6 rounded-full bg-[#F4212E]/10 text-[#F4212E] flex items-center justify-center">
                        <AlertCircle size={15} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Validation Feedback */}
                {usernameStatus === 'available' && (
                  <p className="text-[13px] text-[#00BA7C] font-bold flex items-center gap-1.5 ml-1 pt-1">
                    <Check size={14} strokeWidth={3} />
                    <span>@{usernameInput} is available!</span>
                  </p>
                )}
                {usernameError && (
                  <p className="text-[13px] text-[#F4212E] font-medium ml-1 pt-1">
                    {usernameError}
                  </p>
                )}
              </div>

              {/* Suggestions Pills if taken */}
              {suggestionsList.length > 0 && (
                <div className="pt-3">
                  <p className="text-[13px] text-[#536471] font-bold uppercase tracking-wider mb-2.5">
                    Suggested alternatives:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestionsList.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setUsernameInput(sug)}
                        className="px-3.5 py-1.5 bg-[#F7F9F9] hover:bg-[#EFF3F4] text-[#0F1419] font-bold text-[13px] rounded-full border border-[#CFD9DE] transition-colors active:scale-95"
                      >
                        @{sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ STEP 2: UNIVERSAL INTERESTS (ALL DOMAINS) ══════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[26px] sm:text-[30px] font-black text-[#0F1419] tracking-tight leading-snug">
                  What do you want to see on SOLITX?
                </h2>
                <p className="text-[15px] text-[#536471] mt-1.5 leading-relaxed">
                  Select at least 3 topics to customize your Home timeline and explore recommendations.
                </p>
              </div>

              {/* Status Counter Pill */}
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-bold px-3.5 py-1 rounded-full transition-colors ${
                  selectedTopics.size >= 3
                    ? 'bg-[#0F1419] text-white'
                    : 'bg-[#EFF3F4] text-[#536471]'
                }`}>
                  {selectedTopics.size >= 3 
                    ? `✓ ${selectedTopics.size} selected` 
                    : `${selectedTopics.size}/3 selected (${3 - selectedTopics.size} more required)`}
                </span>
              </div>

              {/* Categories and Clean Pills */}
              <div className="space-y-6 pt-1">
                {INTEREST_CATEGORIES.map((catGroup) => (
                  <div key={catGroup.category} className="space-y-2.5">
                    <h3 className="text-[12px] font-black text-[#536471] uppercase tracking-wider">
                      {catGroup.category}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {catGroup.topics.map((topic) => {
                        const isSelected = selectedTopics.has(topic);
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => handleToggleTopic(topic)}
                            className={`px-4 py-2.5 rounded-full text-[14px] font-bold transition-all select-none active:scale-95 ${
                              isSelected
                                ? 'bg-[#0F1419] text-white border border-[#0F1419] shadow-sm'
                                : 'bg-white hover:bg-[#F7F9F9] text-[#0F1419] border border-[#CFD9DE]'
                            }`}
                          >
                            {isSelected ? `✓ ${topic}` : topic}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════ STEP 3: WHO TO FOLLOW ══════════════ */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[26px] sm:text-[30px] font-black text-[#0F1419] tracking-tight leading-snug">
                  Suggested accounts for you
                </h2>
                <p className="text-[15px] text-[#536471] mt-1.5 leading-relaxed">
                  When you follow accounts, you'll see their posts and conversations in your Home timeline.
                </p>
              </div>

              {loadingSuggestions ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse p-2">
                      <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/3" />
                        <div className="h-3 bg-gray-200 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : suggestedUsers.length === 0 ? (
                <div className="text-center py-12 text-[#536471]">
                  <p className="text-[16px] font-bold text-[#0F1419]">No suggested accounts yet</p>
                  <p className="text-[14px] mt-1">You'll discover great people as more creators join.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#EFF3F4] max-h-[360px] overflow-y-auto pr-1">
                  {suggestedUsers.map((u) => {
                    const isFollowed = followedUsernames.has(u.username);
                    return (
                      <div key={u.id || u.username} className="py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-100">
                            <img
                              src={getAvatarUrl(u)}
                              alt={u.username}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-[15px] text-[#0F1419] truncate leading-tight">
                              {u.username}
                            </h4>
                            <p className="text-[13px] text-[#536471] truncate">
                              @{u.username}
                            </p>
                            {u.bio && (
                              <p className="text-[13px] text-[#0F1419] truncate mt-0.5 max-w-[280px]">
                                {u.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFollow(u.username)}
                          className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all flex-shrink-0 ${
                            isFollowed
                              ? 'border border-[#CFD9DE] hover:border-[#F4212E] hover:text-[#F4212E] hover:bg-red-50 text-[#0F1419]'
                              : 'bg-[#0F1419] hover:bg-[#272C30] text-white shadow-sm'
                          }`}
                        >
                          {isFollowed ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════ STEP 4: PROFILE PICTURE & BIO SETUP ══════════════ */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[26px] sm:text-[30px] font-black text-[#0F1419] tracking-tight leading-snug">
                  Add a profile picture
                </h2>
                <p className="text-[15px] text-[#536471] mt-1.5 leading-relaxed">
                  Upload a photo so people recognize you on SOLITX. You can also change this anytime from your profile.
                </p>
              </div>

              {/* Profile Photo Uploader Card */}
              <div className="p-6 bg-[#F7F9F9] rounded-2xl border border-[#EFF3F4] flex flex-col items-center justify-center text-center">
                <div className="relative group/avatar cursor-pointer mb-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-full bg-white overflow-hidden shadow-md border-2 border-[#CFD9DE] relative group hover:border-[#7C3AED] transition-all"
                  >
                    <img
                      src={avatarUrl ? avatarUrl : getAvatarUrl(usernameInput || currentUser?.username)}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />

                    {/* Hover Upload Overlay */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={24} />
                      <span className="text-[10px] font-bold mt-1">Upload</span>
                    </div>

                    {/* Live Uploading Progress Overlay */}
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                        <div className="w-6 h-6 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin mb-1" />
                        <span className="text-[11px] font-bold">{avatarUploadProgress}%</span>
                      </div>
                    )}
                  </div>

                  {/* Camera Badge Icon */}
                  {!isUploadingAvatar && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full shadow-md transition-transform active:scale-95"
                      title="Upload photo"
                    >
                      <Camera size={14} />
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                />

                <div className="font-extrabold text-[16px] text-[#0F1419]">
                  @{usernameInput || currentUser?.username}
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-4 py-1.5 text-[13px] font-bold bg-[#0F1419] hover:bg-[#272C30] text-white rounded-full transition-all shadow-sm active:scale-95"
                  >
                    {avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="px-3 py-1.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {avatarUploadError && (
                  <p className="text-[12px] text-red-500 font-medium mt-2">
                    {avatarUploadError}
                  </p>
                )}
              </div>

              {/* Bio Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[12px] font-black text-[#536471] uppercase tracking-wider">
                    Bio
                  </label>
                  <span className="text-[12px] text-[#536471]">
                    {bioInput.length}/160
                  </span>
                </div>
                <textarea
                  placeholder="What's your story? Add a short bio to introduce yourself..."
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  maxLength={160}
                  rows={3}
                  className="w-full p-3.5 text-[15px] border border-[#CFD9DE] focus:border-[#1D9BF0] rounded-2xl resize-none outline-none leading-relaxed text-[#0F1419] placeholder:text-[#9CA3AF] transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="p-4 pb-6 sm:pb-4 sm:px-6 sm:py-4 border-t border-[#EFF3F4] flex items-center justify-between flex-shrink-0 bg-white">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-5 py-2.5 text-[14px] font-bold text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors border border-[#CFD9DE]"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && usernameStatus !== 'available') ||
                (step === 2 && selectedTopics.size < 3)
              }
              className="px-7 py-2.5 bg-[#0F1419] hover:bg-[#272C30] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[15px] rounded-full transition-all shadow-sm active:scale-98"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              disabled={isFinishing}
              className="px-8 py-2.5 bg-[#0F1419] hover:bg-[#272C30] disabled:opacity-50 text-white font-bold text-[15px] rounded-full transition-all shadow-md active:scale-98 flex items-center gap-2"
            >
              {isFinishing ? 'Saving...' : 'Get Started'}
              <Check size={16} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
