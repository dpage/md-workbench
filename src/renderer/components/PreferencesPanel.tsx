//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  AIOptions,
  DEFAULT_AI_OPTIONS,
  ChatOptions,
  DEFAULT_CHAT_OPTIONS,
} from '../../shared/preferences';
import {
  AIProvider,
  AIModel,
  AIConnectionStatus,
  AIKeyStatus,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_REQUIRES_API_KEY,
  getModelFieldForProvider,
  getSelectedModelForProvider,
} from '../../shared/aiProviders';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences;
  onPreferencesChange: (preferences: Preferences) => void;
}

type TabId = 'general' | 'appearance' | 'editor' | 'markdown' | 'formatting' | 'ai';

const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  isOpen,
  onClose,
  preferences,
  onPreferencesChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [localPreferences, setLocalPreferences] = useState<Preferences>(preferences);

  // AI-related state
  const [aiKeyStatus, setAiKeyStatus] = useState<AIKeyStatus | null>(null);
  const [aiConnectionStatus, setAiConnectionStatus] = useState<AIConnectionStatus | null>(null);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Track previous isOpen state to detect when panel opens
  const wasOpenRef = useRef(false);

  // Sync local state with props when panel opens
  useEffect(() => {
    if (isOpen) {
      setLocalPreferences(preferences);
      // Only reset AI state when panel first opens, not on every preferences change
      if (!wasOpenRef.current) {
        setAiConnectionStatus(null);
        setAiModels([]);
        setAiError(null);
      }
    }
    wasOpenRef.current = isOpen;
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

  const handleAIChange = useCallback(
    <K extends keyof AIOptions>(key: K, value: AIOptions[K]) => {
      const updated: Preferences = {
        ...localPreferences,
        ai: {
          ...(localPreferences.ai || DEFAULT_AI_OPTIONS),
          [key]: value,
        },
      };
      setLocalPreferences(updated);
      onPreferencesChange(updated);

      // Reset connection status and models when provider or key file changes
      if (key === 'provider' || key === 'anthropicKeyFile' || key === 'openaiKeyFile' || key === 'geminiKeyFile' || key === 'ollamaEndpoint' || key === 'dmrEndpoint') {
        setAiConnectionStatus(null);
        setAiModels([]);
        setAiError(null);
      }
    },
    [localPreferences, onPreferencesChange]
  );

  const handleChatChange = useCallback(
    <K extends keyof ChatOptions>(key: K, value: ChatOptions[K]) => {
      const updated: Preferences = {
        ...localPreferences,
        chat: {
          ...(localPreferences.chat || DEFAULT_CHAT_OPTIONS),
          [key]: value,
        },
      };
      setLocalPreferences(updated);
      onPreferencesChange(updated);
    },
    [localPreferences, onPreferencesChange]
  );

  // Get the key file path for the current provider
  const getKeyFileForProvider = useCallback((provider: AIProvider, ai: AIOptions): string => {
    switch (provider) {
      case 'anthropic': return ai.anthropicKeyFile;
      case 'openai': return ai.openaiKeyFile;
      case 'gemini': return ai.geminiKeyFile;
      default: return '';
    }
  }, []);

  // Check API key status for cloud providers
  const checkKeyStatus = useCallback(async () => {
    const ai = localPreferences.ai || DEFAULT_AI_OPTIONS;
    const provider = ai.provider;

    if (!PROVIDER_REQUIRES_API_KEY[provider]) {
      setAiKeyStatus(null);
      return;
    }

    const keyFile = getKeyFileForProvider(provider, ai);
    const status = await window.electronAPI?.getAIKeyStatus(provider, keyFile);
    setAiKeyStatus(status || null);
  }, [localPreferences.ai, getKeyFileForProvider]);

  // Check key status when provider or key file changes
  useEffect(() => {
    if (isOpen && activeTab === 'ai') {
      checkKeyStatus();
    }
  }, [isOpen, activeTab, localPreferences.ai?.provider, localPreferences.ai?.anthropicKeyFile, localPreferences.ai?.openaiKeyFile, localPreferences.ai?.geminiKeyFile, checkKeyStatus]);

  // Test connection to the provider
  const handleTestConnection = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiConnectionStatus(null);
    setAiModels([]);

    try {
      const ai = localPreferences.ai || DEFAULT_AI_OPTIONS;
      const provider = ai.provider;
      const savedModel = getSelectedModelForProvider(ai, provider);
      const modelField = getModelFieldForProvider(provider);
      const result = await window.electronAPI?.testAIConnection(provider, ai);

      if (result) {
        setAiConnectionStatus(result);

        if (result.connected) {
          // Fetch models on successful connection
          const modelsResult = await window.electronAPI?.listAIModels(provider, ai);
          if (modelsResult) {
            if (modelsResult.error) {
              setAiError(modelsResult.error);
            } else {
              setAiModels(modelsResult.models);

              // Smart match the saved model for this provider
              if (savedModel && modelsResult.models.length > 0) {
                const matchedModel = await window.electronAPI?.smartMatchAIModel(
                  provider,
                  savedModel,
                  modelsResult.models
                );
                if (matchedModel && matchedModel !== savedModel) {
                  // Update to the matched model
                  handleAIChange(modelField, matchedModel);
                }
              } else if (!savedModel && modelsResult.models.length > 0) {
                // Auto-select first model if none selected for this provider
                handleAIChange(modelField, modelsResult.models[0].id);
              }
            }
          }
        } else {
          setAiError(result.error || 'Connection failed');
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAiLoading(false);
    }
  }, [localPreferences.ai, handleAIChange]);

  // Auto-test connection when AI tab opens or provider changes
  const lastTestedProviderRef = useRef<AIProvider | null>(null);
  useEffect(() => {
    if (isOpen && activeTab === 'ai' && !aiLoading && aiModels.length === 0) {
      const ai = localPreferences.ai || DEFAULT_AI_OPTIONS;
      const provider = ai.provider;
      const savedModel = getSelectedModelForProvider(ai, provider);

      // Auto-test if:
      // 1. Provider changed from last tested provider, OR
      // 2. First time opening and there's a saved model for this provider
      const providerChanged = lastTestedProviderRef.current !== null && lastTestedProviderRef.current !== provider;
      const firstOpenWithSavedModel = lastTestedProviderRef.current === null && savedModel;

      if (providerChanged || firstOpenWithSavedModel) {
        lastTestedProviderRef.current = provider;
        handleTestConnection();
      }
    }
    if (!isOpen) {
      lastTestedProviderRef.current = null;
    }
  }, [isOpen, activeTab, localPreferences.ai, aiModels.length, aiLoading, handleTestConnection]);

  // Browse for key file
  const handleBrowseKeyFile = useCallback(async (provider: AIProvider) => {
    const result = await window.electronAPI?.browseKeyFile();
    if (result && !result.canceled && result.filePath) {
      switch (provider) {
        case 'anthropic':
          handleAIChange('anthropicKeyFile', result.filePath);
          break;
        case 'openai':
          handleAIChange('openaiKeyFile', result.filePath);
          break;
        case 'gemini':
          handleAIChange('geminiKeyFile', result.filePath);
          break;
      }
    }
  }, [handleAIChange]);

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
          <button
            className={`preferences-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI
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
                    checked={localPreferences.editor?.showLineNumbers ?? true}
                    onChange={(e) => handleEditorChange('showLineNumbers', e.target.checked)}
                  />
                  <span>Show line numbers</span>
                </label>
                <p className="preferences-description">
                  Display line numbers in the gutter on the left side of the editor.
                </p>
              </div>

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

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.editor?.softWrap ?? false}
                    onChange={(e) => handleEditorChange('softWrap', e.target.checked)}
                  />
                  <span>Soft wrap long lines</span>
                </label>
                <p className="preferences-description">
                  Visually wrap long lines to fit the editor width without affecting the saved content.
                </p>
              </div>

              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.editor?.formattingShortcuts ?? true}
                    onChange={(e) => handleEditorChange('formattingShortcuts', e.target.checked)}
                  />
                  <span>Formatting shortcuts</span>
                </label>
                <p className="preferences-description">
                  When text is selected, typing formatting characters (*, **, _, ~~, `) wraps the selection instead of replacing it.
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

          {activeTab === 'ai' && (
            <div className="preferences-section">
              <p className="preferences-section-description">
                Configure AI model provider for intelligent features.
              </p>

              <div className="preferences-group">
                <label className="preferences-label">AI Provider</label>
                <select
                  className="preferences-select"
                  value={localPreferences.ai?.provider ?? 'anthropic'}
                  onChange={(e) => handleAIChange('provider', e.target.value as AIProvider)}
                >
                  {(Object.keys(PROVIDER_DISPLAY_NAMES) as AIProvider[]).map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </option>
                  ))}
                </select>
                <p className="preferences-description">
                  Select your preferred AI model provider.
                </p>
              </div>

              {/* Cloud provider authentication (Anthropic, OpenAI, Gemini) */}
              {PROVIDER_REQUIRES_API_KEY[localPreferences.ai?.provider ?? 'anthropic'] && (
                <div className="preferences-group">
                  <label className="preferences-label">API Key File</label>
                  <div className="preferences-input-with-button">
                    <input
                      type="text"
                      className="preferences-input"
                      value={
                        localPreferences.ai?.provider === 'anthropic'
                          ? localPreferences.ai?.anthropicKeyFile ?? DEFAULT_AI_OPTIONS.anthropicKeyFile
                          : localPreferences.ai?.provider === 'openai'
                          ? localPreferences.ai?.openaiKeyFile ?? DEFAULT_AI_OPTIONS.openaiKeyFile
                          : localPreferences.ai?.geminiKeyFile ?? DEFAULT_AI_OPTIONS.geminiKeyFile
                      }
                      onChange={(e) => {
                        const provider = localPreferences.ai?.provider ?? 'anthropic';
                        switch (provider) {
                          case 'anthropic':
                            handleAIChange('anthropicKeyFile', e.target.value);
                            break;
                          case 'openai':
                            handleAIChange('openaiKeyFile', e.target.value);
                            break;
                          case 'gemini':
                            handleAIChange('geminiKeyFile', e.target.value);
                            break;
                        }
                      }}
                      placeholder="~/.anthropic-api-key"
                    />
                    <button
                      className="preferences-button"
                      onClick={() => handleBrowseKeyFile(localPreferences.ai?.provider ?? 'anthropic')}
                    >
                      Browse
                    </button>
                    {aiKeyStatus?.available && (
                      <span className="preferences-inline-check" title={
                        aiKeyStatus.source === 'file'
                          ? `Key found in file: ${aiKeyStatus.filePath}`
                          : `Key found in environment: ${aiKeyStatus.envVar}`
                      }>✓</span>
                    )}
                  </div>
                  <p className="preferences-description">
                    Path to a file containing your API key. Falls back to environment variable if file not found.
                  </p>
                </div>
              )}

              {/* Local provider endpoint (Ollama, DMR) */}
              {!PROVIDER_REQUIRES_API_KEY[localPreferences.ai?.provider ?? 'anthropic'] && (
                <div className="preferences-group">
                  <label className="preferences-label">Endpoint URL</label>
                  <input
                    type="text"
                    className="preferences-input preferences-input-full-width"
                    value={
                      localPreferences.ai?.provider === 'ollama'
                        ? localPreferences.ai?.ollamaEndpoint ?? DEFAULT_AI_OPTIONS.ollamaEndpoint
                        : localPreferences.ai?.dmrEndpoint ?? DEFAULT_AI_OPTIONS.dmrEndpoint
                    }
                    onChange={(e) => {
                      const provider = localPreferences.ai?.provider ?? 'ollama';
                      if (provider === 'ollama') {
                        handleAIChange('ollamaEndpoint', e.target.value);
                      } else {
                        handleAIChange('dmrEndpoint', e.target.value);
                      }
                    }}
                    placeholder="http://localhost:11434"
                  />
                  <p className="preferences-description">
                    URL of the local model server.
                  </p>
                </div>
              )}

              {/* Test connection button with inline status */}
              <div className="preferences-group">
                <div className="preferences-button-row">
                  <button
                    className="preferences-button preferences-button-primary"
                    onClick={handleTestConnection}
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Testing...' : 'Test Connection'}
                  </button>
                  {aiConnectionStatus?.connected && (
                    <span className="preferences-inline-check">✓</span>
                  )}
                  {aiConnectionStatus && !aiConnectionStatus.connected && (
                    <span className="preferences-inline-error" title={aiConnectionStatus.error || 'Connection failed'}>✗</span>
                  )}
                  {aiError && aiConnectionStatus?.connected && (
                    <span className="preferences-inline-error" title={aiError}>!</span>
                  )}
                </div>
              </div>

              {/* Model selection - always shown, disabled when no models */}
              <div className="preferences-group">
                <label className="preferences-label">Model</label>
                <select
                  className="preferences-select"
                  value={getSelectedModelForProvider(localPreferences.ai || DEFAULT_AI_OPTIONS, localPreferences.ai?.provider ?? 'anthropic') ?? ''}
                  onChange={(e) => handleAIChange(getModelFieldForProvider(localPreferences.ai?.provider ?? 'anthropic'), e.target.value || null)}
                  disabled={aiModels.length === 0}
                >
                  {aiModels.length === 0 ? (
                    <option value="">
                      {aiLoading ? 'Loading models...' : 'Test connection to load models'}
                    </option>
                  ) : (
                    <>
                      <option value="">Select a model...</option>
                      {aiModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.displayName}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <p className="preferences-description">
                  Select the AI model to use for intelligent features.
                </p>
              </div>

              {/* Show Tool Usage toggle */}
              <div className="preferences-group">
                <label className="preferences-checkbox-label">
                  <input
                    type="checkbox"
                    checked={localPreferences.chat?.showToolUsage ?? false}
                    onChange={(e) => handleChatChange('showToolUsage', e.target.checked)}
                  />
                  <span>Show Tool Usage</span>
                </label>
                <p className="preferences-description">
                  Display tool calls and results in the AI chat panel.
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
