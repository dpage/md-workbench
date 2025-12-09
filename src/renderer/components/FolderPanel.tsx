//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileTree from './FileTree';

interface FolderPanelProps {
  folderPath: string;
  folderName: string;
  onFileClick: (filePath: string) => void;
  onClose: () => void;
}

const MIN_WIDTH = 150;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 250;

const FolderPanel: React.FC<FolderPanelProps> = ({
  folderPath,
  folderName,
  onFileClick,
  onClose,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (panelRef.current) {
        const newWidth = e.clientX - panelRef.current.getBoundingClientRect().left;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div
      ref={panelRef}
      className={`folder-panel ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ width: isCollapsed ? undefined : width }}
    >
      <div className="folder-panel-header">
        <button
          className="folder-panel-toggle"
          onClick={handleToggleCollapse}
          title={isCollapsed ? 'Expand' : 'Collapse'}
          aria-label={isCollapsed ? 'Expand folder panel' : 'Collapse folder panel'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`folder-panel-toggle-icon ${isCollapsed ? 'collapsed' : ''}`}
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
        {!isCollapsed && (
          <>
            <div className="folder-panel-title" title={folderPath}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="folder-panel-title-icon"
              >
                <path
                  d="M2 13V3C2 2.44772 2.44772 2 3 2H6L8 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="folder-panel-title-text">{folderName}</span>
            </div>
            <button
              className="folder-panel-close"
              onClick={handleClose}
              title="Close Folder"
              aria-label="Close folder"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 4L12 12M12 4L4 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </>
        )}
      </div>
      {!isCollapsed && (
        <div className="folder-panel-content">
          <FileTree folderPath={folderPath} onFileClick={onFileClick} />
        </div>
      )}
      {!isCollapsed && (
        <div
          className="folder-panel-resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      )}
    </div>
  );
};

export default FolderPanel;
