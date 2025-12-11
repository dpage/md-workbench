//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import {
  DEFAULT_PREFERENCES,
  DEFAULT_EDITOR_OPTIONS,
  DEFAULT_FORMATTING_OPTIONS,
  DEFAULT_MARKDOWN_OPTIONS,
  type Preferences,
  type EditorOptions,
} from '../preferences';

describe('Preferences', () => {
  describe('DEFAULT_EDITOR_OPTIONS', () => {
    it('should have all required editor options', () => {
      expect(DEFAULT_EDITOR_OPTIONS).toHaveProperty('showLineNumbers');
      expect(DEFAULT_EDITOR_OPTIONS).toHaveProperty('showColumnRuler');
      expect(DEFAULT_EDITOR_OPTIONS).toHaveProperty('showCurrentLineHighlight');
      expect(DEFAULT_EDITOR_OPTIONS).toHaveProperty('showStatusBar');
      expect(DEFAULT_EDITOR_OPTIONS).toHaveProperty('softWrap');
    });

    it('should have correct default values', () => {
      expect(DEFAULT_EDITOR_OPTIONS.showLineNumbers).toBe(true);
      expect(DEFAULT_EDITOR_OPTIONS.showColumnRuler).toBe(true);
      expect(DEFAULT_EDITOR_OPTIONS.showCurrentLineHighlight).toBe(true);
      expect(DEFAULT_EDITOR_OPTIONS.showStatusBar).toBe(true);
      expect(DEFAULT_EDITOR_OPTIONS.softWrap).toBe(false);
    });

    it('should have softWrap disabled by default', () => {
      // Soft wrap should be off by default to maintain traditional editor behavior
      expect(DEFAULT_EDITOR_OPTIONS.softWrap).toBe(false);
    });
  });

  describe('DEFAULT_FORMATTING_OPTIONS', () => {
    it('should have all required formatting options', () => {
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('indentSize');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('useTabs');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('maxLineLength');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('wrapProse');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('endOfLine');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('formatOnSave');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('sortJsonKeys');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('sqlDialect');
      expect(DEFAULT_FORMATTING_OPTIONS).toHaveProperty('sqlUppercaseKeywords');
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_FORMATTING_OPTIONS.indentSize).toBe(4);
      expect(DEFAULT_FORMATTING_OPTIONS.useTabs).toBe(false);
      expect(DEFAULT_FORMATTING_OPTIONS.maxLineLength).toBe(79);
      expect(DEFAULT_FORMATTING_OPTIONS.formatOnSave).toBe(false);
    });
  });

  describe('DEFAULT_MARKDOWN_OPTIONS', () => {
    it('should have all required markdown options', () => {
      expect(DEFAULT_MARKDOWN_OPTIONS).toHaveProperty('defaultViewMode');
      expect(DEFAULT_MARKDOWN_OPTIONS).toHaveProperty('rememberViewModes');
    });

    it('should default to preview mode', () => {
      expect(DEFAULT_MARKDOWN_OPTIONS.defaultViewMode).toBe('preview');
    });
  });

  describe('DEFAULT_PREFERENCES', () => {
    it('should have all required top-level preferences', () => {
      expect(DEFAULT_PREFERENCES).toHaveProperty('autoReload');
      expect(DEFAULT_PREFERENCES).toHaveProperty('autoSave');
      expect(DEFAULT_PREFERENCES).toHaveProperty('openLinksInNewTab');
      expect(DEFAULT_PREFERENCES).toHaveProperty('theme');
      expect(DEFAULT_PREFERENCES).toHaveProperty('markdown');
      expect(DEFAULT_PREFERENCES).toHaveProperty('formatting');
      expect(DEFAULT_PREFERENCES).toHaveProperty('editor');
    });

    it('should include editor options with soft wrap', () => {
      expect(DEFAULT_PREFERENCES.editor).toBeDefined();
      expect(DEFAULT_PREFERENCES.editor.softWrap).toBe(false);
    });

    it('should use system theme by default', () => {
      expect(DEFAULT_PREFERENCES.theme).toBe('system');
    });
  });

  describe('Type safety', () => {
    it('should allow valid EditorOptions', () => {
      const options: EditorOptions = {
        showLineNumbers: true,
        showColumnRuler: false,
        showCurrentLineHighlight: true,
        showStatusBar: true,
        softWrap: true,
      };
      expect(options.softWrap).toBe(true);
    });

    it('should allow valid Preferences', () => {
      const prefs: Preferences = {
        ...DEFAULT_PREFERENCES,
        editor: {
          ...DEFAULT_PREFERENCES.editor,
          softWrap: true,
        },
      };
      expect(prefs.editor.softWrap).toBe(true);
    });
  });
});
