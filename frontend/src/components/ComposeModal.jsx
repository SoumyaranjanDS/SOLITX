import React, { useState, useEffect } from 'react';
import { X, ImageIcon, Smile, Calendar, MapPin, Globe, Users, ChevronDown, Check } from 'lucide-react';
import api from '../api';

const ComposeModal = ({ isOpen, onClose, onPostCreated, defaultCommunityId = null }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Community Audience selector
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(defaultCommunityId || '');
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setError('');
      setShowAudienceMenu(false);
      setSelectedCommunityId(defaultCommunityId || '');
    } else {
      // Fetch available communities that user has joined or created
      api.get('/communities')
        .then((res) => {
          const allComm = res.data?.data?.communities || [];
          setCommunities(allComm.filter((c) => c.is_joined || c.is_creator));
        })
        .catch(() => {});
    }
  }, [isOpen, defaultCommunityId]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError('');
      const payload = { 
        content: content.trim(),
        community_id: selectedCommunityId || undefined
      };
      const res = await api.post('/posts', payload);
      if (res.data?.data?.post) {
        if (onPostCreated) onPostCreated(res.data.data.post);
        window.dispatchEvent(new CustomEvent('post-created', { detail: res.data.data.post }));
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const charLeft = 500 - content.length;
  const activeCommunity = communities.find((c) => c.id === selectedCommunityId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-w-[550px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#EFF3F4]">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting || content.length > 500}
            className="px-5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-full transition-all shadow-sm"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Composer Body */}
        <div className="p-4 flex gap-3 flex-1 overflow-y-auto">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username}`}
              alt="me"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col">
            
            {/* Audience Picker */}
            <div className="relative mb-2">
              <button
                type="button"
                onClick={() => setShowAudienceMenu(!showAudienceMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold border border-[#CFD9DE] hover:bg-[#EFF3F4] text-[#7C3AED] transition-colors"
              >
                {activeCommunity ? (
                  <>
                    <Users size={14} className="text-[#7C3AED]" />
                    <span>c/{activeCommunity.slug}</span>
                  </>
                ) : (
                  <>
                    <Globe size={14} className="text-[#7C3AED]" />
                    <span>Everyone</span>
                  </>
                )}
                <ChevronDown size={14} />
              </button>

              {showAudienceMenu && (
                <div className="absolute left-0 top-9 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#536471] uppercase tracking-wider">
                    Choose Audience
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCommunityId('');
                      setShowAudienceMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-[14px] font-medium flex items-center justify-between hover:bg-[#F7F9F9] transition-colors ${
                      !selectedCommunityId ? 'text-[#7C3AED] font-bold' : 'text-[#0F1419]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-[#536471]" />
                      <span>Everyone (Public)</span>
                    </div>
                    {!selectedCommunityId && <Check size={16} />}
                  </button>

                  {communities.length > 0 && (
                    <div className="border-t border-[#EFF3F4] my-1" />
                  )}

                  {communities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCommunityId(c.id);
                        setShowAudienceMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-[14px] font-medium flex items-center justify-between hover:bg-[#F7F9F9] transition-colors ${
                        selectedCommunityId === c.id ? 'text-[#7C3AED] font-bold' : 'text-[#0F1419]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Users size={16} className="text-[#7C3AED] flex-shrink-0" />
                        <span className="truncate">c/{c.slug}</span>
                      </div>
                      {selectedCommunityId === c.id && <Check size={16} className="flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              autoFocus
              placeholder={activeCommunity ? `Post in c/${activeCommunity.slug}...` : "What is happening?!"}
              className="w-full text-[18px] text-[#0F1419] placeholder:text-[#536471] border-none focus:ring-0 resize-none outline-none leading-relaxed min-h-[140px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
            />

            {error && (
              <p className="text-red-500 text-[13px] font-medium mt-1 mb-2">
                {error}
              </p>
            )}

            {/* Footer Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#EFF3F4] mt-auto">
              <div className="flex items-center gap-1 text-[#7C3AED]">
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors">
                  <ImageIcon size={18} />
                </button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors">
                  <Smile size={18} />
                </button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors">
                  <Calendar size={18} />
                </button>
                <button type="button" className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors">
                  <MapPin size={18} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[13px] font-medium ${charLeft < 20 ? 'text-red-500 font-bold' : 'text-[#536471]'}`}>
                  {charLeft}
                </span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center border-2"
                  style={{
                    borderColor: charLeft < 0 ? '#EF4444' : charLeft < 50 ? '#F59E0B' : '#7C3AED',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
