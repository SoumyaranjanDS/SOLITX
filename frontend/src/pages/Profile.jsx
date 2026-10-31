import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Link as LinkIcon,
  Calendar,
  Edit3,
  X,
  Check,
  Globe,
  AtSign,
  User as UserIcon,
  AlertCircle,
  MessageCircle,
  Heart,
  Image as ImageIcon,
  FileText,
  Trash2,
  Camera,
  Loader2,
  ZoomIn
} from 'lucide-react';
import AppShell from '../components/AppShell';
import PostCard, { formatRelativeTime } from '../components/PostCard';
import api from '../api';
import { uploadMediaDirectToS3 } from '../utils/mediaUpload';
import { getAvatarUrl } from '../utils/avatar';
import ImageCropModal from '../components/ImageCropModal';
import MentionText from '../components/MentionText';

const TABS = ['Posts', 'Replies', 'Media', 'Likes'];

// ── Profile Reply Card for Replies Tab ──
const ProfileReplyCard = ({ reply, onNavigate }) => {
  const [hasLiked, setHasLiked] = useState(Boolean(reply.has_liked));
  const [likesCount, setLikesCount] = useState(parseInt(reply.likes_count, 10) || 0);

  const handleLike = async (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
      onNavigate('/auth');
      return;
    }
    const prevLiked = hasLiked;
    setHasLiked(!prevLiked);
    setLikesCount(prev => prevLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      const res = await api.post(`/posts/comments/${reply.id}/like`);
      if (res.data?.data) {
        setHasLiked(res.data.data.hasLiked);
        setLikesCount(res.data.data.likesCount);
      }
    } catch {
      setHasLiked(prevLiked);
      setLikesCount(prev => prevLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  return (
    <article
      onClick={() => onNavigate(`/post/${reply.post_id}`)}
      className="p-4 hover:bg-[#F7F9F9]/60 transition-colors border-b border-[#EFF3F4] cursor-pointer"
    >
      {/* Replying to indicator */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#536471] mb-2 -mt-0.5">
        <MessageCircle size={14} className="text-[#536471]" />
        <span>Replying to</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/profile/${reply.parent_post_author_username}`);
          }}
          className="text-[#1D9BF0] font-semibold hover:underline"
        >
          @{reply.parent_post_author_username}
        </button>
      </div>

      <div className="flex gap-3">
        {/* Author Avatar */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/profile/${reply.username}`);
          }}
          className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src={getAvatarUrl(reply)}
            alt={reply.username}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Reply Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap text-[14px] sm:text-[15px]">
            <span className="font-bold text-[#0F1419]">{reply.author_name || reply.username}</span>
            <span className="text-[#536471]">@{reply.username}</span>
            <span className="text-[#536471]">·</span>
            <span className="text-[#536471] text-[13px]">{formatRelativeTime(reply.created_at)}</span>
          </div>

          {/* Original Post Quoted Preview */}
          {reply.parent_post_content && (
            <div className="mt-1.5 px-3 py-2 bg-[#F7F9F9] rounded-xl border border-[#EFF3F4] text-[13px] text-[#536471] line-clamp-2">
              <span className="font-semibold text-[#0F1419]">@{reply.parent_post_author_username}: </span>
              {reply.parent_post_content}
            </div>
          )}

          {/* Reply Content */}
          <p className="text-[14px] sm:text-[15px] text-[#0F1419] mt-2 leading-[1.5] whitespace-pre-wrap break-words">
            <MentionText text={reply.content} />
          </p>

          {/* Action Row */}
          <div className="flex items-center gap-6 mt-3 text-[#536471] -ml-2">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 p-1.5 rounded-full transition-colors group/like ${hasLiked ? 'text-[#F91880]' : 'hover:bg-[#F91880]/10 hover:text-[#F91880]'
                }`}
            >
              <Heart
                size={16}
                strokeWidth={1.8}
                className={hasLiked ? 'fill-[#F91880] text-[#F91880]' : 'group-hover/like:text-[#F91880]'}
              />
              <span className="text-[12px]">{likesCount}</span>
            </button>

            <div className="flex items-center gap-1.5 text-[12px] text-[#536471]">
              <MessageCircle size={15} />
              <span>{reply.replies_count || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const [activeTab, setActiveTab] = useState('Posts');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabData, setTabData] = useState({
    posts: null,
    replies: null,
    media: null,
    likes: null,
  });

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editBioLink, setEditBioLink] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Upload States (Direct page upload)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState(0);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [isRemovingBanner, setIsRemovingBanner] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  // Crop & Resize Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCropSrc, setImageToCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState('direct'); // 'direct' | 'modal'

  // Full-Screen Avatar / Banner Viewer Lightbox State
  const [mediaViewer, setMediaViewer] = useState(null); // { src, title, type: 'avatar' | 'banner' }

  // Modal Upload States (Inside Edit Modal)
  const [modalBannerUploading, setModalBannerUploading] = useState(false);
  const [modalBannerProgress, setModalBannerProgress] = useState(0);
  const [modalAvatarUploading, setModalAvatarUploading] = useState(false);
  const [modalAvatarProgress, setModalAvatarProgress] = useState(0);

  // Delete Profile Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Followers / Following Modal State
  const [followModalType, setFollowModalType] = useState(null); // 'followers' | 'following' | null
  const [followListUsers, setFollowListUsers] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwnProfile = currentUser?.username?.toLowerCase() === username?.toLowerCase();

  const displayToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Close media viewer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mediaViewer) {
        setMediaViewer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaViewer]);

  // Fetch Profile Info
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${username}`);
      const apiUser = response.data?.data?.user;
      if (apiUser) {
        setUser({
          name: apiUser.name || apiUser.username,
          username: apiUser.username,
          bio: apiUser.bio || '',
          bio_link: apiUser.bio_link || '',
          avatar_url: apiUser.avatar_url || '',
          banner_url: apiUser.banner_url || '',
          joinDate: new Date(apiUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          following: parseInt(apiUser.following_count, 10) || 0,
          followers: parseInt(apiUser.followers_count, 10) || 0,
        });
        setIsFollowing(Boolean(apiUser.is_following));

        // Pre-fill Edit Modal Fields
        setEditName(apiUser.name || apiUser.username || '');
        setEditUsername(apiUser.username || '');
        setEditBio(apiUser.bio || '');
        setEditBioLink(apiUser.bio_link || '');
        setEditAvatarUrl(apiUser.avatar_url || '');
        setEditBannerUrl(apiUser.banner_url || '');
      }
    } catch {
      setUser({
        name: username,
        username,
        bio: '',
        bio_link: '',
        avatar_url: '',
        banner_url: '',
        joinDate: 'October 2024',
        following: 0,
        followers: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Timeline Items for Current Active Tab (Posts, Replies, Media, Likes)
  const fetchUserTimeline = async (tabToFetch = activeTab, force = false) => {
    const key = tabToFetch.toLowerCase();
    if (!force && tabData[key] !== null && tabData[key] !== undefined) {
      return;
    }
    try {
      setPostsLoading(true);
      const res = await api.get(`/posts/user/${username}?tab=${key}`);
      if (res.data?.data) {
        const items = res.data.data.items || res.data.data.posts || [];
        setTabData(prev => ({ ...prev, [key]: items }));
      }
    } catch (err) {
      console.error(`Failed to fetch user ${tabToFetch}:`, err);
      setTabData(prev => ({ ...prev, [key]: [] }));
    } finally {
      setPostsLoading(false);
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    const key = tab.toLowerCase();
    if (tabData[key] === null || tabData[key] === undefined) {
      fetchUserTimeline(tab);
    }
  };

  // Only run when username changes (NOT on tab change!)
  useEffect(() => {
    if (username) {
      setActiveTab('Posts');
      setTabData({ posts: null, replies: null, media: null, likes: null });
      fetchProfile();
      fetchUserTimeline('Posts', true);
    }
  }, [username]);

  // Toggle Follow
  const handleToggleFollow = async () => {
    if (!currentUser?.username) {
      navigate('/auth');
      return;
    }
    try {
      const prevFollowing = isFollowing;
      setIsFollowing(!prevFollowing);
      setUser(prev => ({
        ...prev,
        followers: prevFollowing ? Math.max(0, prev.followers - 1) : prev.followers + 1
      }));

      const res = await api.post(`/users/${username}/follow`);
      if (res.data?.data) {
        setIsFollowing(res.data.data.isFollowing);
        setUser(prev => ({ ...prev, followers: res.data.data.followers_count }));
      }
    } catch (err) {
      setIsFollowing(!isFollowing);
    }
  };

  // Open Followers or Following List Modal
  const handleOpenFollowModal = async (type) => {
    setFollowModalType(type);
    setFollowListLoading(true);
    setFollowListUsers([]);
    try {
      const res = await api.get(`/users/${username}/${type}`);
      setFollowListUsers(res.data?.data?.users || []);
    } catch (err) {
      console.error(`Failed to fetch ${type}:`, err);
    } finally {
      setFollowListLoading(false);
    }
  };

  const handleSwitchFollowModalTab = (newType) => {
    if (newType !== followModalType) {
      handleOpenFollowModal(newType);
    }
  };

  const handleToggleFollowInModal = async (targetUsername) => {
    if (!currentUser?.username) {
      navigate('/auth');
      return;
    }

    // Optimistically toggle is_following
    setFollowListUsers(prev => prev.map(u => {
      if (u.username === targetUsername) {
        return { ...u, is_following: !u.is_following };
      }
      return u;
    }));

    try {
      const res = await api.post(`/users/${targetUsername}/follow`);
      const isNowFollowing = res.data?.data?.isFollowing;
      setFollowListUsers(prev => prev.map(u => {
        if (u.username === targetUsername) {
          return { ...u, is_following: isNowFollowing };
        }
        return u;
      }));

      if (isOwnProfile) {
        setUser(prev => ({
          ...prev,
          following: isNowFollowing ? prev.following + 1 : Math.max(0, prev.following - 1)
        }));
      }
    } catch (err) {
      setFollowListUsers(prev => prev.map(u => {
        if (u.username === targetUsername) {
          return { ...u, is_following: !u.is_following };
        }
        return u;
      }));
    }
  };

  // Direct Banner Upload (from profile header)
  const handleDirectBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaViewer) setMediaViewer(null);

    try {
      setIsUploadingBanner(true);
      setBannerUploadProgress(0);

      const { publicUrl, urlFull, urlFeed } = await uploadMediaDirectToS3(file, (percent) => {
        setBannerUploadProgress(percent);
      }, { entityType: 'banner' });
      const targetUrl = urlFull || urlFeed || publicUrl;

      // Persist to backend immediately
      const res = await api.put(`/users/${username}`, { banner_url: targetUrl });
      const updatedUser = res.data?.data?.user;

      setUser(prev => ({ ...prev, banner_url: targetUrl }));
      setEditBannerUrl(targetUrl);

      // Update localStorage & trigger event
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedStored = { ...stored, banner_url: targetUrl };
      localStorage.setItem('user', JSON.stringify(updatedStored));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser || updatedStored }));

      displayToast('Banner image updated successfully');
    } catch (err) {
      displayToast(err.message || 'Failed to upload banner');
    } finally {
      setIsUploadingBanner(false);
      setTimeout(() => {
      try { e.target.value = ''; } catch {}
    }, 200);
    }
  };

  // Direct Avatar Selection -> Triggers Crop & Resize Modal
  const handleDirectAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaViewer) setMediaViewer(null);
    const objectUrl = URL.createObjectURL(file);
    setImageToCropSrc(objectUrl);
    setCropTarget('direct');
    setCropModalOpen(true);
    setTimeout(() => {
      try { e.target.value = ''; } catch {}
    }, 200);
  };

  // Crop Completion Handler (Uploads cropped canvas file to S3)
  const handleCropComplete = async (croppedFile) => {
    if (cropTarget === 'direct') {
      try {
        setIsUploadingAvatar(true);
        setAvatarUploadProgress(0);

        const { publicUrl, urlFeed, urlThumb } = await uploadMediaDirectToS3(croppedFile, (percent) => {
          setAvatarUploadProgress(percent);
        }, { entityType: 'avatar' });
        const targetUrl = urlFeed || urlThumb || publicUrl;

        // Persist to backend immediately
        const res = await api.put(`/users/${username}`, { avatar_url: targetUrl });
        const updatedUser = res.data?.data?.user;

        setUser(prev => ({ ...prev, avatar_url: targetUrl }));
        setEditAvatarUrl(targetUrl);

        // Update localStorage & trigger event
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedStored = { ...stored, avatar_url: targetUrl };
        localStorage.setItem('user', JSON.stringify(updatedStored));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser || updatedStored }));

        setCropModalOpen(false);
        setImageToCropSrc(null);
        if (mediaViewer) setMediaViewer(null);

        displayToast('Profile picture updated successfully');
      } catch (err) {
        displayToast(err.message || 'Failed to upload profile picture');
      } finally {
        setIsUploadingAvatar(false);
      }
    } else {
      // Cropped inside Edit Modal
      try {
        setModalAvatarUploading(true);
        setModalAvatarProgress(0);

        const { publicUrl, urlFeed, urlThumb } = await uploadMediaDirectToS3(croppedFile, (pct) => {
          setModalAvatarProgress(pct);
        }, { entityType: 'avatar' });
        const targetUrl = urlFeed || urlThumb || publicUrl;

        setEditAvatarUrl(targetUrl);
        setCropModalOpen(false);
        setImageToCropSrc(null);
      } catch (err) {
        setEditError(err.message || 'Failed to upload profile picture');
      } finally {
        setModalAvatarUploading(false);
      }
    }
  };

  // Direct Banner Removal (Revert to default gradient)
  const handleDirectRemoveBanner = async () => {
    if (!window.confirm('Remove banner image and restore default gradient?')) return;
    try {
      setIsRemovingBanner(true);
      const res = await api.put(`/users/${username}`, { banner_url: null });
      const updatedUser = res.data?.data?.user;

      setUser(prev => ({ ...prev, banner_url: '' }));
      setEditBannerUrl('');

      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedStored = { ...stored, banner_url: null };
      localStorage.setItem('user', JSON.stringify(updatedStored));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser || updatedStored }));

      displayToast('Banner removed. Restored to default.');
    } catch (err) {
      displayToast(err.response?.data?.message || 'Failed to remove banner');
    } finally {
      setIsRemovingBanner(false);
    }
  };

  // Direct Avatar Removal (Revert to default monogram)
  const handleDirectRemoveAvatar = async () => {
    if (!window.confirm('Remove profile photo and restore default avatar?')) return;
    try {
      setIsRemovingAvatar(true);
      const res = await api.put(`/users/${username}`, { avatar_url: null });
      const updatedUser = res.data?.data?.user;

      setUser(prev => ({ ...prev, avatar_url: '' }));
      setEditAvatarUrl('');

      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedStored = { ...stored, avatar_url: null };
      localStorage.setItem('user', JSON.stringify(updatedStored));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser || updatedStored }));

      displayToast('Profile picture removed. Restored to default.');
    } catch (err) {
      displayToast(err.response?.data?.message || 'Failed to remove profile picture');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  // Upload handler inside the Edit Profile Modal
  const handleModalImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaViewer) setMediaViewer(null);

    if (type === 'banner') {
      try {
        setModalBannerUploading(true);
        setModalBannerProgress(0);
        const { publicUrl, urlFull, urlFeed } = await uploadMediaDirectToS3(file, (pct) => setModalBannerProgress(pct), { entityType: 'banner' });
        const targetUrl = urlFull || urlFeed || publicUrl;
        setEditBannerUrl(targetUrl);
      } catch (err) {
        setEditError(err.message || 'Failed to upload banner');
      } finally {
        setModalBannerUploading(false);
        setTimeout(() => {
      try { e.target.value = ''; } catch {}
    }, 200);
      }
    } else {
      const objectUrl = URL.createObjectURL(file);
      setImageToCropSrc(objectUrl);
      setCropTarget('modal');
      setCropModalOpen(true);
      setTimeout(() => {
      try { e.target.value = ''; } catch {}
    }, 200);
    }
  };

  // Save Profile: Name, Bio, Bio Link, Avatar & Banner
  const handleSaveProfile = async () => {
    setEditError('');
    const cleanName = editName.trim();
    const cleanBio = editBio.trim();
    const cleanBioLink = editBioLink.trim();

    if (!cleanName) {
      setEditError('Name cannot be empty');
      return;
    }

    try {
      setIsSavingProfile(true);
      const payload = {
        name: cleanName,
        bio: cleanBio,
        bio_link: cleanBioLink,
        avatar_url: editAvatarUrl ? editAvatarUrl.trim() : null,
        banner_url: editBannerUrl ? editBannerUrl.trim() : null,
      };

      const res = await api.put(`/users/${username}`, payload);
      const updatedUser = res.data?.data?.user;

      if (updatedUser) {
        setUser(prev => ({
          ...prev,
          name: updatedUser.name || updatedUser.username,
          username: updatedUser.username,
          bio: updatedUser.bio || '',
          bio_link: updatedUser.bio_link || '',
          avatar_url: updatedUser.avatar_url || '',
          banner_url: updatedUser.banner_url || '',
        }));

        // Update stored user in localStorage
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedStored = {
          ...stored,
          name: updatedUser.name,
          username: updatedUser.username,
          bio: updatedUser.bio,
          bio_link: updatedUser.bio_link,
          avatar_url: updatedUser.avatar_url || null,
          banner_url: updatedUser.banner_url || null,
        };
        localStorage.setItem('user', JSON.stringify(updatedStored));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser }));

        setShowEditModal(false);
        displayToast('Profile updated successfully');
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Delete User Account & Profile
  const handleDeleteProfile = async () => {
    try {
      setIsDeletingProfile(true);
      setDeleteError('');
      await api.delete('/auth/delete');

      // Purge all user tokens and cached profile
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('show_onboarding');
      localStorage.removeItem('onboarding_completed');

      // Broadcast storage event to sync all UI components
      window.dispatchEvent(new Event('storage'));

      // Redirect immediately to Auth page
      navigate('/auth', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete account. Please try again.');
      setIsDeletingProfile(false);
    }
  };

  const handlePostDeleted = (id) => {
    setTabData(prev => ({
      ...prev,
      posts: prev.posts ? prev.posts.filter(p => p.id !== id) : null,
      media: prev.media ? prev.media.filter(p => p.id !== id) : null,
      likes: prev.likes ? prev.likes.filter(p => p.id !== id) : null,
    }));
  };

  const handlePostUpdated = (updatedPost) => {
    setTabData(prev => ({
      ...prev,
      posts: prev.posts ? prev.posts.map(p => p.id === updatedPost.id ? updatedPost : p) : null,
      media: prev.media ? prev.media.map(p => p.id === updatedPost.id ? updatedPost : p) : null,
      likes: prev.likes ? prev.likes.map(p => p.id === updatedPost.id ? updatedPost : p) : null,
    }));
  };

  // Format website link safely for href
  const formatUrl = (url) => {
    if (!url) return '';
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#0F1419] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col min-h-screen bg-white">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-[#EFF3F4] px-4 h-[53px] flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-[#EFF3F4] text-[#0F1419] transition-colors"
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-[19px] text-[#0F1419] leading-tight">
              {user?.name || user?.username}
            </h1>
            <p className="text-[13px] text-[#536471]">
              {tabData.posts ? `${tabData.posts.length} ${tabData.posts.length === 1 ? 'post' : 'posts'}` : ''}
            </p>
          </div>
        </div>

        {/* Cover Photo Banner */}
        <div 
          onClick={() => {
            if (user?.banner_url) {
              setMediaViewer({
                src: user.banner_url,
                title: user?.name || user?.username,
                type: 'banner'
              });
            }
          }}
          className={`h-[140px] sm:h-[200px] w-full relative bg-gradient-to-r from-gray-900 via-[#1E2329] to-black overflow-hidden group/banner ${
            user?.banner_url ? 'cursor-pointer' : ''
          }`}
          title={user?.banner_url ? "Click to view full banner" : ""}
        >
          {user?.banner_url ? (
            <>
              <img
                src={user.banner_url}
                alt="Banner"
                className="w-full h-full object-cover group-hover/banner:opacity-95 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="px-3 py-1.5 bg-black/70 backdrop-blur-md text-white text-[12px] font-semibold rounded-full flex items-center gap-1.5 shadow-md">
                  <ZoomIn size={14} /> View banner
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950" />
          )}

          {/* Direct Banner Actions for Own Profile */}
          {isOwnProfile && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 right-3 flex items-center gap-2 z-10"
            >
              {user?.banner_url && (
                <button
                  type="button"
                  onClick={handleDirectRemoveBanner}
                  disabled={isRemovingBanner || isUploadingBanner}
                  className="px-3 py-1.5 bg-black/60 hover:bg-red-600/90 backdrop-blur-md text-white rounded-full cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5 border border-white/10"
                  title="Remove banner (restore default)"
                >
                  <Trash2 size={13} />
                  <span className="text-[12px] font-semibold hidden sm:inline">Remove</span>
                </button>
              )}
              <label
                className="px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-1.5 opacity-90 hover:opacity-100 group-hover/banner:opacity-100 border border-white/10"
                title="Change banner image"
              >
                <Camera size={15} />
                <span className="text-[12px] font-semibold hidden sm:inline">
                  {user?.banner_url ? 'Edit banner' : 'Add banner'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleDirectBannerUpload}
                  disabled={isUploadingBanner || isRemovingBanner}
                />
              </label>
            </div>
          )}

          {/* Banner Uploading Overlay */}
          {isUploadingBanner && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20 transition-all">
              <div className="w-8 h-8 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin mb-2" />
              <div className="flex items-center gap-1 text-[13px] font-bold">
                <span>Uploading banner</span>
                <span className="animate-pulse">...</span>
                <span className="text-violet-300 ml-1">{bannerUploadProgress}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Profile Info Section */}
        <div className="px-4 pb-4">
          <div className="flex justify-between items-start">
            {/* Avatar Container (Outer wrapper without overflow-hidden so icon sits on top!) */}
            <div className="-mt-12 sm:-mt-16 w-[82px] h-[82px] sm:w-[134px] sm:h-[134px] flex-shrink-0 relative z-20 group/avatar">
              {/* Inner Circle Image (Overflow-hidden so image stays perfectly circular) */}
              <div 
                className="w-full h-full rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-md relative cursor-pointer"
                onClick={() => {
                  setMediaViewer({
                    src: user?.avatar_url || getAvatarUrl(user),
                    title: user?.name || user?.username,
                    type: 'avatar'
                  });
                }}
              >
                <img
                  src={getAvatarUrl(user)}
                  alt={user?.username || 'Avatar'}
                  className="w-full h-full object-cover bg-white hover:opacity-95 transition-opacity"
                />

                {/* View Overlay on Hover */}
                <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none">
                  <ZoomIn size={20} className="drop-shadow-md" />
                  <span className="text-[10px] sm:text-[11px] font-bold mt-0.5">View</span>
                </div>

                {/* Avatar Uploading Overlay */}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white z-30">
                    <div className="w-6 h-6 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin mb-1" />
                    <span className="text-[10px] font-bold">{avatarUploadProgress}%</span>
                  </div>
                )}
              </div>

              {/* Direct Camera Upload Icon - Elevated on TOP of everything! */}
              {isOwnProfile && (
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-0 right-0 p-2 sm:p-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full cursor-pointer shadow-xl border-2 border-white flex items-center justify-center transition-all active:scale-95 z-30"
                  title="Upload profile picture"
                >
                  <Camera size={14} className="sm:w-4 sm:h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDirectAvatarUpload}
                    disabled={isUploadingAvatar || isRemovingAvatar}
                  />
                </label>
              )}
            </div>

            {/* Profile Action Button */}
            <div className="mt-3 flex items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => {
                      setEditName(user?.name || user?.username || '');
                      setEditUsername(user?.username || '');
                      setEditBio(user?.bio || '');
                      setEditBioLink(user?.bio_link || '');
                      setEditAvatarUrl(user?.avatar_url || '');
                      setEditBannerUrl(user?.banner_url || '');
                      setEditError('');
                      setShowEditModal(true);
                    }}
                    className="p-1.5 border border-[#CFD9DE] hover:bg-[#F7F9F9] hover:border-[#0F1419] text-[#0F1419] rounded-full transition-all active:scale-95 shadow-sm flex items-center justify-center"
                    title="Edit profile"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmationText('');
                      setDeleteError('');
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-full transition-all active:scale-95 shadow-sm"
                    title="Delete Account"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleToggleFollow}
                  className={`px-6 py-1.5 font-bold text-[14px] rounded-full transition-colors whitespace-nowrap active:scale-95 shadow-sm ${isFollowing
                      ? 'border border-[#CFD9DE] hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-[#0F1419]'
                      : 'bg-[#0F1419] hover:bg-[#272C30] text-white'
                    }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          {/* Name & Username */}
          <div className="mt-3">
            <h2 className="font-black text-[21px] sm:text-[23px] text-[#0F1419] leading-tight">
              {user?.name || user?.username}
            </h2>
            <p className="text-[15px] text-[#536471]">
              @{user?.username}
            </p>
          </div>

          {/* Bio */}
          {user?.bio ? (
            <p className="mt-3 text-[15px] text-[#0F1419] leading-relaxed whitespace-pre-wrap break-words">
              {user.bio}
            </p>
          ) : (
            isOwnProfile && (
              <p
                onClick={() => setShowEditModal(true)}
                className="mt-2 text-[14px] text-[#536471] italic cursor-pointer hover:underline"
              >
                + Add a bio to tell people who you are
              </p>
            )
          )}

          {/* Meta Details Row: Bio Link & Join Date */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[14px] sm:text-[15px] text-[#536471]">
            {user?.bio_link && (
              <div className="flex items-center gap-1.5">
                <LinkIcon size={16} className="text-[#536471] flex-shrink-0" />
                <a
                  href={formatUrl(user.bio_link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1D9BF0] hover:underline font-semibold truncate max-w-[260px]"
                >
                  {user.bio_link.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Calendar size={16} className="text-[#536471] flex-shrink-0" />
              <span>Joined {user?.joinDate}</span>
            </div>
          </div>

          {/* Following & Followers Stats */}
          <div className="flex items-center gap-5 mt-3.5 text-[15px]">
            <button
              type="button"
              onClick={() => handleOpenFollowModal('following')}
              className="hover:underline cursor-pointer flex items-center gap-1.5 focus:outline-none"
            >
              <span className="font-black text-[#0F1419]">{user?.following}</span>{' '}
              <span className="text-[#536471]">Following</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenFollowModal('followers')}
              className="hover:underline cursor-pointer flex items-center gap-1.5 focus:outline-none"
            >
              <span className="font-black text-[#0F1419]">{user?.followers}</span>{' '}
              <span className="text-[#536471]">Followers</span>
            </button>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex border-b border-[#EFF3F4] mt-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className="flex-1 py-3 text-center font-bold text-[15px] hover:bg-[#F7F9F9] transition-colors relative"
            >
              <span className={activeTab === tab ? 'text-[#0F1419]' : 'text-[#536471]'}>
                {tab}
              </span>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#0F1419] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Posts Timeline */}
        <div className="divide-y divide-[#EFF3F4] pb-16">
          {(() => {
            const currentItems = tabData[activeTab.toLowerCase()];
            const isTabLoading = postsLoading && (currentItems === null || currentItems === undefined);

            if (isTabLoading) {
              return (
                <div className="divide-y divide-[#EFF3F4]">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 px-4 py-4 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2.5">
                        <div className="h-4 bg-gray-200 rounded w-1/4" />
                        <div className="h-3 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            if (!currentItems || currentItems.length === 0) {
              return (
                <div className="p-12 text-center max-w-sm mx-auto">
                  <div className="w-14 h-14 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center mx-auto mb-4">
                    {activeTab === 'Replies' && <MessageCircle size={28} />}
                    {activeTab === 'Media' && <ImageIcon size={28} />}
                    {activeTab === 'Likes' && <Heart size={28} />}
                    {activeTab === 'Posts' && <FileText size={28} />}
                  </div>

                  <h2 className="font-extrabold text-[20px] text-[#0F1419] mb-1.5">
                    {activeTab === 'Posts' && (isOwnProfile ? 'You haven’t posted yet' : `@${username} hasn't posted yet`)}
                    {activeTab === 'Replies' && (isOwnProfile ? 'No replies yet' : `@${username} hasn't replied yet`)}
                    {activeTab === 'Media' && (isOwnProfile ? 'Lights, camera... attachments!' : 'No media yet')}
                    {activeTab === 'Likes' && (isOwnProfile ? 'You don’t have any likes yet' : `@${username} hasn't liked any posts yet`)}
                  </h2>

                  <p className="text-[14px] text-[#536471] leading-relaxed mb-5">
                    {activeTab === 'Posts' && (isOwnProfile ? 'When you publish posts, they will show up here.' : `@${username} hasn't posted anything yet.`)}
                    {activeTab === 'Replies' && (isOwnProfile ? 'When you reply to posts or join conversations, your replies will show up here.' : `@${username} hasn't replied to any posts yet.`)}
                    {activeTab === 'Media' && (isOwnProfile ? 'When you post photos, images, or media links, they’ll show up here.' : `@${username} hasn't posted any photos or videos yet.`)}
                    {activeTab === 'Likes' && (isOwnProfile ? 'Tap the heart on any post to show some love. When you do, it will show up here.' : `When @${username} likes posts, they will show up here.`)}
                  </p>

                  {isOwnProfile && activeTab === 'Posts' && (
                    <button
                      onClick={() => window.dispatchEvent(new Event('open-compose'))}
                      className="px-6 py-2.5 bg-[#0F1419] hover:bg-[#272C30] text-white font-bold text-[14px] rounded-full transition-all shadow-sm active:scale-95"
                    >
                      Write a Post
                    </button>
                  )}
                </div>
              );
            }

            if (activeTab === 'Replies') {
              return currentItems.map(reply => (
                <ProfileReplyCard
                  key={reply.id}
                  reply={reply}
                  onNavigate={navigate}
                />
              ));
            }

            if (activeTab === 'Likes') {
              return currentItems.map(post => (
                <div key={post.id} className="relative">
                  <div className="flex items-center gap-1.5 px-4 pt-2.5 -mb-2 text-[12px] font-bold text-[#536471]">
                    <Heart size={13} className="fill-[#F91880] text-[#F91880]" />
                    <span>@{username} liked</span>
                  </div>
                  <PostCard
                    post={post}
                    onNavigate={navigate}
                    onPostDeleted={handlePostDeleted}
                    onPostUpdated={handlePostUpdated}
                  />
                </div>
              ));
            }

            return currentItems.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onNavigate={navigate}
                onPostDeleted={handlePostDeleted}
                onPostUpdated={handlePostUpdated}
              />
            ));
          })()}
        </div>
      </div>

      {/* ── Twitter/X-Native Edit Profile Modal ── */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[520px] sm:rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 h-14 border-b border-[#EFF3F4] flex items-center justify-between flex-shrink-0 bg-white">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="w-9 h-9 rounded-full text-[#0F1419] hover:bg-[#EFF3F4] flex items-center justify-center transition-colors active:scale-95"
                  title="Close"
                >
                  <X size={19} />
                </button>
                <h3 className="font-black text-[19px] text-[#0F1419]">
                  Edit profile
                </h3>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="px-6 py-1.5 bg-[#0F1419] hover:bg-[#272C30] disabled:opacity-50 text-white font-bold text-[14px] rounded-full transition-all shadow-sm active:scale-95"
              >
                {isSavingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>

            {/* Error Message */}
            {editError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[13px] font-semibold flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{editError}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto flex-1">
              {/* Modal Cover Photo Banner */}
              <div className="relative h-32 sm:h-36 bg-gradient-to-r from-gray-900 via-[#1E2329] to-black w-full overflow-hidden flex items-center justify-center group/modalBanner">
                {editBannerUrl ? (
                  <img
                    src={editBannerUrl}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950" />
                )}

                {/* Banner Action Buttons */}
                <div className="flex items-center gap-2 z-10">
                  <label className="p-2 sm:p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white cursor-pointer transition-all active:scale-95 shadow-md flex items-center gap-1.5 border border-white/10">
                    <Camera size={16} />
                    <span className="text-[12px] font-semibold pr-1">
                      {editBannerUrl ? 'Change' : 'Add Banner'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleModalImageUpload(e, 'banner')}
                      disabled={modalBannerUploading}
                    />
                  </label>
                  {editBannerUrl && (
                    <button
                      type="button"
                      onClick={() => setEditBannerUrl('')}
                      className="p-2 sm:p-2.5 bg-black/60 hover:bg-red-600/90 backdrop-blur-md rounded-full text-white cursor-pointer transition-all active:scale-95 shadow-md flex items-center gap-1.5 border border-white/10"
                      title="Remove banner (restore default)"
                    >
                      <Trash2 size={16} />
                      <span className="text-[12px] font-semibold pr-1">Remove</span>
                    </button>
                  )}
                </div>

                {modalBannerUploading && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center text-white z-20 gap-2">
                    <div className="w-5 h-5 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin" />
                    <span className="text-[12px] font-bold">Uploading... {modalBannerProgress}%</span>
                  </div>
                )}
              </div>

              {/* Modal Avatar Row */}
              <div className="px-6 relative -mt-10 sm:-mt-12 flex items-end justify-between z-20 mb-4">
                <div className="flex items-end gap-3">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-md group/modalAvatar">
                    <img
                      src={getAvatarUrl(editAvatarUrl || user?.username)}
                      alt="Avatar preview"
                      className="w-full h-full object-cover bg-white"
                    />
                    <label className="absolute inset-0 bg-black/45 hover:bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center text-white cursor-pointer transition-all">
                      <Camera size={20} />
                      <span className="text-[10px] font-bold mt-0.5">Change</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleModalImageUpload(e, 'avatar')}
                        disabled={modalAvatarUploading}
                      />
                    </label>
                    {modalAvatarUploading && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                        <div className="w-5 h-5 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin mb-1" />
                        <span className="text-[10px] font-bold">{modalAvatarProgress}%</span>
                      </div>
                    )}
                  </div>

                  {/* Remove Avatar Button in Modal */}
                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarUrl('')}
                      className="mb-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-full text-[12px] font-semibold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                      title="Remove profile picture (restore default avatar)"
                    >
                      <Trash2 size={13} />
                      <span>Remove photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="px-6 pb-6 space-y-5">
              {/* Field 1: Name (Display Name) */}
              <div className="space-y-1">
                <div className="rounded-xl border border-[#CFD9DE] focus-within:border-[#0F1419] focus-within:ring-1 focus-within:ring-[#0F1419] px-3.5 py-2 transition-all bg-white">
                  <div className="flex justify-between items-center text-[12px] text-[#536471] font-semibold">
                    <span>Name</span>
                    <span>{editName.length}/50</span>
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value.slice(0, 50))}
                    placeholder="Your display name"
                    maxLength={50}
                    className="w-full text-[15px] font-bold text-[#0F1419] outline-none pt-0.5 bg-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Field 2: Username (Permanent - Locked) */}
              <div className="space-y-1">
                <div className="rounded-xl border border-[#EFF3F4] px-3.5 py-2.5 bg-[#F7F9F9] flex items-center justify-between select-none">
                  <div>
                    <span className="block text-[11px] font-bold text-[#536471] uppercase tracking-wider">
                      Username
                    </span>
                    <span className="text-[15px] font-bold text-[#536471]">
                      @{user?.username}
                    </span>
                  </div>
                  <span className="text-[12px] font-semibold text-[#536471] bg-white px-2.5 py-1 rounded-full border border-[#EFF3F4]">
                    Permanent
                  </span>
                </div>
                <p className="text-[12px] text-[#536471] px-1">
                  Usernames are unique and created once during onboarding.
                </p>
              </div>

              {/* Field 3: Bio */}
              <div className="space-y-1">
                <div className="rounded-xl border border-[#CFD9DE] focus-within:border-[#0F1419] focus-within:ring-1 focus-within:ring-[#0F1419] px-3.5 py-2 transition-all bg-white">
                  <div className="flex justify-between items-center text-[12px] text-[#536471] font-semibold">
                    <span>Bio</span>
                    <span>{editBio.length}/160</span>
                  </div>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                    maxLength={160}
                    rows={3}
                    placeholder="Describe what you build, what you love, and who you are..."
                    className="w-full text-[15px] text-[#0F1419] outline-none resize-none pt-1 bg-transparent leading-relaxed placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Field 4: Bio Link (Website) */}
              <div className="space-y-1">
                <div className="rounded-xl border border-[#CFD9DE] focus-within:border-[#0F1419] focus-within:ring-1 focus-within:ring-[#0F1419] px-3.5 py-2 transition-all bg-white">
                  <div className="flex justify-between items-center text-[12px] text-[#536471] font-semibold">
                    <span>Website / Bio link</span>
                    <span>{editBioLink.length}/255</span>
                  </div>
                  <div className="flex items-center pt-0.5">
                    <Globe size={16} className="text-[#536471] mr-2 flex-shrink-0" />
                    <input
                      type="text"
                      value={editBioLink}
                      onChange={(e) => setEditBioLink(e.target.value.trim().slice(0, 255))}
                      placeholder="https://yoursite.com"
                      maxLength={255}
                      className="w-full text-[15px] font-medium text-[#0F1419] outline-none bg-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <p className="text-[12px] text-[#536471] px-1">
                  Add your portfolio, GitHub, blog, or project link.
                </p>
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="pt-5 border-t border-red-100 mt-6">
                <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[14px] font-bold text-red-600 flex items-center gap-1.5">
                      <Trash2 size={16} /> Delete Account
                    </h4>
                    <p className="text-[12px] text-red-500/90 mt-0.5 leading-snug">
                      Permanently wipe your profile, posts, comments, and all associated data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setDeleteConfirmationText('');
                      setDeleteError('');
                      setShowDeleteModal(true);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] rounded-full transition-all active:scale-95 shadow-sm whitespace-nowrap"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Delete Profile Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { if (!isDeletingProfile) setShowDeleteModal(false); }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-[420px] p-6 sm:p-7 shadow-2xl border border-red-100 flex flex-col text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon with pulsating ring */}
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 ring-8 ring-red-50">
              <Trash2 size={26} strokeWidth={2.2} />
            </div>

            <h3 className="text-[20px] font-black text-[#0F1419] tracking-tight">
              Delete @{user?.username}?
            </h3>

            <p className="text-[14px] text-[#536471] mt-2 leading-relaxed">
              This action is <span className="font-bold text-red-600">permanent and irreversible</span>. All your posts, likes, comments, followers, and profile details will be completely wiped from SOLITX.
            </p>

            {/* Error Message */}
            {deleteError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[13px] font-semibold flex items-center gap-2 text-left">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Confirmation Buttons */}
            <div className="flex flex-col gap-2.5 mt-6">
              <button
                type="button"
                onClick={handleDeleteProfile}
                disabled={isDeletingProfile}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-[15px] rounded-full shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                {isDeletingProfile ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Deleting account...</span>
                  </>
                ) : (
                  <span>Yes, permanently delete</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingProfile}
                className="w-full py-2.5 bg-white hover:bg-[#F7F9F9] disabled:opacity-50 text-[#0F1419] font-bold text-[14px] rounded-full border border-[#CFD9DE] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Followers / Following Modal */}
      {followModalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setFollowModalType(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-[480px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EFF3F4]">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => handleSwitchFollowModalTab('followers')}
                  className={`pb-1 text-[15px] font-bold relative transition-colors ${followModalType === 'followers' ? 'text-[#0F1419]' : 'text-[#536471] hover:text-[#0F1419]'
                    }`}
                >
                  Followers
                  {followModalType === 'followers' && (
                    <div className="absolute -bottom-3 left-0 right-0 h-1 bg-[#7C3AED] rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchFollowModalTab('following')}
                  className={`pb-1 text-[15px] font-bold relative transition-colors ${followModalType === 'following' ? 'text-[#0F1419]' : 'text-[#536471] hover:text-[#0F1419]'
                    }`}
                >
                  Following
                  {followModalType === 'following' && (
                    <div className="absolute -bottom-3 left-0 right-0 h-1 bg-[#7C3AED] rounded-full" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFollowModalType(null)}
                className="p-2 text-gray-400 hover:text-[#0F1419] hover:bg-[#EFF3F4] rounded-full transition-colors active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#EFF3F4] min-h-[220px]">
              {followListLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                        <div className="h-3 bg-gray-100 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : followListUsers.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#F7F9F9] flex items-center justify-center mx-auto mb-3 text-[#536471]">
                    <UserIcon size={24} />
                  </div>
                  <p className="font-bold text-[16px] text-[#0F1419]">
                    {followModalType === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                  </p>
                  <p className="text-[13px] text-[#536471] mt-1 max-w-xs mx-auto">
                    {followModalType === 'followers'
                      ? `When people follow @${user?.username}, they will show up here.`
                      : `@${user?.username} hasn't followed any accounts yet.`}
                  </p>
                </div>
              ) : (
                followListUsers.map((u) => {
                  const isCurrent = currentUser?.username?.toLowerCase() === u.username?.toLowerCase();
                  return (
                    <div
                      key={u.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-[#F7F9F9]/70 transition-colors"
                    >
                      <div
                        onClick={() => {
                          setFollowModalType(null);
                          navigate(`/profile/${u.username}`);
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          <img
                            src={getAvatarUrl(u)}
                            alt={u.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[15px] text-[#0F1419] truncate leading-tight hover:underline">
                            {u.name || u.username}
                          </p>
                          <p className="text-[13px] text-[#536471] truncate leading-tight">
                            @{u.username}
                          </p>
                          {u.bio && (
                            <p className="text-[13px] text-[#536471] truncate mt-0.5 leading-snug">
                              {u.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleToggleFollowInModal(u.username)}
                          className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all flex-shrink-0 active:scale-95 ${u.is_following
                              ? 'bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-[#0F1419] border border-[#CFD9DE]'
                              : 'bg-[#0F1419] hover:bg-[#272C30] text-white shadow-sm'
                            }`}
                        >
                          {u.is_following ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1419] text-white text-[14px] font-semibold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check size={16} className="text-green-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Full-Screen Lightbox Media Viewer for Profile Picture & Banner */}
      {mediaViewer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200"
          onClick={() => setMediaViewer(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between p-4 sm:p-6 text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMediaViewer(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Close viewer (Esc)"
              >
                <X size={20} />
              </button>
              <div>
                <h3 className="font-bold text-[16px] text-white leading-tight">
                  {mediaViewer.title}
                </h3>
                <p className="text-[12px] text-gray-400 capitalize">
                  {mediaViewer.type === 'avatar' ? 'Profile picture' : 'Header banner'}
                </p>
              </div>
            </div>
          </div>

          {/* Centered Image Container */}
          <div
            className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden gap-4"
            onClick={() => setMediaViewer(null)}
          >
            <div
              className="relative max-w-full max-h-[75vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={mediaViewer.src}
                alt={mediaViewer.title}
                className={`max-w-full max-h-[70vh] object-contain shadow-2xl transition-transform duration-200 select-none ${
                  mediaViewer.type === 'avatar'
                    ? 'rounded-full border-4 border-white/20 aspect-square max-w-[min(80vw,420px)]'
                    : 'rounded-2xl border border-white/20 aspect-[3/1] max-w-[min(95vw,1000px)] w-full'
                }`}
              />
            </div>

            {/* 2 Buttons for Own Profile: Delete and Upload */}
            {isOwnProfile && mediaViewer.type === 'avatar' && (
              <div
                className="flex items-center gap-3 z-20 mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Upload Button */}
                <label
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-[13px] rounded-full cursor-pointer shadow-lg active:scale-95 flex items-center gap-2 transition-all border border-violet-400/30"
                  title="Upload / Change profile picture"
                >
                  <Camera size={16} />
                  <span>Upload new photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDirectAvatarUpload}
                    disabled={isUploadingAvatar || isRemovingAvatar}
                  />
                </label>

                {/* Delete Button */}
                {user?.avatar_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleDirectRemoveAvatar();
                      setMediaViewer(null);
                    }}
                    disabled={isRemovingAvatar || isUploadingAvatar}
                    className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white font-bold text-[13px] rounded-full shadow-lg active:scale-95 flex items-center gap-2 transition-all border border-red-400/30"
                    title="Remove profile picture (restore default avatar)"
                  >
                    <Trash2 size={16} />
                    <span>Delete photo</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Bar Info / Tips */}
          <div className="p-4 text-center text-[12px] text-gray-400">
            Click anywhere outside to close
          </div>
        </div>
      )}

      {/* Image Crop & Resize Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={imageToCropSrc}
        onClose={() => {
          setCropModalOpen(false);
          setImageToCropSrc(null);
        }}
        onCropComplete={handleCropComplete}
        isUploading={isUploadingAvatar || modalAvatarUploading}
        uploadProgress={isUploadingAvatar ? avatarUploadProgress : modalAvatarProgress}
      />
    </AppShell>
  );
};

export default Profile;
