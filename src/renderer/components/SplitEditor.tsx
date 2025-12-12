//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useRef, useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import MarkdownViewer, { SearchHighlightOptions } from './MarkdownViewer';
import SearchBar, { SearchOptions, SearchResult } from './SearchBar';
import FormattingToolbar from './FormattingToolbar';
import { FormattingResult } from '../utils/markdownFormatting';
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
hljs.registerLanguage('html', xml);
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

interface CursorPosition {
  line: number;
  column: number;
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
  onCursorPositionChange?: (position: CursorPosition) => void;
  supportsFormatting?: boolean;
  supportsRenderedView?: boolean;
  highlightLanguage?: string;
  autoSave?: boolean;
  onAutoSave?: () => void;
  onFormat?: () => void;
  formatOnSave?: boolean;
  showLineNumbers?: boolean;
  showColumnRuler?: boolean;
  showCurrentLineHighlight?: boolean;
  maxLineLength?: number;
  softWrap?: boolean;
  formattingShortcuts?: boolean;
}

interface Match {
  start: number;
  end: number;
}

// Undo/redo history entry
interface HistoryEntry {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

const MAX_UNDO_STACK_SIZE = 100;

// Handle exposed to parent for imperative actions
export interface SplitEditorHandle {
  focus: () => void;
}

const SplitEditor = forwardRef<SplitEditorHandle, SplitEditorProps>(({
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
  onCursorPositionChange,
  supportsFormatting = true,
  supportsRenderedView = true,
  highlightLanguage = 'markdown',
  autoSave = false,
  onAutoSave,
  onFormat,
  formatOnSave = false,
  showLineNumbers = true,
  showColumnRuler = true,
  showCurrentLineHighlight = true,
  maxLineLength = 79,
  softWrap = false,
  formattingShortcuts = true,
}, ref) => {
  const [splitRatio, setSplitRatio] = useState(0.5); // 0-1, left panel width ratio
  const [isDragging, setIsDragging] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  // Debounced content for the preview - only updates 500ms after typing stops
  const [previewContent, setPreviewContent] = useState(content);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(initialMatchIndex);
  const [lastSearchQuery, setLastSearchQuery] = useState(initialSearchQuery);
  const [lastSearchOptions, setLastSearchOptions] = useState<SearchOptions>(
    initialSearchOptions ?? { caseSensitive: false, useRegex: false }
  );
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const hasScrolledToInitialMatchRef = useRef(false);
  const parentUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  // Track recent keystrokes for multi-character formatting shortcuts (**, ~~, ```)
  const recentKeysRef = useRef<Array<{ key: string; time: number }>>([]);
  // Track pending selection for formatting shortcuts (handles race condition with requestAnimationFrame)
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  // Count matches in TOC headings (for TOC marker badge)
  // This counts matches that appear in the rendered TOC (from headings)
  // Each heading in TOC has both text and an anchor URL, so we count both
  // Only relevant when there's a rendered view to show the TOC
  const tocMatchCount = useMemo(() => {
    if (!supportsRenderedView || matches.length === 0 || !lastSearchQuery) return 0;

    // Extract headings from markdown content
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: string[] = [];
    let headingMatch;
    while ((headingMatch = headingRegex.exec(editedContent)) !== null) {
      headings.push(headingMatch[2].trim());
    }

    if (headings.length === 0) return 0;

    // Build search regex
    let searchRegex: RegExp;
    try {
      if (lastSearchOptions.useRegex) {
        searchRegex = new RegExp(lastSearchQuery, lastSearchOptions.caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = lastSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchRegex = new RegExp(escapedQuery, lastSearchOptions.caseSensitive ? 'g' : 'gi');
      }
    } catch {
      return 0;
    }

    // Count matches in headings (both anchor URL and text)
    // Order matters: URL matches come first to match preview's sorting
    let count = 0;
    for (const heading of headings) {
      // Count matches in the generated anchor URL first
      // The anchor is the heading text converted to lowercase, spaces to hyphens
      const anchor = heading.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      searchRegex.lastIndex = 0;
      let match;
      while ((match = searchRegex.exec(anchor)) !== null) {
        count++;
        if (match[0].length === 0) searchRegex.lastIndex++;
      }

      // Then count matches in the heading text
      searchRegex.lastIndex = 0;
      while ((match = searchRegex.exec(heading)) !== null) {
        count++;
        if (match[0].length === 0) searchRegex.lastIndex++;
      }
    }

    return count;
  }, [supportsRenderedView, editedContent, matches.length, lastSearchQuery, lastSearchOptions]);

  // Track which matches are in footnote definitions (for preview sync)
  // Navigation stays in source order - editor is linear, preview jumps to footnotes
  const { isFootnoteMatchArray, footnoteMatchCount, nonFootnoteMatchCount } = useMemo(() => {
    if (matches.length === 0) {
      return { isFootnoteMatchArray: [], footnoteMatchCount: 0, nonFootnoteMatchCount: 0 };
    }

    // Find all footnote definition ranges in the content
    const footnoteRanges: Array<{ start: number; end: number }> = [];
    const lines = editedContent.split('\n');
    let charOffset = 0;
    let inFootnote = false;
    let footnoteStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = charOffset;

      // Check if this line starts a footnote definition
      const isFootnoteDefStart = /^\[\^[^\]]+\]:/.test(line);

      if (isFootnoteDefStart) {
        if (inFootnote) {
          footnoteRanges.push({ start: footnoteStart, end: lineStart - 1 });
        }
        inFootnote = true;
        footnoteStart = lineStart;
      } else if (inFootnote) {
        const isContinuation = line === '' || /^[ \t]/.test(line);
        if (!isContinuation && line.trim() !== '') {
          footnoteRanges.push({ start: footnoteStart, end: lineStart - 1 });
          inFootnote = false;
        }
      }

      charOffset += line.length + 1;
    }

    if (inFootnote) {
      footnoteRanges.push({ start: footnoteStart, end: charOffset - 1 });
    }

    // For each match, track if it's in a footnote definition
    const isFootnoteArray: boolean[] = [];
    let fnCount = 0;
    let nonFnCount = 0;

    matches.forEach((match) => {
      const inFn = footnoteRanges.some(
        range => match.start >= range.start && match.end <= range.end
      );
      isFootnoteArray.push(inFn);
      if (inFn) fnCount++;
      else nonFnCount++;
    });

    return {
      isFootnoteMatchArray: isFootnoteArray,
      footnoteMatchCount: fnCount,
      nonFootnoteMatchCount: nonFnCount
    };
  }, [matches, editedContent]);

  // Whether current match index is in TOC range (virtual matches at start)
  const isCurrentMatchInToc = currentMatchIndex < tocMatchCount;

  // Physical match index in source (after TOC offset)
  const physicalMatchIndex = currentMatchIndex >= tocMatchCount
    ? currentMatchIndex - tocMatchCount
    : -1;

  // Whether current match is in a footnote definition (check the array)
  const isCurrentMatchInFootnote = physicalMatchIndex >= 0 &&
    physicalMatchIndex < isFootnoteMatchArray.length &&
    isFootnoteMatchArray[physicalMatchIndex];

  // Calculate which footnote match number this is (for preview sync)
  const currentFootnoteMatchIndex = useMemo(() => {
    if (!isCurrentMatchInFootnote || physicalMatchIndex < 0) return 0;
    // Count how many footnote matches come before this one
    let count = 0;
    for (let i = 0; i < physicalMatchIndex; i++) {
      if (isFootnoteMatchArray[i]) count++;
    }
    return count;
  }, [isCurrentMatchInFootnote, physicalMatchIndex, isFootnoteMatchArray]);

  // Calculate which non-footnote match number this is (for preview sync)
  const currentNonFootnoteMatchIndex = useMemo(() => {
    if (isCurrentMatchInFootnote || physicalMatchIndex < 0) return 0;
    // Count how many non-footnote matches come before this one
    let count = 0;
    for (let i = 0; i < physicalMatchIndex; i++) {
      if (!isFootnoteMatchArray[i]) count++;
    }
    return count;
  }, [isCurrentMatchInFootnote, physicalMatchIndex, isFootnoteMatchArray]);

  // DEBUG: Log match classification
  console.log('[Editor] currentMatchIndex:', currentMatchIndex, 'tocMatchCount:', tocMatchCount, 'physicalMatchIndex:', physicalMatchIndex);
  console.log('[Editor] isCurrentMatchInToc:', isCurrentMatchInToc, 'isCurrentMatchInFootnote:', isCurrentMatchInFootnote);
  console.log('[Editor->Preview] footnoteMatchIndex:', currentFootnoteMatchIndex, 'nonFootnoteMatchIndex:', currentNonFootnoteMatchIndex);

  // Calculate current line number based on cursor position
  const currentLineNumber = useMemo(() => {
    const textBeforeCursor = editedContent.substring(0, selectionStart);
    return textBeforeCursor.split('\n').length - 1; // 0-indexed line number
  }, [editedContent, selectionStart]);

  // Calculate column number (position within the current line)
  const currentColumn = useMemo(() => {
    const textBeforeCursor = editedContent.substring(0, selectionStart);
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
    return selectionStart - lastNewlineIndex; // 1-indexed column
  }, [editedContent, selectionStart]);

  // Calculate total line count for line numbers gutter
  const lineCount = useMemo(() => {
    return editedContent.split('\n').length;
  }, [editedContent]);

  // Get current line content for wrapped height measurement
  const currentLineContent = useMemo(() => {
    const lines = editedContent.split('\n');
    return lines[currentLineNumber] || '';
  }, [editedContent, currentLineNumber]);

  // Ref for measuring wrapped line height
  const lineMeasureRef = useRef<HTMLDivElement>(null);

  // Measured metrics for wrapped lines (top position and height)
  const [wrappedMetrics, setWrappedMetrics] = useState<{ top: number; height: number } | null>(null);

  // Heights of all lines for soft wrap line numbers gutter
  const [lineHeights, setLineHeights] = useState<number[] | null>(null);

  // Measure all line heights for the line numbers gutter when soft wrap is enabled
  useEffect(() => {
    if (!softWrap || !showLineNumbers) {
      setLineHeights(null);
      return;
    }

    const measureAllHeights = () => {
      const measureDiv = lineMeasureRef.current;
      if (!measureDiv) {
        setLineHeights(null);
        return;
      }

      const lines = editedContent.split('\n');
      const heights: number[] = [];

      for (const line of lines) {
        measureDiv.textContent = line || '\u200B';
        heights.push(measureDiv.offsetHeight);
      }

      setLineHeights(heights);
    };

    requestAnimationFrame(measureAllHeights);
  }, [softWrap, showLineNumbers, editedContent, splitRatio]);

  // Measure the current line's position and height when soft wrap is enabled
  useEffect(() => {
    if (!softWrap) {
      setWrappedMetrics(null);
      return;
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const measureMetrics = () => {
      const measureDiv = lineMeasureRef.current;
      if (!measureDiv) {
        setWrappedMetrics(null);
        return;
      }

      const lines = editedContent.split('\n');

      // Measure a single line height for reference
      measureDiv.textContent = 'M';
      const singleLineHeight = measureDiv.offsetHeight;

      // Calculate character offset where current line starts
      // This preserves empty lines correctly (unlike join which loses them)
      let charOffset = 0;
      for (let i = 0; i < currentLineNumber; i++) {
        charOffset += lines[i].length + 1; // +1 for newline
      }

      // Measure cumulative height of all lines BEFORE the current line
      let topPosition: number;
      if (charOffset > 0) {
        // Use actual substring to preserve empty lines
        // Add placeholder char to ensure trailing newlines render as visual lines
        measureDiv.textContent = editedContent.substring(0, charOffset) + 'M';
        // Subtract the placeholder line's height
        topPosition = measureDiv.offsetHeight - singleLineHeight;
      } else {
        topPosition = 0;
      }

      // Measure height of current line
      measureDiv.textContent = currentLineContent || '\u200B';
      const lineHeight = measureDiv.offsetHeight;

      setWrappedMetrics({
        top: topPosition,
        height: lineHeight > 0 ? lineHeight : singleLineHeight,
      });
    };

    requestAnimationFrame(measureMetrics);
  }, [softWrap, showLineNumbers, editedContent, currentLineNumber, currentLineContent, splitRatio]);

  // Ref for line numbers gutter to sync scrolling
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Report cursor position changes to parent
  useEffect(() => {
    onCursorPositionChange?.({
      line: currentLineNumber + 1, // Convert to 1-indexed
      column: currentColumn,
    });
  }, [currentLineNumber, currentColumn, onCursorPositionChange]);

  // Undo/redo stacks for formatting operations
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);

  // Keep content ref in sync for FormattingToolbar
  useEffect(() => {
    contentRef.current = editedContent;
  }, [editedContent]);

  // Debounced update to parent - prevents App re-render cascade on every keystroke
  const debouncedParentUpdate = useCallback(
    (newContent: string) => {
      if (parentUpdateTimerRef.current) {
        clearTimeout(parentUpdateTimerRef.current);
      }
      parentUpdateTimerRef.current = setTimeout(() => {
        onContentChange?.(newContent);
      }, 300);
    },
    [onContentChange]
  );

  // Push current state to undo stack - reads directly from DOM to avoid stale state
  const pushToUndoStack = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) {
      return;
    }
    const entry: HistoryEntry = {
      content: contentRef.current,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    };
    undoStackRef.current.push(entry);
    // Limit stack size
    if (undoStackRef.current.length > MAX_UNDO_STACK_SIZE) {
      undoStackRef.current.shift();
    }
    // Clear redo stack when new action is performed
    redoStackRef.current = [];
  }, []);

  // Undo function
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Push current state to redo stack
    redoStackRef.current.push({
      content: editedContent,
      selectionStart,
      selectionEnd,
    });

    // Pop from undo stack
    const entry = undoStackRef.current.pop()!;

    // Restore state
    setEditedContent(entry.content);
    contentRef.current = entry.content;

    // Clear pending debounces and update immediately
    if (parentUpdateTimerRef.current) {
      clearTimeout(parentUpdateTimerRef.current);
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    onContentChange?.(entry.content);
    setPreviewContent(entry.content);

    // Trigger auto-save if enabled (but not for untitled files)
    if (autoSave && onAutoSave && filePath) {
      onAutoSave();
    }

    // Restore selection
    requestAnimationFrame(() => {
      textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
      setSelectionStart(entry.selectionStart);
      setSelectionEnd(entry.selectionEnd);
    });
  }, [editedContent, selectionStart, selectionEnd, onContentChange, autoSave, onAutoSave, filePath]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Push current state to undo stack
    undoStackRef.current.push({
      content: editedContent,
      selectionStart,
      selectionEnd,
    });

    // Pop from redo stack
    const entry = redoStackRef.current.pop()!;

    // Restore state
    setEditedContent(entry.content);
    contentRef.current = entry.content;

    // Clear pending debounces and update immediately
    if (parentUpdateTimerRef.current) {
      clearTimeout(parentUpdateTimerRef.current);
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    onContentChange?.(entry.content);
    setPreviewContent(entry.content);

    // Trigger auto-save if enabled (but not for untitled files)
    if (autoSave && onAutoSave && filePath) {
      onAutoSave();
    }

    // Restore selection
    requestAnimationFrame(() => {
      textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
      setSelectionStart(entry.selectionStart);
      setSelectionEnd(entry.selectionEnd);
    });
  }, [editedContent, selectionStart, selectionEnd, onContentChange, autoSave, onAutoSave, filePath]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (parentUpdateTimerRef.current) {
        clearTimeout(parentUpdateTimerRef.current);
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  // Handle keyboard shortcuts for undo/redo and formatting
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      if (modKey && key === 'z' && !e.shiftKey) {
        // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
        // Only intercept if we have something in our undo stack
        if (undoStackRef.current.length > 0) {
          e.preventDefault();
          handleUndo();
        }
        // Otherwise let native undo handle it
      } else if (modKey && e.shiftKey && key === 'z') {
        // Redo: Cmd+Shift+Z (Mac)
        if (redoStackRef.current.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      } else if (modKey && key === 'y') {
        // Redo: Ctrl+Y (Windows/Linux)
        if (redoStackRef.current.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      } else if (e.shiftKey && e.altKey && key === 'f') {
        // Format Document: Shift+Alt+F (matches VS Code)
        e.preventDefault();
        onFormat?.();
      } else if (formattingShortcuts && !modKey && !e.altKey) {
        // Formatting shortcuts - wrap selected text with formatting characters
        const textarea = e.currentTarget;
        // Use pending selection if available (handles race condition when typing quickly)
        // Otherwise fall back to DOM selection
        const pending = pendingSelectionRef.current;
        const start = pending?.start ?? textarea.selectionStart;
        const end = pending?.end ?? textarea.selectionEnd;
        const hasSelection = start !== end;

        // Only process if there's a selection
        if (hasSelection) {
          const now = Date.now();
          const formattingChars = ['*', '_', '~', '`'];

          if (formattingChars.includes(e.key)) {
            // Clean old keystrokes (older than 500ms)
            recentKeysRef.current = recentKeysRef.current.filter(
              k => now - k.time < 500
            );

            // Check for multi-character sequences
            const recentKeys = recentKeysRef.current;
            let wrapper = '';
            let shouldWrap = false;

            // Use contentRef for current content (handles race condition with React state)
            const currentContent = contentRef.current;
            const selectedText = currentContent.substring(start, end);

            if (e.key === '`') {
              // Check for ``` (code block)
              if (recentKeys.length >= 2 &&
                  recentKeys[recentKeys.length - 1].key === '`' &&
                  recentKeys[recentKeys.length - 2].key === '`') {
                wrapper = '```';
                shouldWrap = true;
                recentKeysRef.current = []; // Clear the buffer
              } else if (selectedText.startsWith('`') && selectedText.endsWith('`') &&
                         !selectedText.startsWith('``') && selectedText.length > 2) {
                // Selection is already wrapped with single ` - upgrade by adding one more on each side
                wrapper = '`';
                shouldWrap = true;
              } else {
                // Single backtick - inline code
                wrapper = '`';
                shouldWrap = true;
              }
            } else if (e.key === '*') {
              // Check if selection is already wrapped with single * (for upgrading to **)
              if (selectedText.startsWith('*') && selectedText.endsWith('*') &&
                  !selectedText.startsWith('**') && selectedText.length > 2) {
                // Upgrade from *text* to **text** by adding * on each side
                wrapper = '*';
                shouldWrap = true;
                recentKeysRef.current = []; // Clear buffer since we're upgrading
              } else if (recentKeys.length >= 1 &&
                  recentKeys[recentKeys.length - 1].key === '*') {
                wrapper = '**';
                shouldWrap = true;
                recentKeysRef.current = []; // Clear the buffer
              } else {
                // Single * - italic
                wrapper = '*';
                shouldWrap = true;
              }
            } else if (e.key === '~') {
              // Check if selection is already wrapped with single ~ (for upgrading to ~~)
              if (selectedText.startsWith('~') && selectedText.endsWith('~') &&
                  !selectedText.startsWith('~~') && selectedText.length > 2) {
                // Upgrade from ~text~ to ~~text~~ by adding ~ on each side
                wrapper = '~';
                shouldWrap = true;
                recentKeysRef.current = [];
              } else if (recentKeys.length >= 1 &&
                  recentKeys[recentKeys.length - 1].key === '~') {
                wrapper = '~~';
                shouldWrap = true;
                recentKeysRef.current = []; // Clear the buffer
              } else {
                // Single ~ - record it but don't wrap yet
                recentKeysRef.current.push({ key: e.key, time: now });
                e.preventDefault();
                return;
              }
            } else if (e.key === '_') {
              // Single _ - italic (alternative)
              wrapper = '_';
              shouldWrap = true;
            }

            if (shouldWrap && wrapper) {
              e.preventDefault();

              let newText: string;
              let newSelStart: number;
              let newSelEnd: number;

              if (wrapper === '```') {
                // Code block - need linefeeds
                const needsLeadingNewline = start > 0 && currentContent[start - 1] !== '\n';
                const needsTrailingNewline = end < currentContent.length && currentContent[end] !== '\n';
                const prefix = needsLeadingNewline ? '\n```\n' : '```\n';
                const suffix = needsTrailingNewline ? '\n```\n' : '\n```';
                newText = prefix + selectedText + suffix;
                // Move cursor to end for code blocks
                newSelStart = start + prefix.length + selectedText.length + suffix.length;
                newSelEnd = newSelStart;
              } else if (wrapper.length === 1) {
                // Single-char wrappers (*, `, _)
                // Keep the wrapped text selected for consistency
                newText = wrapper + selectedText + wrapper;
                newSelStart = start;
                newSelEnd = start + wrapper.length + selectedText.length + wrapper.length;
              } else {
                // Multi-char wrappers (**, ~~)
                // Move cursor to end
                newText = wrapper + selectedText + wrapper;
                newSelStart = start + wrapper.length + selectedText.length + wrapper.length;
                newSelEnd = newSelStart;
              }

              const newContent = currentContent.substring(0, start) + newText + currentContent.substring(end);

              // Push to undo stack
              pushToUndoStack(textarea);

              // Update content
              setEditedContent(newContent);
              contentRef.current = newContent;

              // Clear any pending debounced updates and update immediately
              if (parentUpdateTimerRef.current) {
                clearTimeout(parentUpdateTimerRef.current);
              }
              if (previewTimerRef.current) {
                clearTimeout(previewTimerRef.current);
              }
              onContentChange?.(newContent);
              setPreviewContent(newContent);

              // Store pending selection immediately (for race condition handling)
              // This allows the next keystroke to use correct selection even if
              // requestAnimationFrame hasn't fired yet
              pendingSelectionRef.current = { start: newSelStart, end: newSelEnd };

              // Set cursor/selection position
              requestAnimationFrame(() => {
                textarea.setSelectionRange(newSelStart, newSelEnd);
                setSelectionStart(newSelStart);
                setSelectionEnd(newSelEnd);
                // Clear pending selection after applying
                pendingSelectionRef.current = null;
              });

              return;
            }
          }

          // Record keystroke for multi-character detection
          if (['*', '~', '`'].includes(e.key)) {
            recentKeysRef.current.push({ key: e.key, time: now });
          }
        }
      }
    },
    [handleUndo, handleRedo, onFormat, formattingShortcuts, editedContent, onContentChange, pushToUndoStack]
  );

  // Track selection changes in textarea - only when selection actually changes
  const handleSelectionChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const newStart = textarea.selectionStart;
      const newEnd = textarea.selectionEnd;
      // Only update state if selection actually changed
      setSelectionStart(prev => prev !== newStart ? newStart : prev);
      setSelectionEnd(prev => prev !== newEnd ? newEnd : prev);
    }
  }, []);

  // Get current selection for formatting toolbar
  const getSelection = useCallback(() => {
    return {
      start: selectionStart,
      end: selectionEnd,
      text: editedContent.substring(selectionStart, selectionEnd),
    };
  }, [selectionStart, selectionEnd, editedContent]);

  // Handle formatting operations from toolbar
  const handleFormatting = useCallback(
    (result: FormattingResult) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Push current state to undo stack before making changes
      pushToUndoStack(textarea);

      // Update the content - immediate parent update for intentional actions
      setEditedContent(result.newContent);
      contentRef.current = result.newContent;
      // Clear any pending debounced updates and update immediately
      if (parentUpdateTimerRef.current) {
        clearTimeout(parentUpdateTimerRef.current);
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      onContentChange?.(result.newContent);
      setPreviewContent(result.newContent);

      // Focus the textarea and set the new selection
      textarea.focus();

      // Use requestAnimationFrame to ensure content is updated before setting selection
      requestAnimationFrame(() => {
        textarea.setSelectionRange(result.newSelectionStart, result.newSelectionEnd);
        setSelectionStart(result.newSelectionStart);
        setSelectionEnd(result.newSelectionEnd);
      });
    },
    [onContentChange, pushToUndoStack]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<HTMLDivElement>(null);
  const isScrollingSyncRef = useRef(false);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }), []);

  // Update local content when prop changes (e.g., file reload or format)
  // Only reset if content changed externally (not from our own edits)
  useEffect(() => {
    // If the content prop matches our current edited content, this is just
    // the parent syncing back our own edit - don't reset anything
    if (content === editedContent) {
      return;
    }
    // External change (file reload or format) - push to undo stack so user can undo
    undoStackRef.current.push({
      content: editedContent,
      selectionStart: textareaRef.current?.selectionStart ?? 0,
      selectionEnd: textareaRef.current?.selectionEnd ?? 0,
    });
    // Limit undo stack size
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift();
    }
    // Clear redo stack since we have a new "branch" in history
    redoStackRef.current = [];
    setEditedContent(content);
    setPreviewContent(content);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report match index changes to parent (includes TOC matches in total)
  useEffect(() => {
    onCurrentMatchChange?.(currentMatchIndex, matches.length + tocMatchCount);
  }, [currentMatchIndex, matches.length, tocMatchCount, onCurrentMatchChange]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setEditedContent(newContent);
      // Update selection state immediately to keep cursor position in sync
      // (prevents highlight jump when deleting/typing)
      setSelectionStart(e.target.selectionStart);
      setSelectionEnd(e.target.selectionEnd);
      // Debounce the parent update to prevent App re-render cascade on every keystroke
      debouncedParentUpdate(newContent);
      // Debounce preview update - only update after 500ms of no typing
      // Also trigger auto-save at this point if enabled
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      previewTimerRef.current = setTimeout(() => {
        setPreviewContent(newContent);
        // Auto-save after the debounce period (same timing as preview update)
        // But not for untitled files (empty filePath)
        if (autoSave && onAutoSave && filePath) {
          // Format before save if enabled
          if (formatOnSave && onFormat) {
            onFormat();
          }
          onAutoSave();
        }
      }, 500);
    },
    [debouncedParentUpdate, autoSave, onAutoSave, formatOnSave, onFormat, filePath]
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

  // Calculate line height from the editor
  const getLineHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return 22.4; // Default fallback (0.875rem * 1.6 line-height)
    const style = window.getComputedStyle(textarea);
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = parseFloat(style.lineHeight);
    return isNaN(lineHeight) ? fontSize * 1.6 : lineHeight;
  }, []);

  // Extract headings from markdown content with their character positions
  const extractHeadings = useCallback((content: string) => {
    const headings: Array<{ level: number; text: string; charOffset: number; lineIndex: number }> = [];
    const lines = content.split('\n');
    let charOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match markdown headings (# to ######)
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
          charOffset,
          lineIndex: i,
        });
      }
      charOffset += line.length + 1; // +1 for newline
    }

    return headings;
  }, []);

  // Find heading elements in the preview DOM with their positions
  const getPreviewHeadingPositions = useCallback((renderedEl: Element) => {
    const headingElements = renderedEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const positions: Array<{ text: string; top: number; element: Element }> = [];

    headingElements.forEach((el) => {
      // Get the text content, normalized for comparison
      const text = el.textContent?.trim() || '';
      // Get position relative to the scrollable container
      const rect = el.getBoundingClientRect();
      const containerRect = renderedEl.getBoundingClientRect();
      const top = rect.top - containerRect.top + renderedEl.scrollTop;
      positions.push({ text, top, element: el });
    });

    return positions;
  }, []);

  // Synchronized scrolling - syncs by finding nearest heading anchor point
  // When search is active, skip header-based sync - match navigation handles scrolling
  const syncScroll = useCallback((source: 'source' | 'rendered') => {
    if (isScrollingSyncRef.current) return;

    // Skip header-based sync during search - selectMatch handles both panels
    if (matches.length > 0 || tocMatchCount > 0) return;

    const sourceEl = textareaRef.current;
    const renderedEl = renderedRef.current?.querySelector('.markdown-viewer');

    if (!sourceEl || !renderedEl) return;

    isScrollingSyncRef.current = true;

    // When soft wrap is enabled, use simple scroll ratio since line-based calculations
    // don't work accurately (wrapped lines take more visual space than their line count suggests)
    if (softWrap) {
      const sourceMaxScroll = sourceEl.scrollHeight - sourceEl.clientHeight;
      const previewMaxScroll = renderedEl.scrollHeight - renderedEl.clientHeight;
      if (source === 'source') {
        if (sourceMaxScroll > 0) {
          const scrollRatio = sourceEl.scrollTop / sourceMaxScroll;
          renderedEl.scrollTop = scrollRatio * previewMaxScroll;
        }
      } else {
        if (previewMaxScroll > 0) {
          const scrollRatio = renderedEl.scrollTop / previewMaxScroll;
          sourceEl.scrollTop = scrollRatio * sourceMaxScroll;
        }
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isScrollingSyncRef.current = false;
        });
      });
      return;
    }

    const headings = extractHeadings(editedContent);
    const previewHeadings = getPreviewHeadingPositions(renderedEl);

    if (source === 'source') {
      // Scrolling from source editor to preview
      const lineHeight = getLineHeight();
      const padding = 24; // 1.5rem padding

      // Calculate which line is at the center of the visible editor
      const visibleTop = sourceEl.scrollTop;
      const visibleCenter = visibleTop + sourceEl.clientHeight / 2;
      const centerLineIndex = Math.floor((visibleCenter - padding) / lineHeight);

      // If no headings, fall back to ratio-based sync
      if (headings.length === 0 || previewHeadings.length === 0) {
        const lines = editedContent.split('\n');
        const totalLines = lines.length;
        if (totalLines > 1) {
          const lineFraction = Math.max(0, Math.min(1, centerLineIndex / (totalLines - 1)));
          const previewMaxScroll = renderedEl.scrollHeight - renderedEl.clientHeight;
          const targetScrollCenter = lineFraction * renderedEl.scrollHeight;
          const targetScrollTop = targetScrollCenter - renderedEl.clientHeight / 2;
          renderedEl.scrollTop = Math.max(0, Math.min(previewMaxScroll, targetScrollTop));
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            isScrollingSyncRef.current = false;
          });
        });
        return;
      }

      // Find the two headings that bracket our current position
      let beforeHeading: typeof headings[0] | null = null;
      let afterHeading: typeof headings[0] | null = null;

      for (let i = 0; i < headings.length; i++) {
        if (headings[i].lineIndex <= centerLineIndex) {
          beforeHeading = headings[i];
        }
        if (headings[i].lineIndex > centerLineIndex && !afterHeading) {
          afterHeading = headings[i];
          break;
        }
      }

      // Find corresponding headings in preview by text matching
      const findPreviewHeading = (heading: typeof headings[0]) => {
        return previewHeadings.find(ph =>
          ph.text.toLowerCase() === heading.text.toLowerCase()
        );
      };

      let targetScrollTop: number;

      if (beforeHeading && afterHeading) {
        // Interpolate between two headings
        const beforePreview = findPreviewHeading(beforeHeading);
        const afterPreview = findPreviewHeading(afterHeading);

        if (beforePreview && afterPreview) {
          // Calculate how far we are between the two source headings (by line)
          const sourceRange = afterHeading.lineIndex - beforeHeading.lineIndex;
          const sourceProgress = (centerLineIndex - beforeHeading.lineIndex) / sourceRange;

          // Apply same progress to preview heading positions
          const previewRange = afterPreview.top - beforePreview.top;
          const targetCenter = beforePreview.top + (sourceProgress * previewRange);
          targetScrollTop = targetCenter - renderedEl.clientHeight / 2;
        } else if (beforePreview) {
          // Only have before heading - estimate based on lines after it
          const linesAfterHeading = centerLineIndex - beforeHeading.lineIndex;
          const estimatedOffset = linesAfterHeading * lineHeight * 0.5; // Rough estimate
          targetScrollTop = beforePreview.top + estimatedOffset - renderedEl.clientHeight / 2;
        } else {
          // Fall back to ratio
          const lines = editedContent.split('\n');
          const lineFraction = centerLineIndex / (lines.length - 1);
          targetScrollTop = lineFraction * renderedEl.scrollHeight - renderedEl.clientHeight / 2;
        }
      } else if (beforeHeading) {
        // We're after all headings
        const beforePreview = findPreviewHeading(beforeHeading);
        if (beforePreview) {
          const linesAfterHeading = centerLineIndex - beforeHeading.lineIndex;
          const totalLinesAfter = editedContent.split('\n').length - beforeHeading.lineIndex;
          const remainingContent = renderedEl.scrollHeight - beforePreview.top;
          const progress = linesAfterHeading / totalLinesAfter;
          targetScrollTop = beforePreview.top + (progress * remainingContent) - renderedEl.clientHeight / 2;
        } else {
          const lines = editedContent.split('\n');
          const lineFraction = centerLineIndex / (lines.length - 1);
          targetScrollTop = lineFraction * renderedEl.scrollHeight - renderedEl.clientHeight / 2;
        }
      } else if (afterHeading) {
        // We're before all headings
        const afterPreview = findPreviewHeading(afterHeading);
        if (afterPreview) {
          const progress = centerLineIndex / afterHeading.lineIndex;
          targetScrollTop = progress * afterPreview.top - renderedEl.clientHeight / 2;
        } else {
          const lines = editedContent.split('\n');
          const lineFraction = centerLineIndex / (lines.length - 1);
          targetScrollTop = lineFraction * renderedEl.scrollHeight - renderedEl.clientHeight / 2;
        }
      } else {
        // No headings found - use ratio
        const lines = editedContent.split('\n');
        const lineFraction = centerLineIndex / (lines.length - 1);
        targetScrollTop = lineFraction * renderedEl.scrollHeight - renderedEl.clientHeight / 2;
      }

      const previewMaxScroll = renderedEl.scrollHeight - renderedEl.clientHeight;
      renderedEl.scrollTop = Math.max(0, Math.min(previewMaxScroll, targetScrollTop));
    } else {
      // Scrolling from preview to source editor - use reverse logic
      const previewScrollCenter = renderedEl.scrollTop + renderedEl.clientHeight / 2;

      // Find bracketing headings in preview
      let beforePreview: typeof previewHeadings[0] | null = null;
      let afterPreview: typeof previewHeadings[0] | null = null;

      for (let i = 0; i < previewHeadings.length; i++) {
        if (previewHeadings[i].top <= previewScrollCenter) {
          beforePreview = previewHeadings[i];
        }
        if (previewHeadings[i].top > previewScrollCenter && !afterPreview) {
          afterPreview = previewHeadings[i];
          break;
        }
      }

      const findSourceHeading = (previewHeading: typeof previewHeadings[0]) => {
        return headings.find(h =>
          h.text.toLowerCase() === previewHeading.text.toLowerCase()
        );
      };

      const lineHeight = getLineHeight();
      const padding = 24;
      let targetLineIndex: number;

      if (beforePreview && afterPreview) {
        const beforeSource = findSourceHeading(beforePreview);
        const afterSource = findSourceHeading(afterPreview);

        if (beforeSource && afterSource) {
          const previewRange = afterPreview.top - beforePreview.top;
          const previewProgress = (previewScrollCenter - beforePreview.top) / previewRange;
          const sourceRange = afterSource.lineIndex - beforeSource.lineIndex;
          targetLineIndex = beforeSource.lineIndex + (previewProgress * sourceRange);
        } else {
          const previewFraction = previewScrollCenter / renderedEl.scrollHeight;
          targetLineIndex = previewFraction * (editedContent.split('\n').length - 1);
        }
      } else if (beforePreview) {
        const beforeSource = findSourceHeading(beforePreview);
        if (beforeSource) {
          const remainingPreview = renderedEl.scrollHeight - beforePreview.top;
          const progress = (previewScrollCenter - beforePreview.top) / remainingPreview;
          const remainingLines = editedContent.split('\n').length - beforeSource.lineIndex;
          targetLineIndex = beforeSource.lineIndex + (progress * remainingLines);
        } else {
          const previewFraction = previewScrollCenter / renderedEl.scrollHeight;
          targetLineIndex = previewFraction * (editedContent.split('\n').length - 1);
        }
      } else if (afterPreview) {
        const afterSource = findSourceHeading(afterPreview);
        if (afterSource) {
          const progress = previewScrollCenter / afterPreview.top;
          targetLineIndex = progress * afterSource.lineIndex;
        } else {
          const previewFraction = previewScrollCenter / renderedEl.scrollHeight;
          targetLineIndex = previewFraction * (editedContent.split('\n').length - 1);
        }
      } else {
        const previewFraction = previewScrollCenter / renderedEl.scrollHeight;
        targetLineIndex = previewFraction * (editedContent.split('\n').length - 1);
      }

      const targetScrollCenter = padding + (targetLineIndex * lineHeight);
      const sourceMaxScroll = sourceEl.scrollHeight - sourceEl.clientHeight;
      const targetScrollTop = targetScrollCenter - sourceEl.clientHeight / 2;
      sourceEl.scrollTop = Math.max(0, Math.min(sourceMaxScroll, targetScrollTop));
    }

    // Reset flag after a short delay to allow the scroll event to settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isScrollingSyncRef.current = false;
      });
    });
  }, [editedContent, getLineHeight, extractHeadings, getPreviewHeadingPositions, softWrap, matches.length, tocMatchCount]);

  const handleSourceScroll = useCallback(() => {
    syncScroll('source');
    // Also sync highlight overlay, line numbers gutter, and track scroll position
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    const lineNumbers = lineNumbersRef.current;
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
      setScrollTop(textarea.scrollTop);
      setScrollLeft(textarea.scrollLeft);
    }
    if (textarea && lineNumbers) {
      lineNumbers.scrollTop = textarea.scrollTop;
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
            // Use manual scroll calculation to avoid scrollIntoView scrolling parent containers
            let offsetTop = 0;
            let element: HTMLElement | null = currentHighlight as HTMLElement;
            while (element && element !== renderedPanel) {
              offsetTop += element.offsetTop;
              element = element.offsetParent as HTMLElement;
            }
            const targetScrollTop = offsetTop - (renderedPanel.clientHeight / 2) + (currentHighlight.clientHeight / 2);
            renderedPanel.scrollTop = Math.max(0, targetScrollTop);
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
    const totalMatches = matches.length + tocMatchCount;
    if (!hasScrolledToInitialMatchRef.current && totalMatches > 0 && initialSearchQuery) {
      hasScrolledToInitialMatchRef.current = true;
      // Use requestAnimationFrame to ensure DOM has updated with highlights
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Only scroll to source match if past TOC range
          if (currentMatchIndex >= tocMatchCount && matches.length > 0) {
            const sourceIndex = currentMatchIndex - tocMatchCount;
            if (sourceIndex >= 0 && sourceIndex < matches.length) {
              selectMatch(matches[sourceIndex]);
            }
          }
          // If in TOC range, no source match to scroll to - TOC is already visible
        });
      });
    }
  }, [matches, currentMatchIndex, initialSearchQuery, selectMatch, tocMatchCount]);

  // Scroll to TOC marker in source editor
  const scrollToTocMarker = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea) return;

    // Find TOC marker position in content
    const tocMarkerRegex = /^\s*(\[TOC\]|\[\[toc\]\]|<!-- *toc *-->)\s*$/gim;
    const match = tocMarkerRegex.exec(editedContent);
    if (!match) return;

    // Find the actual marker position (not including leading whitespace)
    const markerStart = match.index + match[0].indexOf(match[1]);

    // Calculate line number for the TOC marker
    const textBeforeMarker = editedContent.substring(0, markerStart);
    const lineNumber = textBeforeMarker.split('\n').length - 1;

    // Scroll to show the TOC marker
    const lineHeight = 22.4; // Default line height
    const padding = 24;
    const targetScrollTop = padding + (lineNumber * lineHeight) - (textarea.clientHeight / 2);

    textarea.scrollTop = Math.max(0, targetScrollTop);
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
    }
  }, [editedContent]);

  // Navigate between matches (includes virtual TOC matches at the start, footnotes at the end)
  const handleNavigate = useCallback(
    (direction: 'next' | 'prev') => {
      const totalMatches = matches.length + tocMatchCount;
      if (totalMatches === 0) return;

      let newIndex: number;
      if (direction === 'next') {
        newIndex = (currentMatchIndex + 1) % totalMatches;
      } else {
        newIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches;
      }
      setCurrentMatchIndex(newIndex);

      // Select actual source match or scroll to TOC marker
      if (newIndex >= tocMatchCount && matches.length > 0) {
        // Direct index - navigation is linear in source order
        const sourceIndex = newIndex - tocMatchCount;
        if (sourceIndex >= 0 && sourceIndex < matches.length) {
          selectMatch(matches[sourceIndex]);
        }
      } else if (tocMatchCount > 0) {
        // Scroll to TOC marker for virtual TOC matches
        scrollToTocMarker();
      }
    },
    [matches, currentMatchIndex, selectMatch, tocMatchCount, scrollToTocMarker]
  );

  // Replace current match
  const handleReplace = useCallback(
    (replacement: string) => {
      if (matches.length === 0) return;
      if (currentMatchIndex < tocMatchCount) return; // Can't replace TOC matches

      const sourceIndex = currentMatchIndex - tocMatchCount;
      if (sourceIndex < 0 || sourceIndex >= matches.length) return;

      const match = matches[sourceIndex];
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
    [matches, currentMatchIndex, editedContent, onContentChange, handleSearch, lastSearchQuery, lastSearchOptions, tocMatchCount]
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

  // Apply syntax highlighting to the content
  const syntaxHighlightedContent = useMemo(() => {
    if (!editedContent) return '';

    try {
      const lang = hljs.getLanguage(highlightLanguage) ? highlightLanguage : 'plaintext';
      const result = hljs.highlight(editedContent, { language: lang });
      return result.value;
    } catch {
      return escapeHtml(editedContent);
    }
  }, [editedContent, highlightLanguage]);

  // Generate highlighted content for the source editor overlay
  // Shows syntax highlighting, with search highlights overlaid when active
  const highlightedSourceContent = useMemo(() => {
    // When search is active, show plain text with search highlights
    // (syntax highlighting + search marks is complex and can break highlighting)
    if (matches.length > 0 || tocMatchCount > 0) {
      const parts: string[] = [];
      let lastEnd = 0;

      // TOC marker regex - matches [TOC], [[toc]], or <!-- toc -->
      const tocMarkerRegex = /^\s*(\[TOC\]|\[\[toc\]\]|<!-- *toc *-->)\s*$/gim;

      // Helper to process a segment and add TOC markers with badges
      const processTocMarkers = (segment: string): string => {
        if (tocMatchCount === 0) return escapeHtml(segment);

        const result: string[] = [];
        let segmentLastEnd = 0;
        let tocMatch;
        tocMarkerRegex.lastIndex = 0;

        while ((tocMatch = tocMarkerRegex.exec(segment)) !== null) {
          // tocMatch[0] = full match including whitespace, tocMatch[1] = just the TOC marker
          const fullMatch = tocMatch[0];
          const tocMarker = tocMatch[1];
          const markerStartInMatch = fullMatch.indexOf(tocMarker);
          const markerStart = tocMatch.index + markerStartInMatch;
          const markerEnd = markerStart + tocMarker.length;

          // Add text before TOC marker (including leading whitespace from the match)
          if (markerStart > segmentLastEnd) {
            result.push(escapeHtml(segment.substring(segmentLastEnd, markerStart)));
          }
          // Add TOC marker with badge - show current/total if in TOC range
          const isCurrent = isCurrentMatchInToc;
          const badgeText = isCurrent
            ? `${currentMatchIndex + 1}/${tocMatchCount}`
            : `${tocMatchCount}`;
          const tocClass = isCurrent ? 'search-toc-match search-toc-match-current' : 'search-toc-match';
          result.push(`<span class="${tocClass}">${escapeHtml(tocMarker)}<span class="search-toc-badge">${badgeText}</span></span>`);
          // Continue from after the marker, leaving trailing whitespace for next iteration
          segmentLastEnd = markerEnd;
        }

        // Add remaining text after last TOC marker (or all text if no TOC)
        if (segmentLastEnd < segment.length) {
          result.push(escapeHtml(segment.substring(segmentLastEnd)));
        }
        return result.length > 0 ? result.join('') : escapeHtml(segment);
      };

      matches.forEach((match, index) => {
        if (match.start > lastEnd) {
          // Process segment before this match for TOC markers
          const segment = editedContent.substring(lastEnd, match.start);
          parts.push(processTocMarkers(segment));
        }
        const matchText = editedContent.substring(match.start, match.end);
        // Adjust index comparison to account for TOC offset
        const className =
          index === physicalMatchIndex
            ? 'search-highlight search-highlight-current'
            : 'search-highlight';
        parts.push(`<mark class="${className}">${escapeHtml(matchText)}</mark>`);
        lastEnd = match.end;
      });

      if (lastEnd < editedContent.length) {
        // Process final segment for TOC markers
        const segment = editedContent.substring(lastEnd);
        parts.push(processTocMarkers(segment));
      }

      return parts.join('') + '\n';
    }

    // No search active - show syntax highlighted content
    return syntaxHighlightedContent + '\n';
  }, [editedContent, matches, physicalMatchIndex, syntaxHighlightedContent, tocMatchCount, isCurrentMatchInToc, currentMatchIndex]);

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
          matchCount={matches.length + tocMatchCount}
          currentMatch={matches.length + tocMatchCount > 0 ? currentMatchIndex + 1 : 0}
          showReplace={showReplace}
          initialQuery={initialSearchQuery}
          initialOptions={initialSearchOptions}
        />
      )}
      <div className="split-editor-content">
        <div
          ref={sourceRef}
          className="split-panel split-panel-source"
          style={{ width: supportsRenderedView ? `${splitRatio * 100}%` : '100%' }}
        >
          <div className="editor-toolbars">
            {supportsFormatting && highlightLanguage === 'markdown' && (
              <FormattingToolbar
                contentRef={contentRef}
                onFormat={handleFormatting}
                onRequestSelection={getSelection}
                filePath={filePath}
              />
            )}
            {onFormat && (
              <button
                className="format-document-button"
                onClick={() => {
                  onFormat();
                  // Refocus textarea after formatting so undo shortcut works
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                title="Format Document (Shift+Alt+F)"
                aria-label="Format Document"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M2 3H14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 6H12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 9H14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 12H10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
          <div className={`source-editor-container ${showLineNumbers ? 'with-line-numbers' : ''}`}>
            {showLineNumbers && (
              <div
                ref={lineNumbersRef}
                className="line-numbers-gutter"
                aria-hidden="true"
              >
                {softWrap && lineHeights ? (
                  // Dynamic heights for soft wrap - each line number matches its wrapped content height
                  lineHeights.map((height, i) => (
                    <div
                      key={i}
                      className={`line-number ${i === currentLineNumber ? 'current' : ''}`}
                      style={{ height: `${height}px` }}
                    >
                      {i + 1}
                    </div>
                  ))
                ) : (
                  // Standard fixed-height line numbers
                  Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i}
                      className={`line-number ${i === currentLineNumber ? 'current' : ''}`}
                    >
                      {i + 1}
                    </div>
                  ))
                )}
              </div>
            )}
            {showColumnRuler && (
              <div
                className="column-ruler"
                style={{ left: `calc(${showLineNumbers ? '4rem' : '1.5rem'} + ${maxLineLength}ch - ${scrollLeft}px)` }}
              />
            )}
            {showCurrentLineHighlight && (
              <div
                className={`current-line-highlight ${softWrap && !showLineNumbers ? 'soft-wrap-mode' : ''}`}
                style={
                  softWrap && wrappedMetrics
                    ? {
                        top: `calc(1.5rem + ${wrappedMetrics.top}px - ${scrollTop}px)`,
                        height: `${wrappedMetrics.height}px`,
                      }
                    : {
                        top: `calc(1.5rem + ${currentLineNumber} * 1.6 * 0.875rem - ${scrollTop}px)`,
                      }
                }
              />
            )}
            {/* Hidden div for measuring wrapped line height - must match editor styling exactly */}
            {softWrap && (
              <div
                ref={lineMeasureRef}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  visibility: 'hidden',
                  boxSizing: 'border-box',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  // Width and padding must match the editor's content area
                  width: showLineNumbers ? 'calc(100% - 3.5rem)' : '100%',
                  paddingLeft: showLineNumbers ? '0.5rem' : '1.5rem',
                  paddingRight: '1.5rem',
                  fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  tabSize: 4,
                }}
              />
            )}
            <div
              ref={highlightRef}
              className={`source-editor-highlight ${matches.length === 0 ? 'syntax-highlighted' : ''} ${softWrap ? 'soft-wrap' : ''}`}
              dangerouslySetInnerHTML={{ __html: highlightedSourceContent }}
            />
            <textarea
              ref={textareaRef}
              className={`source-editor ${softWrap ? 'soft-wrap' : ''}`}
              value={editedContent}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onScroll={handleSourceScroll}
              onSelect={handleSelectionChange}
              onClick={handleSelectionChange}
              spellCheck={false}
              wrap={softWrap ? 'soft' : 'off'}
            />
          </div>
        </div>
        {supportsRenderedView && (
          <>
            <div className="split-divider" onMouseDown={handleMouseDown}>
              <div className="split-divider-handle" />
            </div>
            <div
              ref={renderedRef}
              className="split-panel split-panel-rendered"
              style={{ width: `${(1 - splitRatio) * 100}%` }}
            >
              <MarkdownViewer
                content={previewContent}
                fileName={fileName}
                filePath={filePath}
                searchHighlight={searchHighlight}
                currentMatchIndex={currentMatchIndex}
                isTocMatch={isCurrentMatchInToc}
                tocMatchIndex={isCurrentMatchInToc ? currentMatchIndex : 0}
                isFootnoteMatch={isCurrentMatchInFootnote}
                footnoteMatchIndex={currentFootnoteMatchIndex}
                nonFootnoteMatchIndex={currentNonFootnoteMatchIndex}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

SplitEditor.displayName = 'SplitEditor';

export default SplitEditor;
