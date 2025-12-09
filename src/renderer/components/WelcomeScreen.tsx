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
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="welcome-screen">
      {/* Decorative background elements */}
      <div className="welcome-bg-pattern" aria-hidden="true">
        <div className="welcome-bg-grid"></div>
        <div className="welcome-bg-glow"></div>
      </div>

      {/* Main content */}
      <div className="welcome-content">
        {/* Decorative document icon */}
        <div className="welcome-icon" aria-hidden="true">
          <svg width="64" height="80" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8C4 3.58172 7.58172 0 12 0H40L60 20V72C60 76.4183 56.4183 80 52 80H12C7.58172 80 4 76.4183 4 72V8Z" className="doc-bg"/>
            <path d="M40 0L60 20H44C41.7909 20 40 18.2091 40 16V0Z" className="doc-fold"/>
            <rect x="14" y="32" width="32" height="4" rx="2" className="doc-line doc-line-1"/>
            <rect x="14" y="42" width="24" height="4" rx="2" className="doc-line doc-line-2"/>
            <rect x="14" y="52" width="28" height="4" rx="2" className="doc-line doc-line-3"/>
            <rect x="14" y="62" width="18" height="4" rx="2" className="doc-line doc-line-4"/>
          </svg>
        </div>

        {/* Title group */}
        <div className="welcome-header">
          <h1 className="welcome-title">
            <span className="welcome-title-md">Markdown</span>
            <span className="welcome-title-wb">Workbench</span>
          </h1>
          <p className="welcome-tagline">
            A thoughtful editor for your documents
          </p>
        </div>

        {/* Actions */}
        <div className="welcome-actions">
          <button className="welcome-btn welcome-btn-primary" onClick={onOpenFile}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2.25 14.25V3.75C2.25 3.15326 2.48705 2.58097 2.90901 2.15901C3.33097 1.73705 3.90326 1.5 4.5 1.5H9.879C10.1774 1.50005 10.4636 1.61859 10.6747 1.8295L15.1705 6.3255C15.3814 6.53642 15.5 6.82264 15.5 7.121V14.25C15.5 14.8467 15.2629 15.419 14.841 15.841C14.419 16.2629 13.8467 16.5 13.25 16.5H4.5C3.90326 16.5 3.33097 16.2629 2.90901 15.841C2.48705 15.419 2.25 14.8467 2.25 14.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 1.5V5.25C10.5 5.64782 10.658 6.02936 10.9393 6.31066C11.2206 6.59196 11.6022 6.75 12 6.75H15.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Open File</span>
          </button>
          <button className="welcome-btn welcome-btn-secondary" onClick={onOpenFolder}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M15.75 14.25C15.75 14.6478 15.592 15.0294 15.3107 15.3107C15.0294 15.592 14.6478 15.75 14.25 15.75H3.75C3.35218 15.75 2.97064 15.592 2.68934 15.3107C2.40804 15.0294 2.25 14.6478 2.25 14.25V3.75C2.25 3.35218 2.40804 2.97064 2.68934 2.68934C2.97064 2.40804 3.35218 2.25 3.75 2.25H6.879C7.17744 2.25006 7.46366 2.36859 7.6747 2.5795L9 3.9045H14.25C14.6478 3.9045 15.0294 4.06254 15.3107 4.34384C15.592 4.62514 15.75 5.00668 15.75 5.4045V14.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Open Folder</span>
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="welcome-hint">
          Press <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>O</kbd> to open a file
        </p>
      </div>

      {/* Footer flourish */}
      <div className="welcome-footer" aria-hidden="true">
        <div className="welcome-footer-line"></div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
