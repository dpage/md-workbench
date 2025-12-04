//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback } from 'react';
import FileTree from './FileTree';

interface FolderPanelProps {
  folderPath: string;
  folderName: string;
  onFileClick: (filePath: string) => void;
  onClose: () => void;
}

const FolderPanel: React.FC<FolderPanelProps> = ({
  folderPath,
  folderName,
  onFileClick,
  onClose,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <div className={`folder-panel ${isCollapsed ? 'collapsed' : ''}`}>
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
    </div>
  );
};

export default FolderPanel;
