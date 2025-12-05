//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { SearchOptions } from './SearchBar';
import hljs from 'highlight.js/lib/core';

// Import commonly used languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import less from 'highlight.js/lib/languages/less';
import ini from 'highlight.js/lib/languages/ini';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import plaintext from 'highlight.js/lib/languages/plaintext';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml); // HTML uses XML highlighter
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('less', less);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('dos', dos);
hljs.registerLanguage('plaintext', plaintext);

// Helper to escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface Match {
  start: number;
  end: number;
}

export interface SourceViewerProps {
  content: string;
  searchQuery?: string;
  searchOptions?: SearchOptions;
  initialMatchIndex?: number;
  onMatchChange?: (matchIndex: number, totalMatches: number) => void;
  highlightLanguage?: string;
}

const SourceViewer: React.FC<SourceViewerProps> = ({
  content,
  searchQuery = '',
  searchOptions = { caseSensitive: false, useRegex: false },
  initialMatchIndex = 0,
  onMatchChange,
  highlightLanguage = 'plaintext',
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(initialMatchIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Apply syntax highlighting to the content
  const syntaxHighlightedContent = useMemo(() => {
    if (!content) return '';

    try {
      // Check if the language is registered
      const lang = hljs.getLanguage(highlightLanguage) ? highlightLanguage : 'plaintext';
      const result = hljs.highlight(content, { language: lang });
      return result.value;
    } catch {
      // Fallback to escaped HTML if highlighting fails
      return escapeHtml(content);
    }
  }, [content, highlightLanguage]);

  // Track if we've done initial match positioning
  const hasInitializedRef = useRef(false);

  // Perform search when query or options change
  useEffect(() => {
    if (!searchQuery) {
      setMatches([]);
      setCurrentMatchIndex(0);
      hasInitializedRef.current = false;
      return;
    }

    try {
      let searchRegex: RegExp;
      if (searchOptions.useRegex) {
        searchRegex = new RegExp(searchQuery, searchOptions.caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchRegex = new RegExp(escapedQuery, searchOptions.caseSensitive ? 'g' : 'gi');
      }

      const newMatches: Match[] = [];
      let match;
      while ((match = searchRegex.exec(content)) !== null) {
        newMatches.push({ start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) searchRegex.lastIndex++;
      }

      setMatches(newMatches);
      if (newMatches.length > 0) {
        // Only use initialMatchIndex on first search, not on subsequent updates
        if (!hasInitializedRef.current) {
          const validIndex = initialMatchIndex >= 0 && initialMatchIndex < newMatches.length
            ? initialMatchIndex
            : 0;
          setCurrentMatchIndex(validIndex);
          hasInitializedRef.current = true;
        } else {
          // Keep current index if still valid, otherwise reset to 0
          setCurrentMatchIndex(prev =>
            prev >= 0 && prev < newMatches.length ? prev : 0
          );
        }
      } else {
        setCurrentMatchIndex(0);
      }
    } catch {
      setMatches([]);
      setCurrentMatchIndex(0);
    }
  }, [searchQuery, searchOptions, content, initialMatchIndex]);

  // Report match changes to parent - only when search is active
  useEffect(() => {
    if (searchQuery) {
      onMatchChange?.(currentMatchIndex, matches.length);
    }
  }, [searchQuery, currentMatchIndex, matches.length, onMatchChange]);

  // Scroll to a match by finding the mark in the highlight overlay and syncing both elements
  const scrollToCurrentMatch = useCallback(() => {
    const highlight = highlightRef.current;
    const pre = preRef.current;
    if (!highlight || !pre) return;

    const currentMark = highlight.querySelector('mark.search-highlight-current');
    if (!currentMark) return;

    // Get the mark's position relative to the highlight container
    const markRect = currentMark.getBoundingClientRect();
    const highlightRect = highlight.getBoundingClientRect();

    // Calculate where the mark is in the scrollable content
    const markTopInContent = highlight.scrollTop + (markRect.top - highlightRect.top);

    // Center the match in the viewport
    const viewportHeight = pre.clientHeight;
    const scrollTop = Math.max(0, markTopInContent - viewportHeight / 2 + markRect.height / 2);

    // Scroll both elements to the same position
    pre.scrollTop = scrollTop;
    highlight.scrollTop = scrollTop;
  }, []);

  // Navigate to match
  const navigateToMatch = useCallback((index: number) => {
    if (matches.length === 0 || index < 0 || index >= matches.length) return;

    setCurrentMatchIndex(index);

    // Scroll to the current match after render
    requestAnimationFrame(() => {
      scrollToCurrentMatch();
    });
  }, [matches.length, scrollToCurrentMatch]);

  // Navigate to next/prev match (exposed via ref or callback could be added if needed)
  const navigateNext = useCallback(() => {
    if (matches.length === 0) return;
    const newIndex = (currentMatchIndex + 1) % matches.length;
    navigateToMatch(newIndex);
  }, [matches.length, currentMatchIndex, navigateToMatch]);

  const navigatePrev = useCallback(() => {
    if (matches.length === 0) return;
    const newIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    navigateToMatch(newIndex);
  }, [matches.length, currentMatchIndex, navigateToMatch]);

  // Allow keyboard navigation within the source viewer
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'F3' || (e.key === 'g' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      if (e.shiftKey) {
        navigatePrev();
      } else {
        navigateNext();
      }
    }
  }, [navigateNext, navigatePrev]);

  // Generate content with search highlights applied on top of syntax highlighting
  const highlightedContent = useMemo(() => {
    // If no search matches, just return syntax highlighted content
    if (matches.length === 0) {
      return syntaxHighlightedContent;
    }

    // For search highlighting, we need to work with the original content
    // and apply search highlights, then syntax highlight the segments between matches
    // This is complex because syntax highlighting produces HTML, and we need to
    // inject search highlights into it.
    //
    // A simpler approach: create a separate search highlight layer that uses
    // the same positioning. We'll overlay the search highlights on top.
    //
    // For now, use plain text with search highlights when searching is active
    const parts: string[] = [];
    let lastEnd = 0;

    matches.forEach((match, index) => {
      if (match.start > lastEnd) {
        parts.push(escapeHtml(content.substring(lastEnd, match.start)));
      }
      const matchText = content.substring(match.start, match.end);
      const className =
        index === currentMatchIndex
          ? 'search-highlight search-highlight-current'
          : 'search-highlight';
      parts.push(`<mark class="${className}">${escapeHtml(matchText)}</mark>`);
      lastEnd = match.end;
    });

    if (lastEnd < content.length) {
      parts.push(escapeHtml(content.substring(lastEnd)));
    }

    return parts.join('');
  }, [content, syntaxHighlightedContent, matches, currentMatchIndex]);

  // Sync scroll between pre and highlight overlay
  const handleScroll = useCallback(() => {
    const pre = preRef.current;
    const highlight = highlightRef.current;
    if (pre && highlight) {
      highlight.scrollTop = pre.scrollTop;
      highlight.scrollLeft = pre.scrollLeft;
    }
  }, []);

  // Scroll to current match on mount or when matches change
  useEffect(() => {
    if (searchQuery && matches.length > 0) {
      // Use double requestAnimationFrame to ensure the DOM has fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToCurrentMatch();
        });
      });
    }
  }, [searchQuery, matches.length, currentMatchIndex, scrollToCurrentMatch]);

  // Determine if we're showing search results (plain text) or syntax highlighted content
  const isSearching = matches.length > 0;

  return (
    <div
      ref={containerRef}
      className="source-viewer"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="source-viewer-container">
        <div
          ref={highlightRef}
          className={`source-viewer-highlight ${!isSearching ? 'syntax-highlighted' : ''}`}
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
        <pre
          ref={preRef}
          className="source-content"
          onScroll={handleScroll}
        >
          {content}
        </pre>
      </div>
    </div>
  );
};

export default SourceViewer;
