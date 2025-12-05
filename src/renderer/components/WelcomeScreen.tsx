//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';

interface WelcomeScreenProps {
  onOpenFile: () => void;
  onOpenFolder: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenFile, onOpenFolder }) => {
  return (
    <div className="welcome-screen">
      <h1>Markdown Workbench</h1>
      <p>View and edit Markdown, code, and configuration files</p>
      <div className="welcome-actions">
        <div className="welcome-buttons">
          <button className="open-file-btn" onClick={onOpenFile}>
            Open File
          </button>
          <button className="open-folder-btn" onClick={onOpenFolder}>
            Open Folder
          </button>
        </div>
        <p className="shortcut-hint">
          Or press <kbd>Ctrl</kbd>+<kbd>O</kbd> (Windows/Linux) or{' '}
          <kbd>Cmd</kbd>+<kbd>O</kbd> (macOS) to open a file
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
