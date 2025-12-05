//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ToolbarProps {
  onOpenFile: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  viewSource: boolean;
  onToggleViewSource: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  hasActiveTab: boolean;
  isDirty?: boolean;
  supportsRenderedView?: boolean;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onFind?: () => void;
  onFindReplace?: () => void;
  onHelp?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFile,
  onSave,
  onSaveAs,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  viewSource,
  onToggleViewSource,
  editMode,
  onToggleEditMode,
  hasActiveTab,
  isDirty = false,
  supportsRenderedView = true,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onFindReplace,
  onHelp,
}) => {
  const [showCopied, setShowCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    onCopy?.();
    setShowCopied(true);

    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    // Reset after 2 seconds
    copyTimeoutRef.current = window.setTimeout(() => {
      setShowCopied(false);
    }, 2000);
  }, [onCopy]);
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-nav">
          <button
            className="toolbar-button"
            onClick={onBack}
            disabled={!canGoBack}
            title="Go Back"
            aria-label="Go Back"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="toolbar-button"
            onClick={onForward}
            disabled={!canGoForward}
            title="Go Forward"
            aria-label="Go Forward"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {hasActiveTab && (
          <>
            <div className="toolbar-separator" />
            {editMode && (
              <button
                className="toolbar-button toolbar-button-icon"
                onClick={onCut}
                title="Cut (Cmd+X)"
                aria-label="Cut"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="4" cy="4" r="2.25" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="4" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M5.5 5.5L14 14M5.5 10.5L14 2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
            <button
              className={`toolbar-button toolbar-button-icon ${showCopied ? 'toolbar-button-copied' : ''}`}
              onClick={handleCopy}
              title={showCopied ? 'Copied!' : 'Copy (Cmd+C)'}
              aria-label={showCopied ? 'Copied' : 'Copy'}
            >
              {showCopied ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 8.5L6 11.5L13 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="5"
                    y="5"
                    width="9"
                    height="9"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M11 5V3C11 2.44772 10.5523 2 10 2H3C2.44772 2 2 2.44772 2 3V10C2 10.5523 2.44772 11 3 11H5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
            </button>
            {editMode && (
              <button
                className="toolbar-button toolbar-button-icon"
                onClick={onPaste}
                title="Paste (Cmd+V)"
                aria-label="Paste"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="3"
                    y="4"
                    width="10"
                    height="10"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            )}
            <div className="toolbar-separator" />
            <button
              className="toolbar-button toolbar-button-icon"
              onClick={onFind}
              title="Find (Cmd+F)"
              aria-label="Find"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M10 10L14 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {editMode && (
              <button
                className="toolbar-button toolbar-button-icon"
                onClick={onFindReplace}
                title="Find and Replace (Cmd+H)"
                aria-label="Find and Replace"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="5" cy="5" r="3.25" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M7.5 7.5L10 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 11H14M12 9V13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      <div className="toolbar-actions">
        <button
          className="toolbar-button toolbar-button-open"
          onClick={onOpenFile}
          title="Open File (Cmd+O)"
          aria-label="Open File"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 13V3C2 2.44772 2.44772 2 3 2H6L8 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Open</span>
        </button>
        <button
          className="toolbar-button toolbar-button-save"
          onClick={onSave}
          disabled={!hasActiveTab || !isDirty}
          title="Save (Cmd+S)"
          aria-label="Save"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 14H3.5C2.94772 14 2.5 13.5523 2.5 13V3C2.5 2.44772 2.94772 2 3.5 2H10.5L13.5 5V13C13.5 13.5523 13.0523 14 12.5 14Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 2V5H10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 14V10H11V14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Save</span>
        </button>
        <button
          className="toolbar-button toolbar-button-save-as"
          onClick={onSaveAs}
          disabled={!hasActiveTab}
          title="Save As (Cmd+Shift+S)"
          aria-label="Save As"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.5 14H3.5C2.94772 14 2.5 13.5523 2.5 13V3C2.5 2.44772 2.94772 2 3.5 2H9.5L12.5 5V9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 2V5H9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 14V10H9V14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 11V15M10 13H14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>Save As</span>
        </button>
        {supportsRenderedView && (
          <button
            className={`toolbar-button toolbar-button-source ${viewSource ? 'active' : ''}`}
            onClick={onToggleViewSource}
            disabled={!hasActiveTab}
            title={viewSource ? 'View Rendered' : 'View Source'}
            aria-label={viewSource ? 'View Rendered' : 'View Source'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.5 4L2 8L5.5 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.5 4L14 8L10.5 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Source</span>
          </button>
        )}
        <button
          className={`toolbar-button toolbar-button-edit ${editMode ? 'active' : ''}`}
          onClick={onToggleEditMode}
          disabled={!hasActiveTab}
          title={editMode ? 'Exit Split View' : 'Split View'}
          aria-label={editMode ? 'Exit Split View' : 'Split View'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="8"
              y1="2"
              x2="8"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <span>Edit</span>
        </button>
        <div className="toolbar-separator" />
        <button
          className="toolbar-button toolbar-button-help"
          onClick={onHelp}
          title="Help"
          aria-label="Help"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M6 6C6 4.89543 6.89543 4 8 4C9.10457 4 10 4.89543 10 6C10 6.83333 9.5 7.5 8.5 8C8.25 8.125 8 8.375 8 8.75V9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
