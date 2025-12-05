//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useEffect } from 'react';
import {
  Preferences,
  ThemeSetting,
  DefaultOpenMode,
  FileTypeDefaults,
  FILE_TYPE_LABELS,
  DEFAULT_PREFERENCES,
} from '../../shared/preferences';
import { FileType } from '../../shared/fileTypes';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
}

type TabId = 'general' | 'appearance' | 'fileTypes';

const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  isOpen,
  onClose,
  preferences,
  onPreferencesChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [localPreferences, setLocalPreferences] = useState<Preferences>(preferences);

  // Sync local state with props when panel opens
  useEffect(() => {
    if (isOpen) {
      setLocalPreferences(preferences);
    }
  }, [isOpen, preferences]);

  const handleChange = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      const updated = { ...localPreferences, [key]: value };
      setLocalPreferences(updated);
      onPreferencesChange(updated);
    },
    [localPreferences, onPreferencesChange]
  );

  const handleFileTypeDefaultChange = useCallback(
    (fileType: FileType, mode: DefaultOpenMode) => {
      const updated: Preferences = {
        ...localPreferences,
        fileTypeDefaults: {
          ...localPreferences.fileTypeDefaults,
          [fileType]: mode,
        },
      };
      setLocalPreferences(updated);
      onPreferencesChange(updated);
    },
    [localPreferences, onPreferencesChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const fileTypes: FileType[] = [
    'markdown',
    'json',
    'yaml',
    'xml',
    'javascript',
    'typescript',
    'css',
    'html',
    'python',
    'sql',
    'shell',
    'plaintext',
  ];

  return (
    <div
      className="preferences-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="preferences-panel">
        <div className="preferences-header">
          <h2>Preferences</h2>
          <button
            className="preferences-close"
            onClick={onClose}
            aria-label="Close preferences"
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
        </div>

        <div className="preferences-tabs">
          <button
            className={`preferences-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`preferences-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
          <button
            className={`preferences-tab ${activeTab === 'fileTypes' ? 'active' : ''}`}
            onClick={() => setActiveTab('fileTypes')}
          >
            File Types
          </button>
        </div>

        <div className="preferences-content">
          {activeTab === 'general' && (
            <div className="preferences-section">
              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.autoReload}
                    onChange={(e) => handleChange('autoReload', e.target.checked)}
                  />
                  <span>Auto-reload files when changed externally</span>
                </label>
                <p className="preferences-description">
                  Automatically reload open files when they are modified by another application.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.autoSave}
                    onChange={(e) => handleChange('autoSave', e.target.checked)}
                  />
                  <span>Auto-save files when editing</span>
                </label>
                <p className="preferences-description">
                  Automatically save files after you stop typing for a moment.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.openLinksInNewTab}
                    onChange={(e) => handleChange('openLinksInNewTab', e.target.checked)}
                  />
                  <span>Open links in new tab</span>
                </label>
                <p className="preferences-description">
                  When clicking internal links, open them in a new tab instead of the current tab.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="preferences-section">
              <div className="preferences-group">
                <label className="preferences-label">Theme</label>
                <div className="preferences-radio-group">
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="theme"
                      checked={localPreferences.theme === 'system'}
                      onChange={() => handleChange('theme', 'system')}
                    />
                    <span>System Default</span>
                  </label>
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="theme"
                      checked={localPreferences.theme === 'light'}
                      onChange={() => handleChange('theme', 'light')}
                    />
                    <span>Light</span>
                  </label>
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="theme"
                      checked={localPreferences.theme === 'dark'}
                      onChange={() => handleChange('theme', 'dark')}
                    />
                    <span>Dark</span>
                  </label>
                </div>
                <p className="preferences-description">
                  Choose the color theme for the application.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'fileTypes' && (
            <div className="preferences-section">
              <p className="preferences-section-description">
                Choose the default mode when opening each file type.
              </p>
              <div className="preferences-file-types">
                {fileTypes.map((fileType) => (
                  <div key={fileType} className="preferences-file-type-row">
                    <span className="preferences-file-type-label">
                      {FILE_TYPE_LABELS[fileType]}
                    </span>
                    <div className="preferences-file-type-options">
                      <label className="preferences-radio-label">
                        <input
                          type="radio"
                          name={`fileType-${fileType}`}
                          checked={localPreferences.fileTypeDefaults[fileType] === 'view'}
                          onChange={() => handleFileTypeDefaultChange(fileType, 'view')}
                        />
                        <span>View</span>
                      </label>
                      <label className="preferences-radio-label">
                        <input
                          type="radio"
                          name={`fileType-${fileType}`}
                          checked={localPreferences.fileTypeDefaults[fileType] === 'edit'}
                          onChange={() => handleFileTypeDefaultChange(fileType, 'edit')}
                        />
                        <span>Edit</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreferencesPanel;
