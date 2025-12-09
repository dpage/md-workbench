//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';
import { FileType, FILE_TYPE_LABELS } from '../../shared/fileTypes';

interface StatusBarProps {
  filePath: string;
  fileType?: string;
  cursorLine?: number;
  cursorColumn?: number;
  totalLines?: number;
  editMode: boolean;
  isDirty?: boolean;
  encoding?: string;
  lineEnding?: 'LF' | 'CRLF' | 'Mixed';
  onGoToLine?: () => void;
  onChangeEncoding?: () => void;
  onChangeLineEnding?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  fileType,
  cursorLine,
  cursorColumn,
  totalLines,
  editMode,
  isDirty = false,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  onGoToLine,
  onChangeEncoding,
  onChangeLineEnding,
}) => {
  // Get display name for file type
  const getFileTypeDisplayName = (type: string): string => {
    return FILE_TYPE_LABELS[type as FileType] || type;
  };

  const fileTypeDisplay = fileType ? getFileTypeDisplayName(fileType) : 'Plain Text';

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item status-bar-path" title={filePath}>
          {filePath}
        </span>
        {isDirty && (
          <span className="status-bar-item status-bar-dirty" title="Unsaved changes">
            (Modified)
          </span>
        )}
      </div>
      <div className="status-bar-right">
        {editMode && cursorLine !== undefined && cursorColumn !== undefined && (
          <button
            className="status-bar-item status-bar-cursor status-bar-clickable"
            title="Go to line (Ctrl+G)"
            onClick={onGoToLine}
          >
            Ln {cursorLine}, Col {cursorColumn}
          </button>
        )}
        {totalLines !== undefined && (
          <button
            className="status-bar-item status-bar-lines status-bar-clickable"
            title="Go to line (Ctrl+G)"
            onClick={onGoToLine}
          >
            {totalLines} {totalLines === 1 ? 'line' : 'lines'}
          </button>
        )}
        <button
          className="status-bar-item status-bar-encoding status-bar-clickable"
          title="Change encoding"
          onClick={onChangeEncoding}
        >
          {encoding}
        </button>
        <button
          className="status-bar-item status-bar-eol status-bar-clickable"
          title="Change line ending"
          onClick={onChangeLineEnding}
        >
          {lineEnding}
        </button>
        <span className="status-bar-item status-bar-filetype" title="File type">
          {fileTypeDisplay}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
