//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useEffect, useRef } from 'react';

interface SearchBarProps {
  onClose: () => void;
  onSearch: (query: string, options: SearchOptions) => SearchResult;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => number;
  onNavigate: (direction: 'next' | 'prev') => void;
  matchCount: number;
  currentMatch: number;
  showReplace?: boolean;
  allowReplace?: boolean;
  initialQuery?: string;
  initialOptions?: SearchOptions;
}

export interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
}

export interface SearchResult {
  matches: Array<{ start: number; end: number }>;
  error?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onClose,
  onSearch,
  onReplace,
  onReplaceAll,
  onNavigate,
  matchCount,
  currentMatch,
  showReplace: initialShowReplace = false,
  allowReplace = true,
  initialQuery = '',
  initialOptions,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [replaceQuery, setReplaceQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(initialOptions?.caseSensitive ?? false);
  const [useRegex, setUseRegex] = useState(initialOptions?.useRegex ?? false);
  const [showReplace, setShowReplace] = useState(initialShowReplace && allowReplace);
  const [regexError, setRegexError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Perform search when query or options change
  useEffect(() => {
    if (searchQuery) {
      const result = onSearch(searchQuery, { caseSensitive, useRegex });
      setRegexError(result.error || null);
    } else {
      onSearch('', { caseSensitive, useRegex });
      setRegexError(null);
    }
  }, [searchQuery, caseSensitive, useRegex, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          onNavigate('prev');
        } else {
          onNavigate('next');
        }
      } else if (e.key === 'F3' || (e.key === 'g' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        if (e.shiftKey) {
          onNavigate('prev');
        } else {
          onNavigate('next');
        }
      }
    },
    [onClose, onNavigate]
  );

  const handleReplace = useCallback(() => {
    onReplace(replaceQuery);
  }, [onReplace, replaceQuery]);

  const handleReplaceAll = useCallback(() => {
    onReplaceAll(replaceQuery);
  }, [onReplaceAll, replaceQuery]);

  return (
    <div className="search-bar" onKeyDown={handleKeyDown}>
      <div className="search-bar-row">
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            className={`search-input ${regexError ? 'error' : ''}`}
            placeholder="Find"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search"
          />
          <div className="search-options">
            <button
              className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match Case (Alt+C)"
              aria-label="Match Case"
              aria-pressed={caseSensitive}
            >
              Aa
            </button>
            <button
              className={`search-option-btn ${useRegex ? 'active' : ''}`}
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression (Alt+R)"
              aria-label="Use Regular Expression"
              aria-pressed={useRegex}
            >
              .*
            </button>
          </div>
        </div>
        <div className="search-nav">
          <span className="search-count">
            {searchQuery
              ? matchCount > 0
                ? `${currentMatch} of ${matchCount}`
                : 'No results'
              : ''}
          </span>
          <button
            className="search-nav-btn"
            onClick={() => onNavigate('prev')}
            disabled={matchCount === 0}
            title="Previous Match (Shift+Enter)"
            aria-label="Previous Match"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.427 9.573l3.396-3.396a.25.25 0 01.354 0l3.396 3.396a.25.25 0 01-.177.427H4.604a.25.25 0 01-.177-.427z" />
            </svg>
          </button>
          <button
            className="search-nav-btn"
            onClick={() => onNavigate('next')}
            disabled={matchCount === 0}
            title="Next Match (Enter)"
            aria-label="Next Match"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.573 6.427l-3.396 3.396a.25.25 0 01-.354 0L4.427 6.427a.25.25 0 01.177-.427h6.792a.25.25 0 01.177.427z" />
            </svg>
          </button>
          {allowReplace && (
            <button
              className={`search-expand-btn ${showReplace ? 'expanded' : ''}`}
              onClick={() => setShowReplace(!showReplace)}
              title={showReplace ? 'Hide Replace' : 'Show Replace'}
              aria-label={showReplace ? 'Hide Replace' : 'Show Replace'}
              aria-expanded={showReplace}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
              </svg>
            </button>
          )}
          <button
            className="search-close-btn"
            onClick={onClose}
            title="Close (Escape)"
            aria-label="Close Search"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      </div>
      {showReplace && (
        <div className="search-bar-row replace-row">
          <div className="search-input-container">
            <input
              type="text"
              className="search-input replace-input"
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              aria-label="Replace"
            />
          </div>
          <div className="replace-actions">
            <button
              className="replace-btn"
              onClick={handleReplace}
              disabled={matchCount === 0}
              title="Replace"
              aria-label="Replace"
            >
              Replace
            </button>
            <button
              className="replace-btn"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              title="Replace All"
              aria-label="Replace All"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
      {regexError && <div className="search-error">{regexError}</div>}
    </div>
  );
};

export default SearchBar;
