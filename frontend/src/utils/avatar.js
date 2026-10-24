/**
 * Returns a guaranteed valid avatar image URL for a user object, post object, or string.
 * Prioritizes custom S3 uploaded avatar (avatar_url / author_avatar_url),
 * falling back cleanly to an elegant native SVG monogram (no external cartoon APIs).
 *
 * @param {Object|string|null} userOrPost - User object, Post/Comment object, or URL/username string
 * @returns {string} - Direct image URL or inline SVG Data URI
 */
export const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' fill='%23E2E8F0'/%3E%3Cpath d='M64 62c11.046 0 20-8.954 20-20s-8.954-20-20-20-20 8.954-20 20 8.954 20 20 20zm0 10c-15.464 0-46 7.78-46 23.333V106h92V97.333C110 81.78 79.464 74 64 74z' fill='%2394A3B8'/%3E%3C/svg%3E`;

export const getAvatarUrl = (userOrPost) => {
  if (!userOrPost) {
    return DEFAULT_AVATAR;
  }

  // If passed directly as a string (URL or username)
  if (typeof userOrPost === 'string') {
    const trimmed = userOrPost.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    const initial = trimmed.charAt(0).toUpperCase() || 'U';
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' fill='%23F1F5F9'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif' font-size='56' font-weight='700' fill='%23475569'%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  }

  // If passed as an object (user, post, comment, reply)
  if (typeof userOrPost === 'object') {
    const custom = userOrPost.avatar_url || userOrPost.author_avatar_url;
    if (custom && typeof custom === 'string' && (custom.startsWith('http://') || custom.startsWith('https://') || custom.startsWith('data:image/'))) {
      return custom.trim();
    }

    const name = userOrPost.name || userOrPost.author_name || userOrPost.username || userOrPost.author_username || '';
    const initial = name.trim().charAt(0).toUpperCase() || 'U';
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' fill='%23F1F5F9'/%3E%3Ctext x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif' font-size='56' font-weight='700' fill='%23475569'%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  }

  return DEFAULT_AVATAR;
};

