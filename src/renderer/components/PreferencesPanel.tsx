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
  MarkdownViewMode,
  MarkdownOptions,
  DEFAULT_PREFERENCES,
  FormattingOptions,
  SqlDialect,
  EndOfLine,
  DEFAULT_FORMATTING_OPTIONS,
  EditorOptions,
  DEFAULT_EDITOR_OPTIONS,
  DEFAULT_MARKDOWN_OPTIONS,
} from '../../shared/preferences';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
}

type TabId = 'general' | 'appearance' | 'editor' | 'markdown' | 'formatting';

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

  const handleMarkdownChange = useCallback(
    <K extends keyof MarkdownOptions>(key: K, value: MarkdownOptions[K]) => {
      const updated: Preferences = {
        ...localPreferences,
        markdown: {
          ...(localPreferences.markdown || DEFAULT_MARKDOWN_OPTIONS),
          [key]: value,
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
            className={`preferences-tab ${activeTab === 'markdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('markdown')}
          >
            Markdown
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

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.editor?.showStatusBar ?? true}
                    onChange={(e) => handleEditorChange('showStatusBar', e.target.checked)}
                  />
                  <span>Show status bar</span>
                </label>
                <p className="preferences-description">
                  Display a status bar at the bottom showing file path, cursor position, and file information.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'markdown' && (
            <div className="preferences-section">
              <p className="preferences-section-description">
                Configure how Markdown files are displayed.
              </p>

              <div className="preferences-group">
                <label className="preferences-label">Default View Mode</label>
                <div className="preferences-radio-group">
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="defaultViewMode"
                      checked={(localPreferences.markdown?.defaultViewMode ?? 'preview') === 'preview'}
                      onChange={() => handleMarkdownChange('defaultViewMode', 'preview')}
                    />
                    <span>Preview</span>
                  </label>
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="defaultViewMode"
                      checked={(localPreferences.markdown?.defaultViewMode ?? 'preview') === 'edit'}
                      onChange={() => handleMarkdownChange('defaultViewMode', 'edit')}
                    />
                    <span>Edit</span>
                  </label>
                  <label className="preferences-radio-label">
                    <input
                      type="radio"
                      name="defaultViewMode"
                      checked={(localPreferences.markdown?.defaultViewMode ?? 'preview') === 'split'}
                      onChange={() => handleMarkdownChange('defaultViewMode', 'split')}
                    />
                    <span>Split (Edit + Preview)</span>
                  </label>
                </div>
                <p className="preferences-description">
                  Choose the default view mode when opening Markdown files.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.markdown?.rememberViewModes ?? true}
                    onChange={(e) => handleMarkdownChange('rememberViewModes', e.target.checked)}
                  />
                  <span>Remember view mode per file</span>
                </label>
                <p className="preferences-description">
                  Remember the view mode for each file and restore it when the file is reopened.
                </p>
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
