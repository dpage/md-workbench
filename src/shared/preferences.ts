//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

export type ThemeSetting = 'light' | 'dark' | 'system';
export type MarkdownViewMode = 'preview' | 'edit' | 'split';
export type SqlDialect = 'postgresql' | 'sqlite' | 'sql';
export type EndOfLine = 'lf' | 'crlf' | 'auto';

export interface FormattingOptions {
  indentSize: number;
  useTabs: boolean;
  maxLineLength: number;
  wrapProse: boolean;
  endOfLine: EndOfLine;
  formatOnSave: boolean;
  sortJsonKeys: boolean;
  sqlDialect: SqlDialect;
  sqlUppercaseKeywords: boolean;
}

export const DEFAULT_FORMATTING_OPTIONS: FormattingOptions = {
  indentSize: 4,
  useTabs: false,
  maxLineLength: 79,
  wrapProse: true,
  endOfLine: 'auto',
  formatOnSave: false,
  sortJsonKeys: true,
  sqlDialect: 'postgresql',
  sqlUppercaseKeywords: true,
};

export interface MarkdownOptions {
  defaultViewMode: MarkdownViewMode;
  rememberViewModes: boolean;
}

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = {
  defaultViewMode: 'preview',
  rememberViewModes: true,
};

export interface EditorOptions {
  showLineNumbers: boolean;
  showColumnRuler: boolean;
  showCurrentLineHighlight: boolean;
  showStatusBar: boolean;
}

export const DEFAULT_EDITOR_OPTIONS: EditorOptions = {
  showLineNumbers: true,
  showColumnRuler: true,
  showCurrentLineHighlight: true,
  showStatusBar: true,
};

export interface Preferences {
  autoReload: boolean;
  autoSave: boolean;
  openLinksInNewTab: boolean;
  theme: ThemeSetting;
  markdown: MarkdownOptions;
  formatting: FormattingOptions;
  editor: EditorOptions;
}

export const DEFAULT_PREFERENCES: Preferences = {
  autoReload: true,
  autoSave: false,
  openLinksInNewTab: false,
  theme: 'system',
  markdown: DEFAULT_MARKDOWN_OPTIONS,
  formatting: DEFAULT_FORMATTING_OPTIONS,
  editor: DEFAULT_EDITOR_OPTIONS,
};
