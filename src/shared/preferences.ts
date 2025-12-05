//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import { FileType } from './fileTypes';

export type ThemeSetting = 'light' | 'dark' | 'system';
export type DefaultOpenMode = 'view' | 'edit';
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

export interface FileTypeDefaults {
  markdown: DefaultOpenMode;
  json: DefaultOpenMode;
  yaml: DefaultOpenMode;
  xml: DefaultOpenMode;
  javascript: DefaultOpenMode;
  typescript: DefaultOpenMode;
  css: DefaultOpenMode;
  html: DefaultOpenMode;
  python: DefaultOpenMode;
  sql: DefaultOpenMode;
  shell: DefaultOpenMode;
  plaintext: DefaultOpenMode;
}

export interface EditorOptions {
  showColumnRuler: boolean;
  showCurrentLineHighlight: boolean;
}

export const DEFAULT_EDITOR_OPTIONS: EditorOptions = {
  showColumnRuler: true,
  showCurrentLineHighlight: true,
};

export interface Preferences {
  autoReload: boolean;
  autoSave: boolean;
  openLinksInNewTab: boolean;
  theme: ThemeSetting;
  fileTypeDefaults: FileTypeDefaults;
  formatting: FormattingOptions;
  editor: EditorOptions;
}

export const DEFAULT_FILE_TYPE_DEFAULTS: FileTypeDefaults = {
  markdown: 'view',
  json: 'view',
  yaml: 'view',
  xml: 'view',
  javascript: 'view',
  typescript: 'view',
  css: 'view',
  html: 'view',
  python: 'view',
  sql: 'view',
  shell: 'view',
  plaintext: 'view',
};

export const DEFAULT_PREFERENCES: Preferences = {
  autoReload: true,
  autoSave: false,
  openLinksInNewTab: false,
  theme: 'system',
  fileTypeDefaults: DEFAULT_FILE_TYPE_DEFAULTS,
  formatting: DEFAULT_FORMATTING_OPTIONS,
  editor: DEFAULT_EDITOR_OPTIONS,
};

// Labels for file types in the preferences panel
export const FILE_TYPE_LABELS: Record<FileType, string> = {
  markdown: 'Markdown (.md, .markdown, .mdx)',
  json: 'JSON (.json, .jsonc, .json5)',
  yaml: 'YAML (.yaml, .yml)',
  xml: 'XML (.xml, .svg, .xsd, .xsl)',
  javascript: 'JavaScript (.js, .mjs, .cjs, .jsx)',
  typescript: 'TypeScript (.ts, .tsx)',
  css: 'CSS (.css, .scss, .sass, .less)',
  html: 'HTML (.html, .htm, .xhtml)',
  python: 'Python (.py, .pyw, .pyi)',
  sql: 'SQL (.sql)',
  shell: 'Shell Scripts (.sh, .bash, .ps1, .bat)',
  plaintext: 'Plain Text (.txt, .log, .ini, .conf)',
};
