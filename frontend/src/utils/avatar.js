/**
 * Returns a guaranteed valid avatar image URL for a user object, post object, or seed.
 * Prioritizes custom S3 uploaded avatar (avatar_url / author_avatar_url),
 * falling back gracefully to Dicebear SVG avatars.
 *
 * @param {Object|string|null} userOrPost - User object, Post/Comment object, or URL string
 * @param {string} [seedFallback='user'] - Fallback seed name for Dicebear
 * @returns {string} - Direct image URL
 */
export const getAvatarUrl = (userOrPost, seedFallback = 'user') => {
  if (!userOrPost) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seedFallback}`;
  }

  // If passed directly as a string
  if (typeof userOrPost === 'string') {
    const trimmed = userOrPost.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(trimmed || seedFallback)}`;
  }

  // If passed as an object
  if (typeof userOrPost === 'object') {
    const custom = userOrPost.avatar_url || userOrPost.author_avatar_url;
    if (custom && typeof custom === 'string' && (custom.startsWith('http://') || custom.startsWith('https://'))) {
      return custom.trim();
    }

    const seed = userOrPost.username || userOrPost.author_name || userOrPost.name || seedFallback;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || seedFallback)}`;
  }

  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seedFallback}`;
};
