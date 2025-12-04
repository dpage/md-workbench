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
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenFile }) => {
  return (
    <div className="welcome-screen">
      <h1>Markdown Workbench</h1>
      <p>A simple markdown file viewer</p>
      <div className="welcome-actions">
        <button className="open-file-btn" onClick={onOpenFile}>
          Open Markdown File
        </button>
        <p className="shortcut-hint">
          Or press <kbd>Ctrl</kbd>+<kbd>O</kbd> (Windows/Linux) or{' '}
          <kbd>Cmd</kbd>+<kbd>O</kbd> (macOS)
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
