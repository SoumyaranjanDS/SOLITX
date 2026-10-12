import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Star, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Edit3, 
  Eye, 
  Award,
  ArrowRight
} from 'lucide-react';
import AppShell from '../components/AppShell';

const Premium = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [billingCycle, setBillingCycle] = useState('annual'); // 'annual' | 'monthly'
  const [isSubscribed, setIsSubscribed] = useState(Boolean(currentUser?.is_premium));
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);

  const handleSubscribe = (tierName) => {
    // Grant verified badge locally
    const updatedUser = {
      ...currentUser,
      is_premium: true,
      tier: tierName,
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setIsSubscribed(true);
    setShowCelebrationModal(true);
  };

  return (
    <AppShell rightSidebar={true}>
      <div className="min-h-screen bg-white">
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 border-b border-[#EFF3F4] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-black text-[#0F1419]">SOLITX Premium</h1>
            <span className="bg-[#7C3AED]/15 text-[#7C3AED] text-[12px] font-extrabold px-2 py-0.5 rounded-full">
              PRO
            </span>
          </div>
          {isSubscribed && (
            <span className="inline-flex items-center gap-1 text-[13px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <Check size={15} /> Active Subscriber
            </span>
          )}
        </div>

        {/* Hero Section */}
        <div className="p-6 sm:p-8 text-center bg-gradient-to-b from-[#7C3AED]/10 via-purple-50/50 to-white border-b border-[#EFF3F4]">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#7C3AED] to-purple-500 rounded-3xl flex items-center justify-center text-white mx-auto shadow-lg shadow-purple-500/25 mb-4">
            <Star size={32} fill="white" />
          </div>
          <h2 className="text-[26px] sm:text-[32px] font-black text-[#0F1419] tracking-tight">
            Upgrade your experience.
          </h2>
          <p className="text-[#536471] text-[15px] sm:text-[16px] max-w-md mx-auto mt-2 leading-relaxed">
            Gain verified status, unlock creator tools, enjoy prioritized ranking, and support independent developer engineering.
          </p>

          {/* Billing Switcher */}
          <div className="inline-flex items-center bg-[#EFF3F4] p-1 rounded-full mt-6 text-[14px] font-bold">
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                billingCycle === 'annual'
                  ? 'bg-white text-[#0F1419] shadow-sm'
                  : 'text-[#536471] hover:text-[#0F1419]'
              }`}
            >
              Annual <span className="text-[#7C3AED] font-extrabold ml-1">SAVE 12%</span>
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-[#0F1419] shadow-sm'
                  : 'text-[#536471] hover:text-[#0F1419]'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Pricing Tiers Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Basic Tier */}
          <div className="border border-[#EFF3F4] rounded-2xl p-5 hover:border-[#CFD9DE] transition-all flex flex-col">
            <h3 className="font-extrabold text-[18px] text-[#0F1419]">Basic</h3>
            <p className="text-[13px] text-[#536471] mt-0.5">Essential tools for active readers</p>
            <div className="my-4">
              <span className="text-[28px] font-black text-[#0F1419]">
                {billingCycle === 'annual' ? '$2.80' : '$3.20'}
              </span>
              <span className="text-[14px] text-[#536471]"> / month</span>
            </div>
            <ul className="space-y-2.5 text-[14px] text-[#536471] mb-6 flex-1">
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Edit posts within 1 hour</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Bookmark folders</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Longer text (up to 1,000 chars)</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe('Basic')}
              className="w-full py-2.5 rounded-full border border-[#CFD9DE] hover:bg-gray-50 text-[#0F1419] font-bold text-[14px] transition-colors"
            >
              Select Basic
            </button>
          </div>

          {/* Premium Tier (Featured) */}
          <div className="border-2 border-[#7C3AED] rounded-2xl p-5 relative shadow-lg shadow-purple-500/10 flex flex-col bg-purple-50/20">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7C3AED] text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
              Most Popular
            </span>
            <h3 className="font-extrabold text-[18px] text-[#0F1419] flex items-center gap-1.5">
              Premium
              <ShieldCheck size={18} className="text-[#7C3AED]" />
            </h3>
            <p className="text-[13px] text-[#536471] mt-0.5">Verified creator toolkit</p>
            <div className="my-4">
              <span className="text-[28px] font-black text-[#0F1419]">
                {billingCycle === 'annual' ? '$7.00' : '$8.00'}
              </span>
              <span className="text-[14px] text-[#536471]"> / month</span>
            </div>
            <ul className="space-y-2.5 text-[14px] text-[#0F1419] mb-6 flex-1">
              <li className="flex items-center gap-2">
                <Check size={16} className="text-[#7C3AED] flex-shrink-0" />
                <span className="font-semibold">Verified Blue Checkmark badge</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-[#7C3AED] flex-shrink-0" />
                <span>Prioritized reply & search ranking</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-[#7C3AED] flex-shrink-0" />
                <span>Analytics studio & view insights</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-[#7C3AED] flex-shrink-0" />
                <span>Post up to 4,000 characters</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-[#7C3AED] flex-shrink-0" />
                <span>50% fewer ads</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe('Premium')}
              className="w-full py-2.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[14px] shadow-sm transition-all active:scale-98"
            >
              {isSubscribed ? 'Subscribed' : 'Subscribe & Get Verified'}
            </button>
          </div>

          {/* Premium+ Tier */}
          <div className="border border-[#EFF3F4] rounded-2xl p-5 hover:border-[#CFD9DE] transition-all flex flex-col">
            <h3 className="font-extrabold text-[18px] text-[#0F1419]">Premium+</h3>
            <p className="text-[13px] text-[#536471] mt-0.5">Maximum reach & zero interruptions</p>
            <div className="my-4">
              <span className="text-[28px] font-black text-[#0F1419]">
                {billingCycle === 'annual' ? '$14.00' : '$16.00'}
              </span>
              <span className="text-[14px] text-[#536471]"> / month</span>
            </div>
            <ul className="space-y-2.5 text-[14px] text-[#536471] mb-6 flex-1">
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Everything in Premium</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Fully 100% Ad-Free experience</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Maximum reply algorithmic boost</span>
              </li>
              <li className="flex items-center gap-2">
                <Check size={16} className="text-green-600 flex-shrink-0" />
                <span>Write technical articles with formatting</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe('Premium+')}
              className="w-full py-2.5 rounded-full border border-[#CFD9DE] hover:bg-gray-50 text-[#0F1419] font-bold text-[14px] transition-colors"
            >
              Select Premium+
            </button>
          </div>

        </div>

        {/* Feature Highlights Grid */}
        <div className="p-6 border-t border-[#EFF3F4] bg-[#F7F9F9]/50">
          <h3 className="font-extrabold text-[18px] text-[#0F1419] mb-4 text-center">
            Everything included with SOLITX Premium
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
            <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-[#EFF3F4]">
              <ShieldCheck size={20} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[14px] text-[#0F1419]">Verification Checkmark</p>
                <p className="text-[12px] text-[#536471]">Build trust and identity across the developer network.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-[#EFF3F4]">
              <Eye size={20} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[14px] text-[#0F1419]">Deep Post Analytics</p>
                <p className="text-[12px] text-[#536471]">Track impressions, profile visits, and audience engagement.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-[#EFF3F4]">
              <Edit3 size={20} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[14px] text-[#0F1419]">Post Editing</p>
                <p className="text-[12px] text-[#536471]">Fix typos or update code snippets anytime after posting.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-[#EFF3F4]">
              <TrendingUp size={20} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[14px] text-[#0F1419]">Prioritized Replies</p>
                <p className="text-[12px] text-[#536471]">Your technical insights stay right at the top of conversations.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration Modal */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-[360px] p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-purple-100 text-[#7C3AED] rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldCheck size={36} />
            </div>
            <h3 className="font-black text-[22px] text-[#0F1419]">Welcome to Premium!</h3>
            <p className="text-[14px] text-[#536471] mt-2 mb-6 leading-relaxed">
              You are now verified on SOLITX. Your profile and posts will display the verified badge and enjoy prioritized rankings.
            </p>
            <button
              onClick={() => {
                setShowCelebrationModal(false);
                navigate(`/profile/${currentUser.username}`);
              }}
              className="w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[15px] rounded-full shadow-md transition-all"
            >
              View My Verified Profile
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Premium;
