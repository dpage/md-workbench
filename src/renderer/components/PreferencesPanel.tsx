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
  FormattingOptions,
  SqlDialect,
  EndOfLine,
  DEFAULT_FORMATTING_OPTIONS,
  EditorOptions,
  DEFAULT_EDITOR_OPTIONS,
} from '../../shared/preferences';
import { FileType } from '../../shared/fileTypes';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
}

type TabId = 'general' | 'appearance' | 'editor' | 'fileTypes' | 'formatting';

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

  // Theme changes need to go through setTheme IPC to be authoritative
  const handleThemeChange = useCallback(
    (theme: ThemeSetting) => {
      const updated = { ...localPreferences, theme };
      setLocalPreferences(updated);
      onPreferencesChange(updated);
      // Also call setTheme directly - this is the authoritative theme setter
      window.electronAPI?.setTheme(theme);
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

  const handleFormattingChange = useCallback(
    <K extends keyof FormattingOptions>(key: K, value: FormattingOptions[K]) => {
      const updated: Preferences = {
        ...localPreferences,
        formatting: {
          ...(localPreferences.formatting || DEFAULT_FORMATTING_OPTIONS),
          [key]: value,
        },
      };
      setLocalPreferences(updated);
      onPreferencesChange(updated);
    },
    [localPreferences, onPreferencesChange]
  );

  const handleEditorChange = useCallback(
    <K extends keyof EditorOptions>(key: K, value: EditorOptions[K]) => {
      const updated: Preferences = {
        ...localPreferences,
        editor: {
          ...(localPreferences.editor || DEFAULT_EDITOR_OPTIONS),
          [key]: value,
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
            className={`preferences-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
          <button
            className={`preferences-tab ${activeTab === 'fileTypes' ? 'active' : ''}`}
            onClick={() => setActiveTab('fileTypes')}
          >
            File Types
          </button>
          <button
            className={`preferences-tab ${activeTab === 'formatting' ? 'active' : ''}`}
            onClick={() => setActiveTab('formatting')}
          >
            Formatting
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
                      onChange={() => handleThemeChange('system')}
                    />
                    <span>System Default</span>
                  </label>
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="theme"
                      checked={localPreferences.theme === 'light'}
                      onChange={() => handleThemeChange('light')}
                    />
                    <span>Light</span>
                  </label>
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="theme"
                      checked={localPreferences.theme === 'dark'}
                      onChange={() => handleThemeChange('dark')}
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

          {activeTab === 'editor' && (
            <div className="preferences-section">
              <p className="preferences-section-description">
                Configure visual guides and highlights in the code editor.
              </p>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.editor?.showColumnRuler ?? true}
                    onChange={(e) => handleEditorChange('showColumnRuler', e.target.checked)}
                  />
                  <span>Show column ruler</span>
                </label>
                <p className="preferences-description">
                  Display a vertical line at the maximum line length position to help keep lines within bounds.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.editor?.showCurrentLineHighlight ?? true}
                    onChange={(e) => handleEditorChange('showCurrentLineHighlight', e.target.checked)}
                  />
                  <span>Highlight current line</span>
                </label>
                <p className="preferences-description">
                  Highlight the line where the cursor is currently positioned.
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

          {activeTab === 'formatting' && (
            <div className="preferences-section">
              <p className="preferences-section-description">
                Configure code formatting options for supported file types.
              </p>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.formatting?.formatOnSave ?? false}
                    onChange={(e) => handleFormattingChange('formatOnSave', e.target.checked)}
                  />
                  <span>Format on save</span>
                </label>
                <p className="preferences-description">
                  Automatically format documents when saving.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-label">Indent Size</label>
                <select
                  className="preferences-select"
                  value={localPreferences.formatting?.indentSize ?? 4}
                  onChange={(e) => handleFormattingChange('indentSize', parseInt(e.target.value, 10))}
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                  <option value={8}>8 spaces</option>
                </select>
                <p className="preferences-description">
                  Number of spaces per indentation level.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.formatting?.useTabs ?? false}
                    onChange={(e) => handleFormattingChange('useTabs', e.target.checked)}
                  />
                  <span>Use tabs for indentation</span>
                </label>
                <p className="preferences-description">
                  Use tab characters instead of spaces for indentation.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-label">Max Line Length</label>
                <input
                  type="number"
                  className="preferences-input"
                  value={localPreferences.formatting?.maxLineLength ?? 79}
                  min={40}
                  max={200}
                  onChange={(e) => handleFormattingChange('maxLineLength', parseInt(e.target.value, 10) || 79)}
                />
                <p className="preferences-description">
                  Maximum line length before wrapping (40-200 characters).
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.formatting?.wrapProse ?? true}
                    onChange={(e) => handleFormattingChange('wrapProse', e.target.checked)}
                  />
                  <span>Wrap prose in Markdown</span>
                </label>
                <p className="preferences-description">
                  Wrap long paragraphs at the maximum line length when formatting Markdown files.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-label">End of Line</label>
                <select
                  className="preferences-select"
                  value={localPreferences.formatting?.endOfLine ?? 'auto'}
                  onChange={(e) => handleFormattingChange('endOfLine', e.target.value as EndOfLine)}
                >
                  <option value="auto">Auto</option>
                  <option value="lf">LF (Unix/macOS)</option>
                  <option value="crlf">CRLF (Windows)</option>
                </select>
                <p className="preferences-description">
                  Line ending style for formatted files.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.formatting?.sortJsonKeys ?? true}
                    onChange={(e) => handleFormattingChange('sortJsonKeys', e.target.checked)}
                  />
                  <span>Sort JSON/YAML keys alphabetically</span>
                </label>
                <p className="preferences-description">
                  Sort object keys in alphabetical order when formatting JSON and YAML files.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-label">SQL Dialect</label>
                <select
                  className="preferences-select"
                  value={localPreferences.formatting?.sqlDialect ?? 'postgresql'}
                  onChange={(e) => handleFormattingChange('sqlDialect', e.target.value as SqlDialect)}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="sql">Standard SQL</option>
                </select>
                <p className="preferences-description">
                  SQL dialect to use when formatting SQL files.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.formatting?.sqlUppercaseKeywords ?? true}
                    onChange={(e) => handleFormattingChange('sqlUppercaseKeywords', e.target.checked)}
                  />
                  <span>Uppercase SQL keywords</span>
                </label>
                <p className="preferences-description">
                  Convert SQL keywords to uppercase when formatting.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreferencesPanel;
