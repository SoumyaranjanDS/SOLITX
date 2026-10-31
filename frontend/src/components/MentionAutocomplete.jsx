import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AtSign, Loader2, Check } from 'lucide-react';
import api from '../api';
import { getAvatarUrl } from '../utils/avatar';

/**
 * Hook to manage @mention autocomplete state for textareas
 */
export function useMentionAutocomplete({ text, setText, textareaRef }) {
  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    startIndex: -1,
    endIndex: -1,
  });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Check text & cursor for active @mention trigger
  const checkMentionTrigger = useCallback(() => {
    if (!textareaRef?.current) return;
    const el = textareaRef.current;
    const cursorPos = el.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);

    // Matches @ preceded by start of string or whitespace, followed by valid username chars up to cursor
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      const query = match[1];
      // Index where '@' actually begins in the full text
      const atIndex = cursorPos - query.length - 1;
      setMentionState({
        active: true,
        query,
        startIndex: atIndex,
        endIndex: cursorPos,
      });
      setSelectedIndex(0);
    } else {
      setMentionState(prev => prev.active ? { active: false, query: '', startIndex: -1, endIndex: -1 } : prev);
      setSuggestions([]);
    }
  }, [text, textareaRef]);

  // Query suggestions when mention query changes
  useEffect(() => {
    if (!mentionState.active) return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await api.get('/users/suggestions', {
          params: { q: mentionState.query, limit: 6 },
        });
        if (!isCancelled) {
          const users = res.data?.data?.users || [];
          setSuggestions(users);
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!isCancelled) setSuggestions([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [mentionState.active, mentionState.query]);

  // Insert selected user handle at mention position
  const selectUser = useCallback((user) => {
    if (!user || !user.username) return;
    const username = user.username;
    const before = text.slice(0, mentionState.startIndex);
    const after = text.slice(mentionState.endIndex);
    const replacement = `@${username} `;
    const newText = before + replacement + after;

    setText(newText);
    setMentionState({ active: false, query: '', startIndex: -1, endIndex: -1 });
    setSuggestions([]);

    // Restore focus and position cursor right after the inserted mention
    setTimeout(() => {
      if (textareaRef?.current) {
        textareaRef.current.focus();
        const nextPos = before.length + replacement.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 20);
  }, [text, setText, mentionState, textareaRef]);

  // Handle arrow keys and Enter/Tab for dropdown navigation
  const handleKeyDown = useCallback((e) => {
    if (!mentionState.active || suggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions[selectedIndex]) {
        e.preventDefault();
        selectUser(suggestions[selectedIndex]);
        return true;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setMentionState({ active: false, query: '', startIndex: -1, endIndex: -1 });
      setSuggestions([]);
      return true;
    }
    return false;
  }, [mentionState.active, suggestions, selectedIndex, selectUser]);

  // Helper to trigger @ from a toolbar button
  const triggerMention = useCallback(() => {
    if (!textareaRef?.current) return;
    const el = textareaRef.current;
    const pos = el.selectionStart;
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const needsLeadingSpace = pos > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    const insertStr = (needsLeadingSpace ? ' @' : '@');
    const newText = before + insertStr + after;

    setText(newText);
    setTimeout(() => {
      el.focus();
      const newPos = pos + insertStr.length;
      el.setSelectionRange(newPos, newPos);
      checkMentionTrigger();
    }, 20);
  }, [text, setText, textareaRef, checkMentionTrigger]);

  return {
    mentionState,
    suggestions,
    loading,
    selectedIndex,
    checkMentionTrigger,
    selectUser,
    handleKeyDown,
    triggerMention,
    closeMentions: () => setMentionState({ active: false, query: '', startIndex: -1, endIndex: -1 }),
  };
}

/**
 * Visual Dropdown Component for @mention Autocomplete
 */
export default function MentionDropdown({
  mentionState,
  suggestions,
  loading,
  selectedIndex,
  onSelect,
  className = '',
}) {
  if (!mentionState?.active) return null;

  return (
    <div
      className={`absolute z-50 bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.16)] border border-[#EFF3F4] overflow-hidden w-72 max-w-[90vw] animate-in fade-in zoom-in-95 duration-150 ${className}`}
      onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur on click
    >
      {/* Dropdown Header */}
      <div className="px-3.5 py-2 border-b border-[#EFF3F4] bg-[#F7F9F9] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] uppercase tracking-wider">
          <AtSign size={13} />
          <span>Mention a developer</span>
        </div>
        {loading && <Loader2 size={13} className="animate-spin text-[#7C3AED]" />}
      </div>

      {/* List of Real Users */}
      <div className="max-h-60 overflow-y-auto py-1">
        {loading && suggestions.length === 0 ? (
          <div className="px-4 py-4 text-center text-[13px] text-[#536471]">
            Searching developers...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-4 py-4 text-center text-[13px] text-[#536471]">
            No developers found matching <span className="font-semibold text-[#0F1419]">@{mentionState.query}</span>
          </div>
        ) : (
          suggestions.map((u, idx) => {
            const isHighlighted = idx === selectedIndex;
            return (
              <button
                key={u.id || u.username}
                type="button"
                onClick={() => onSelect(u)}
                className={`w-full px-3.5 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  isHighlighted ? 'bg-[#7C3AED]/10 text-[#0F1419]' : 'hover:bg-[#F7F9F9] text-[#0F1419]'
                }`}
              >
                {/* User Avatar */}
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-100">
                  <img
                    src={getAvatarUrl(u)}
                    alt={u.username}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Account Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="font-bold text-[13px] truncate leading-tight">
                      {u.name || u.username}
                    </p>
                    {u.is_following && (
                      <span className="text-[10px] font-semibold text-[#7C3AED] bg-[#7C3AED]/10 px-1 rounded">
                        Following
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#536471] truncate leading-tight">
                    @{u.username}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
