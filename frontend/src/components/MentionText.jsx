import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Parses and formats text containing:
 * - Real Account Mentions: @username -> clickable link to /profile/:username
 * - Hashtags: #hashtag -> clickable link to /explore?q=%23hashtag
 * - Web URLs: https://... -> clickable external link
 */
const MentionText = ({ text = '', className = '' }) => {
  const navigate = useNavigate();

  if (!text || typeof text !== 'string') return null;

  // Regex pattern matching @mentions, #hashtags, and http(s) URLs
  const tokenRegex = /(@[a-zA-Z0-9_]{3,20}|#[a-zA-Z0-9_\u0080-\uFFFF]+|https?:\/\/[^\s]+)/g;
  const parts = text.split(tokenRegex);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;

        // 1. @Mention Handling
        if (part.startsWith('@') && /^@[a-zA-Z0-9_]{3,20}$/.test(part)) {
          const username = part.slice(1);
          return (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                navigate(`/profile/${username}`);
              }}
              className="font-bold text-[#7C3AED] hover:text-[#6D28D9] hover:underline cursor-pointer transition-colors inline-block"
              title={`View @${username}'s profile`}
            >
              {part}
            </span>
          );
        }

        // 2. #Hashtag Handling
        if (part.startsWith('#') && /^#[a-zA-Z0-9_\u0080-\uFFFF]+$/.test(part)) {
          return (
            <span
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                navigate(`/explore?q=${encodeURIComponent(part)}`);
              }}
              className="font-semibold text-[#1D9BF0] hover:underline cursor-pointer transition-colors inline-block"
              title={`Explore ${part}`}
            >
              {part}
            </span>
          );
        }

        // 3. URL Handling
        if (/^https?:\/\/[^\s]+$/i.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#1D9BF0] hover:underline break-all"
            >
              {part}
            </a>
          );
        }

        // 4. Standard text
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
};

export default MentionText;
