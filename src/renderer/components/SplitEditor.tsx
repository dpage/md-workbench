//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import MarkdownViewer, { SearchHighlightOptions } from './MarkdownViewer';
import SearchBar, { SearchOptions, SearchResult } from './SearchBar';

// Helper to escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface SplitEditorProps {
  content: string;
  fileName: string;
  filePath: string;
  onContentChange?: (newContent: string) => void;
  showSearch?: boolean;
  showReplace?: boolean;
  onCloseSearch?: () => void;
  initialSearchQuery?: string;
  initialSearchOptions?: SearchOptions;
  initialMatchIndex?: number;
  onSearchStateChange?: (query: string, options: SearchOptions) => void;
  onCurrentMatchChange?: (matchIndex: number, totalMatches: number) => void;
}

interface Match {
  start: number;
  end: number;
}

const SplitEditor: React.FC<SplitEditorProps> = ({
  content,
  fileName,
  filePath,
  onContentChange,
  showSearch = false,
  showReplace = false,
  onCloseSearch,
  initialSearchQuery = '',
  initialSearchOptions,
  initialMatchIndex = 0,
  onSearchStateChange,
  onCurrentMatchChange,
}) => {
  const [splitRatio, setSplitRatio] = useState(0.5); // 0-1, left panel width ratio
  const [isDragging, setIsDragging] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(initialMatchIndex);
  const [lastSearchQuery, setLastSearchQuery] = useState(initialSearchQuery);
  const [lastSearchOptions, setLastSearchOptions] = useState<SearchOptions>(
    initialSearchOptions ?? { caseSensitive: false, useRegex: false }
  );
  const hasScrolledToInitialMatchRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Update local content when prop changes (e.g., file reload)
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  // Report match index changes to parent
  useEffect(() => {
    onCurrentMatchChange?.(currentMatchIndex, matches.length);
  }, [currentMatchIndex, matches.length, onCurrentMatchChange]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setEditedContent(newContent);
      onContentChange?.(newContent);
    },
    [onContentChange]
  );

  // Handle divider drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newRatio = Math.max(0.15, Math.min(0.85, x / rect.width));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Synchronized scrolling
  const syncScroll = useCallback((source: 'source' | 'rendered') => {
    if (isScrollingSyncRef.current) return;

    const sourceEl = textareaRef.current;
    const renderedEl = renderedRef.current?.querySelector('.markdown-viewer');

    if (!sourceEl || !renderedEl) return;

    isScrollingSyncRef.current = true;

    const sourcePanel = source === 'source' ? sourceEl : renderedEl;
    const targetPanel = source === 'source' ? renderedEl : sourceEl;

    const sourceMaxScroll = sourcePanel.scrollHeight - sourcePanel.clientHeight;
    const targetMaxScroll = targetPanel.scrollHeight - targetPanel.clientHeight;

    if (sourceMaxScroll <= 0 || targetMaxScroll <= 0) {
      isScrollingSyncRef.current = false;
      return;
    }

    // Calculate scroll ratio (0 = top, 1 = bottom)
    const scrollRatio = sourcePanel.scrollTop / sourceMaxScroll;

    // Apply same ratio to target
    targetPanel.scrollTop = scrollRatio * targetMaxScroll;

    // Reset flag after a short delay to allow the scroll event to settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false;
      });
    });
  }, []);

  const handleSourceScroll = useCallback(() => {
    syncScroll('source');
    // Also sync highlight overlay
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }, [syncScroll]);

  const handleRenderedScroll = useCallback(() => {
    syncScroll('rendered');
  }, [syncScroll]);

  // Attach scroll listener to rendered panel's markdown-viewer
  useEffect(() => {
    const renderedEl = renderedRef.current?.querySelector('.markdown-viewer');
    if (!renderedEl) return;

    renderedEl.addEventListener('scroll', handleRenderedScroll);
    return () => {
      renderedEl.removeEventListener('scroll', handleRenderedScroll);
    };
  }, [handleRenderedScroll]);

  // Search functionality
  const handleSearch = useCallback(
    (query: string, options: SearchOptions): SearchResult => {
      setLastSearchQuery(query);
      setLastSearchOptions(options);
      onSearchStateChange?.(query, options);

      if (!query) {
        setMatches([]);
        setCurrentMatchIndex(0);
        return { matches: [] };
      }

      try {
        let searchRegex: RegExp;
        if (options.useRegex) {
          searchRegex = new RegExp(
            query,
            options.caseSensitive ? 'g' : 'gi'
          );
        } else {
          // Escape special regex characters for literal search
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(
            escapedQuery,
            options.caseSensitive ? 'g' : 'gi'
          );
        }

        const newMatches: Match[] = [];
        let match;
        while ((match = searchRegex.exec(editedContent)) !== null) {
          newMatches.push({ start: match.index, end: match.index + match[0].length });
          // Prevent infinite loop for zero-length matches
          if (match[0].length === 0) {
            searchRegex.lastIndex++;
          }
        }

        setMatches(newMatches);
        // Don't change currentMatchIndex here - let it preserve the initial value
        // or the value set by navigation. Only reset if out of bounds or no matches.
        if (newMatches.length === 0) {
          setCurrentMatchIndex(0);
        } else {
          // Use functional update to check if current index is still valid
          setCurrentMatchIndex(prev => {
            if (prev >= 0 && prev < newMatches.length) {
              return prev; // Keep current index if valid
            }
            return 0; // Reset to first match if out of bounds
          });
        }

        return { matches: newMatches };
      } catch (error) {
        setMatches([]);
        setCurrentMatchIndex(0);
        return {
          matches: [],
          error: error instanceof Error ? error.message : 'Invalid regex',
        };
      }
    },
    [editedContent, onSearchStateChange]
  );

  // Select and scroll to a match
  const selectMatch = useCallback((match: Match) => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    const renderedPanel = renderedRef.current;
    if (!textarea) return;

    // Prevent scroll sync from interfering while we position both panels
    isScrollingSyncRef.current = true;

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);

    // Use requestAnimationFrame to ensure the highlight overlay has been updated
    // with the new currentMatchIndex before we try to find the mark element
    requestAnimationFrame(() => {
      // Find the current highlight mark in the overlay and use its position
      // This is more accurate than line-based calculation as it accounts for line wrapping
      const currentMark = highlight?.querySelector('mark.search-highlight-current');

      if (currentMark && highlight) {
        // Get the mark's position relative to the highlight container
        const markRect = currentMark.getBoundingClientRect();
        const highlightRect = highlight.getBoundingClientRect();

        // Calculate the mark's position within the scrollable content
        const markTopInContent = highlight.scrollTop + (markRect.top - highlightRect.top);

        // Center the match in the viewport
        const viewportHeight = textarea.clientHeight;
        const scrollTop = Math.max(0, markTopInContent - viewportHeight / 2 + markRect.height / 2);

        textarea.scrollTop = scrollTop;
        highlight.scrollTop = scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
      }

      // Also scroll the preview panel to the corresponding match
      setTimeout(() => {
        if (renderedPanel) {
          // Look for either text highlight or URL match highlight
          const currentTextHighlight = renderedPanel.querySelector(
            'mark.search-highlight-current'
          );
          const currentUrlHighlight = renderedPanel.querySelector(
            'a.search-url-match-current'
          );
          const currentHighlight = currentTextHighlight || currentUrlHighlight;
          if (currentHighlight) {
            currentHighlight.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        }
      }, 50);
    });

    // Re-enable scroll sync after a longer delay to allow all scroll events to settle
    // (MarkdownViewer may also trigger scrollIntoView with smooth animation)
    setTimeout(() => {
      isScrollingSyncRef.current = false;
    }, 500);
  }, []);

  // Scroll to initial match when matches are first found
  useEffect(() => {
    if (!hasScrolledToInitialMatchRef.current && matches.length > 0 && initialSearchQuery) {
      hasScrolledToInitialMatchRef.current = true;
      // Use requestAnimationFrame to ensure DOM has updated with highlights
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const match = matches[currentMatchIndex];
          if (match) {
            selectMatch(match);
          }
        });
      });
    }
  }, [matches, currentMatchIndex, initialSearchQuery, selectMatch]);

  // Navigate between matches
  const handleNavigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (matches.length === 0) return;

      let newIndex: number;
      if (direction === 'next') {
        newIndex = (currentMatchIndex + 1) % matches.length;
      } else {
        newIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
      }
      setCurrentMatchIndex(newIndex);
      selectMatch(matches[newIndex]);
    },
    [matches, currentMatchIndex, selectMatch]
  );

  // Replace current match
  const handleReplace = useCallback(
    (replacement: string) => {
      if (matches.length === 0) return;

      const match = matches[currentMatchIndex];
      const newContent =
        editedContent.substring(0, match.start) +
        replacement +
        editedContent.substring(match.end);

      setEditedContent(newContent);
      onContentChange?.(newContent);

      // Re-run search to update matches
      setTimeout(() => {
        handleSearch(lastSearchQuery, lastSearchOptions);
      }, 0);
    },
    [matches, currentMatchIndex, editedContent, onContentChange, handleSearch, lastSearchQuery, lastSearchOptions]
  );

  // Replace all matches
  const handleReplaceAll = useCallback(
    (replacement: string): number => {
      if (matches.length === 0) return 0;

      // Replace from end to start to maintain correct indices
      const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
      let newContent = editedContent;
      for (const match of sortedMatches) {
        newContent =
          newContent.substring(0, match.start) +
          replacement +
          newContent.substring(match.end);
      }

      setEditedContent(newContent);
      onContentChange?.(newContent);

      const count = matches.length;
      setMatches([]);
      setCurrentMatchIndex(0);

      return count;
    },
    [matches, editedContent, onContentChange]
  );

  // Close search bar
  const handleCloseSearch = useCallback(() => {
    setMatches([]);
    setCurrentMatchIndex(0);
    setLastSearchQuery('');
    onCloseSearch?.();
    textareaRef.current?.focus();
  }, [onCloseSearch]);

  // Search highlight options for MarkdownViewer
  const searchHighlight: SearchHighlightOptions | undefined = useMemo(() => {
    if (!lastSearchQuery) return undefined;
    return {
      query: lastSearchQuery,
      caseSensitive: lastSearchOptions.caseSensitive,
      useRegex: lastSearchOptions.useRegex,
    };
  }, [lastSearchQuery, lastSearchOptions]);

  // Generate highlighted content for the source editor overlay
  const highlightedSourceContent = useMemo(() => {
    if (matches.length === 0) {
      // Return content with HTML entities escaped, preserving whitespace
      return escapeHtml(editedContent) + '\n'; // Extra newline to match textarea behavior
    }

    // Build highlighted HTML
    const parts: string[] = [];
    let lastEnd = 0;

    matches.forEach((match, index) => {
      // Add text before match
      if (match.start > lastEnd) {
        parts.push(escapeHtml(editedContent.substring(lastEnd, match.start)));
      }
      // Add highlighted match
      const matchText = editedContent.substring(match.start, match.end);
      const className =
        index === currentMatchIndex
          ? 'search-highlight search-highlight-current'
          : 'search-highlight';
      parts.push(`<mark class="${className}">${escapeHtml(matchText)}</mark>`);
      lastEnd = match.end;
    });

    // Add remaining text
    if (lastEnd < editedContent.length) {
      parts.push(escapeHtml(editedContent.substring(lastEnd)));
    }

    return parts.join('') + '\n'; // Extra newline to match textarea behavior
  }, [editedContent, matches, currentMatchIndex]);

  // Sync highlight overlay scroll with textarea
  const syncHighlightScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`split-editor ${isDragging ? 'dragging' : ''}`}
    >
      {showSearch && (
        <SearchBar
          onClose={handleCloseSearch}
          onSearch={handleSearch}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
          onNavigate={handleNavigate}
          matchCount={matches.length}
          currentMatch={matches.length > 0 ? currentMatchIndex + 1 : 0}
          showReplace={showReplace}
          initialQuery={initialSearchQuery}
          initialOptions={initialSearchOptions}
        />
      )}
      <div className="split-editor-content">
        <div
          ref={sourceRef}
          className="split-panel split-panel-source"
          style={{ width: `${splitRatio * 100}%` }}
        >
          <div className="source-editor-container">
            <div
              ref={highlightRef}
              className="source-editor-highlight"
              dangerouslySetInnerHTML={{ __html: highlightedSourceContent }}
            />
            <textarea
              ref={textareaRef}
              className="source-editor"
              value={editedContent}
              onChange={handleContentChange}
              onScroll={handleSourceScroll}
              spellCheck={false}
            />
          </div>
        </div>
        <div className="split-divider" onMouseDown={handleMouseDown}>
          <div className="split-divider-handle" />
        </div>
        <div
          ref={renderedRef}
          className="split-panel split-panel-rendered"
          style={{ width: `${(1 - splitRatio) * 100}%` }}
        >
          <MarkdownViewer
            content={editedContent}
            fileName={fileName}
            filePath={filePath}
            searchHighlight={searchHighlight}
            currentMatchIndex={currentMatchIndex}
          />
        </div>
      </div>
    </div>
  );
};

export default SplitEditor;
