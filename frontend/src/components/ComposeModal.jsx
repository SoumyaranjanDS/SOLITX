import React, { useState, useEffect, useRef } from 'react';
import { X, ImageIcon, Smile, Calendar, MapPin, Globe, Users, ChevronDown, Check, Loader2, AtSign } from 'lucide-react';
import api from '../api';
import { uploadMediaDirectToS3 } from '../utils/mediaUpload';
import { getAvatarUrl } from '../utils/avatar';
import MentionDropdown, { useMentionAutocomplete } from './MentionAutocomplete';

const ComposeModal = ({ isOpen, onClose, onPostCreated, defaultCommunityId = null }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Media Upload State
  const fileInputRef = useRef(null);
  const [mediaState, setMediaState] = useState(null);

  // @Mention Autocomplete State
  const textareaRef = useRef(null);
  const {
    mentionState,
    suggestions,
    loading: mentionLoading,
    selectedIndex,
    checkMentionTrigger,
    selectUser,
    handleKeyDown: handleMentionKeyDown,
    triggerMention,
  } = useMentionAutocomplete({ text: content, setText: setContent, textareaRef });

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
      if (mediaState?.previewUrl) {
        URL.revokeObjectURL(mediaState.previewUrl);
      }
      setMediaState(null);
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

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setMediaState({
      file,
      previewUrl,
      mediaId: null,
      status: 'uploading',
      progress: 0,
      error: null,
    });
    setError('');

    try {
      const { mediaId } = await uploadMediaDirectToS3(file, (percent) => {
        setMediaState((prev) => (prev ? { ...prev, progress: percent } : null));
      });
      setMediaState((prev) => (prev ? { ...prev, mediaId, status: 'ready', progress: 100 } : null));
    } catch (err) {
      setMediaState((prev) => (prev ? { ...prev, status: 'error', error: err.message } : null));
      setError(err.message || 'Image upload failed');
    }
  };

  const handleRemoveMedia = () => {
    if (mediaState?.previewUrl) {
      URL.revokeObjectURL(mediaState.previewUrl);
    }
    setMediaState(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || (!content.trim() && !mediaState?.mediaId)) return;
    if (mediaState && mediaState.status === 'uploading') return;

    try {
      setIsSubmitting(true);
      setError('');
      const payload = { 
        content: content.trim(),
        community_id: selectedCommunityId || undefined,
        media_ids: mediaState?.mediaId ? [mediaState.mediaId] : undefined,
      };
      const res = await api.post('/posts', payload);
      if (res.data?.data?.post) {
        if (onPostCreated) onPostCreated(res.data.data.post);
        window.dispatchEvent(new CustomEvent('post-created', { detail: res.data.data.post }));
        handleRemoveMedia();
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
            disabled={(!content.trim() && !mediaState?.mediaId) || isSubmitting || content.length > 500 || mediaState?.status === 'uploading'}
            className="px-5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-[14px] rounded-full transition-all shadow-sm flex items-center gap-2"
          >
            {isSubmitting ? 'Posting...' : mediaState?.status === 'uploading' ? 'Uploading...' : 'Post'}
          </button>
        </div>

        {/* Composer Body */}
        <div className="p-4 flex gap-3 flex-1 overflow-y-auto">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            <img
              src={getAvatarUrl(currentUser)}
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

            <div className="relative">
              <textarea
                ref={textareaRef}
                autoFocus
                placeholder={activeCommunity ? `Post in c/${activeCommunity.slug}...` : "What is happening?!"}
                className="w-full text-[18px] text-[#0F1419] placeholder:text-[#536471] border-none focus:ring-0 resize-none outline-none leading-relaxed min-h-[110px]"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setTimeout(checkMentionTrigger, 0);
                }}
                onKeyUp={checkMentionTrigger}
                onClick={checkMentionTrigger}
                onKeyDown={(e) => {
                  handleMentionKeyDown(e);
                }}
                maxLength={500}
              />
              <MentionDropdown
                mentionState={mentionState}
                suggestions={suggestions}
                loading={mentionLoading}
                selectedIndex={selectedIndex}
                onSelect={selectUser}
                className="top-full left-0 mt-1"
              />
            </div>

            {/* Media Image Preview Container */}
            {mediaState && (
              <div className="relative mt-2 mb-3 rounded-2xl overflow-hidden border border-[#EFF3F4] bg-[#0F1419]/5 max-h-[260px] flex items-center justify-center group/img">
                <img
                  src={mediaState.previewUrl}
                  alt="Upload preview"
                  className="w-full h-full max-h-[260px] object-cover"
                />

                {/* Remove Image Button */}
                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full backdrop-blur-md transition-all shadow-md active:scale-95"
                  title="Remove image"
                >
                  <X size={16} />
                </button>

                {/* Uploading progress overlay */}
                {mediaState.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-md flex flex-col items-center justify-center text-white px-6 transition-all duration-200">
                    <div className="relative mb-3 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin" />
                      <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-ping opacity-30" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[14px] font-bold text-white tracking-wide">
                      <span>Uploading</span>
                      <span className="flex tracking-widest animate-pulse">...</span>
                      <span className="text-[12px] font-semibold text-violet-300 ml-1 tabular-nums">
                        {mediaState.progress}%
                      </span>
                    </div>
                    <div className="w-48 h-1.5 bg-white/15 rounded-full mt-3 overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-200 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                        style={{ width: `${mediaState.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Ready Badge */}
                {mediaState.status === 'ready' && (
                  <div className="absolute bottom-2.5 left-2.5 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold rounded-full flex items-center gap-1.5 shadow-md border border-white/10">
                    <Check size={12} className="text-emerald-400 stroke-[3]" />
                    <span>Photo attached</span>
                  </div>
                )}

                {/* Error State */}
                {mediaState.status === 'error' && (
                  <div className="absolute inset-0 bg-red-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-white px-4 text-center">
                    <p className="text-[13px] font-bold text-red-200 mb-2">
                      {mediaState.error || 'Upload failed'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="px-3.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-full text-[12px] font-semibold transition-colors"
                    >
                      Remove & Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-red-500 text-[13px] font-medium mt-1 mb-2">
                {error}
              </p>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Footer Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#EFF3F4] mt-auto">
              <div className="flex items-center gap-1 text-[#7C3AED]">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mediaState?.status === 'uploading'}
                  className="p-2 rounded-full hover:bg-[#7C3AED]/10 disabled:opacity-40 transition-colors"
                  title="Add photos"
                >
                  <ImageIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={triggerMention}
                  className="p-2 rounded-full hover:bg-[#7C3AED]/10 transition-colors"
                  title="Mention a developer (@)"
                >
                  <AtSign size={18} />
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
