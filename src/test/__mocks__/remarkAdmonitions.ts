//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Mock for remarkAdmonitions plugin
export type AdmonitionType =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution'
  | 'danger'
  | 'info'
  | 'abstract'
  | 'success'
  | 'question'
  | 'example'
  | 'quote'
  | 'bug'
  | 'failure';

export interface AdmonitionNode {
  type: 'admonition';
  admonitionType: AdmonitionType;
  title?: string;
  children: unknown[];
}

export function preprocessAdmonitions(content: string): string {
  return content;
}

export function preprocessAdmonitionsWithLineMap(content: string) {
  return { content, lineMap: content.split('\n').map((_, i) => i) };
}

export function remarkAdmonitions() {
  return () => {};
}

export default remarkAdmonitions;
