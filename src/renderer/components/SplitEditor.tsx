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
  supportsFormatting?: boolean;
  supportsRenderedView?: boolean;
  highlightLanguage?: string;
  autoSave?: boolean;
  onAutoSave?: () => void;
  onFormat?: () => void;
  formatOnSave?: boolean;
  showColumnRuler?: boolean;
  showCurrentLineHighlight?: boolean;
  maxLineLength?: number;
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
  supportsFormatting = true,
  supportsRenderedView = true,
  highlightLanguage = 'markdown',
  autoSave = false,
  onAutoSave,
  onFormat,
  formatOnSave = false,
  showColumnRuler = true,
  showCurrentLineHighlight = true,
  maxLineLength = 79,
}) => {
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

  // Calculate current line number based on cursor position
  const currentLineNumber = useMemo(() => {
    const textBeforeCursor = editedContent.substring(0, selectionStart);
    return textBeforeCursor.split('\n').length - 1; // 0-indexed line number
  }, [editedContent, selectionStart]);

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

    // Restore selection
    requestAnimationFrame(() => {
      textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
      setSelectionStart(entry.selectionStart);
      setSelectionEnd(entry.selectionEnd);
    });
  }, [editedContent, selectionStart, selectionEnd, onContentChange]);

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

    // Restore selection
    requestAnimationFrame(() => {
      textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
      setSelectionStart(entry.selectionStart);
      setSelectionEnd(entry.selectionEnd);
    });
  }, [editedContent, selectionStart, selectionEnd, onContentChange]);

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
      }
    },
    [handleUndo, handleRedo, onFormat]
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

  // Report match index changes to parent
  useEffect(() => {
    onCurrentMatchChange?.(currentMatchIndex, matches.length);
  }, [currentMatchIndex, matches.length, onCurrentMatchChange]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setEditedContent(newContent);
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
        if (autoSave && onAutoSave) {
          // Format before save if enabled
          if (formatOnSave && onFormat) {
            onFormat();
          }
          onAutoSave();
        }
      }, 500);
    },
    [debouncedParentUpdate, autoSave, onAutoSave, formatOnSave, onFormat]
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
  const syncScroll = useCallback((source: 'source' | 'rendered') => {
    if (isScrollingSyncRef.current) return;

    const sourceEl = textareaRef.current;
    const renderedEl = renderedRef.current?.querySelector('.markdown-viewer');

    if (!sourceEl || !renderedEl) return;

    isScrollingSyncRef.current = true;

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
  }, [editedContent, getLineHeight, extractHeadings, getPreviewHeadingPositions]);

  const handleSourceScroll = useCallback(() => {
    syncScroll('source');
    // Also sync highlight overlay and track scroll position
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
      setScrollTop(textarea.scrollTop);
      setScrollLeft(textarea.scrollLeft);
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
    if (matches.length > 0) {
      const parts: string[] = [];
      let lastEnd = 0;

      matches.forEach((match, index) => {
        if (match.start > lastEnd) {
          parts.push(escapeHtml(editedContent.substring(lastEnd, match.start)));
        }
        const matchText = editedContent.substring(match.start, match.end);
        const className =
          index === currentMatchIndex
            ? 'search-highlight search-highlight-current'
            : 'search-highlight';
        parts.push(`<mark class="${className}">${escapeHtml(matchText)}</mark>`);
        lastEnd = match.end;
      });

      if (lastEnd < editedContent.length) {
        parts.push(escapeHtml(editedContent.substring(lastEnd)));
      }

      return parts.join('') + '\n';
    }

    // No search active - show syntax highlighted content
    return syntaxHighlightedContent + '\n';
  }, [editedContent, matches, currentMatchIndex, syntaxHighlightedContent]);

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
          <div className="source-editor-container">
            {showColumnRuler && (
              <div
                className="column-ruler"
                style={{ left: `calc(1.5rem + ${maxLineLength}ch - ${scrollLeft}px)` }}
              />
            )}
            {showCurrentLineHighlight && (
              <div
                className="current-line-highlight"
                style={{
                  top: `calc(1.5rem + ${currentLineNumber} * 1.6 * 0.875rem - ${scrollTop}px)`,
                }}
              />
            )}
            <div
              ref={highlightRef}
              className={`source-editor-highlight ${matches.length === 0 ? 'syntax-highlighted' : ''}`}
              dangerouslySetInnerHTML={{ __html: highlightedSourceContent }}
            />
            <textarea
              ref={textareaRef}
              className="source-editor"
              value={editedContent}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onScroll={handleSourceScroll}
              onSelect={handleSelectionChange}
              onClick={handleSelectionChange}
              spellCheck={false}
              wrap="off"
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
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SplitEditor;
