//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';
import { FileType } from '../../shared/fileTypes';
import { FILE_TYPE_LABELS } from '../../shared/preferences';

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
}) => {
  // Get display name for file type (just the type name, not the full label with extensions)
  const getFileTypeDisplayName = (type: string): string => {
    const label = FILE_TYPE_LABELS[type as FileType];
    if (label) {
      // Extract just the type name before the extensions in parentheses
      const match = label.match(/^([^(]+)/);
      return match ? match[1].trim() : type;
    }
    return type;
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
          <span className="status-bar-item status-bar-cursor" title="Cursor position">
            Ln {cursorLine}, Col {cursorColumn}
          </span>
        )}
        {totalLines !== undefined && (
          <span className="status-bar-item status-bar-lines" title="Total lines">
            {totalLines} {totalLines === 1 ? 'line' : 'lines'}
          </span>
        )}
        <span className="status-bar-item status-bar-encoding" title="File encoding">
          {encoding}
        </span>
        <span className="status-bar-item status-bar-eol" title="End of line sequence">
          {lineEnding}
        </span>
        <span className="status-bar-item status-bar-filetype" title="File type">
          {fileTypeDisplay}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
