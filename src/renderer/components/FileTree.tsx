//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useEffect } from 'react';

interface FolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FileTreeItemProps {
  entry: FolderEntry;
  level: number;
  onFileClick: (filePath: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  entry,
  level,
  onFileClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FolderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!entry.isDirectory) return;

    setIsLoading(true);
    try {
      const contents = await window.electronAPI.readFolderContents(entry.path);
      setChildren(contents);
    } catch (error) {
      console.error('Error loading folder contents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [entry.path, entry.isDirectory]);

  // Watch for folder content changes
  useEffect(() => {
    if (!entry.isDirectory || !isExpanded) return;

    // Start watching this folder
    window.electronAPI.startWatchingFolder(entry.path);

    // Listen for changes to this folder
    const unsubscribe = window.electronAPI.onFolderContentsChanged((data) => {
      if (data.folderPath === entry.path) {
        // Reload children when folder contents change
        loadChildren();
      }
    });

    return () => {
      // Stop watching when collapsed or unmounted
      window.electronAPI.stopWatchingFolder(entry.path);
      unsubscribe();
    };
  }, [entry.isDirectory, entry.path, isExpanded, loadChildren]);

  const handleClick = useCallback(() => {
    if (entry.isDirectory) {
      if (!isExpanded) {
        loadChildren();
      }
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(entry.path);
    }
  }, [entry.isDirectory, entry.path, isExpanded, loadChildren, onFileClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Get file icon based on extension
  const getFileIcon = () => {
    if (entry.isDirectory) {
      return isExpanded ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="file-tree-icon folder-icon"
        >
          <path
            d="M2 13V3C2 2.44772 2.44772 2 3 2H6L8 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13Z"
            fill="currentColor"
            opacity="0.3"
          />
          <path
            d="M2 13V3C2 2.44772 2.44772 2 3 2H6L8 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13Z"
            stroke="currentColor"
            strokeWidth="1.5"
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
          className="file-tree-icon folder-icon"
        >
          <path
            d="M2 13V3C2 2.44772 2.44772 2 3 2H6L8 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    // Markdown file icon
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="file-tree-icon file-icon"
      >
        <rect
          x="3"
          y="2"
          width="10"
          height="12"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 6H11M5 9H11M5 12H9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  const getChevron = () => {
    if (!entry.isDirectory) {
      return <span className="file-tree-chevron-spacer" />;
    }

    return (
      <span className={`file-tree-chevron ${isExpanded ? 'expanded' : ''}`}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.5 3L7.5 6L4.5 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  };

  return (
    <div className="file-tree-item-container">
      <div
        className={`file-tree-item ${entry.isDirectory ? 'directory' : 'file'}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        aria-expanded={entry.isDirectory ? isExpanded : undefined}
      >
        {getChevron()}
        {getFileIcon()}
        <span className="file-tree-name">{entry.name}</span>
        {isLoading && <span className="file-tree-loading">...</span>}
      </div>
      {entry.isDirectory && isExpanded && children.length > 0 && (
        <div className="file-tree-children" role="group">
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              entry={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface FileTreeProps {
  folderPath: string;
  onFileClick: (filePath: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ folderPath, onFileClick }) => {
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFolder = useCallback(async () => {
    setIsLoading(true);
    try {
      const contents = await window.electronAPI.readFolderContents(folderPath);
      setEntries(contents);
    } catch (error) {
      console.error('Error loading folder:', error);
    } finally {
      setIsLoading(false);
    }
  }, [folderPath]);

  // Initial load
  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  // Watch for root folder content changes
  useEffect(() => {
    // Start watching the root folder
    window.electronAPI.startWatchingFolder(folderPath);

    // Listen for changes to the root folder
    const unsubscribe = window.electronAPI.onFolderContentsChanged((data) => {
      if (data.folderPath === folderPath) {
        // Reload root entries when folder contents change
        loadFolder();
      }
    });

    return () => {
      // Stop watching when unmounted
      window.electronAPI.stopWatchingFolder(folderPath);
      unsubscribe();
    };
  }, [folderPath, loadFolder]);

  if (isLoading) {
    return (
      <div className="file-tree-loading-container">
        <span className="file-tree-loading-text">Loading...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="file-tree-empty">
        <span className="file-tree-empty-text">No supported files</span>
      </div>
    );
  }

  return (
    <div className="file-tree" role="tree">
      {entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          level={0}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
};

export default FileTree;
