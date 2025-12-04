//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import { visit } from 'unist-util-visit';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';

// Supported admonition types (expanded to include MkDocs types)
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

// Map aliases to canonical types
const TYPE_ALIASES: Record<string, AdmonitionType> = {
  note: 'note',
  tip: 'tip',
  hint: 'tip',
  important: 'important',
  warning: 'warning',
  warn: 'warning',
  caution: 'caution',
  attention: 'caution',
  danger: 'danger',
  error: 'danger',
  info: 'info',
  todo: 'info',
  abstract: 'abstract',
  summary: 'abstract',
  tldr: 'abstract',
  success: 'success',
  check: 'success',
  done: 'success',
  question: 'question',
  help: 'question',
  faq: 'question',
  example: 'example',
  quote: 'quote',
  cite: 'quote',
  bug: 'bug',
  failure: 'failure',
  fail: 'failure',
  missing: 'failure',
};

// Map types to GitHub-compatible types (for preprocessing)
const TYPE_TO_GITHUB: Record<string, string> = {
  note: 'NOTE',
  tip: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'CAUTION',
  danger: 'CAUTION', // GitHub doesn't have danger, use caution
  info: 'NOTE',
  abstract: 'NOTE',
  success: 'TIP',
  question: 'NOTE',
  example: 'NOTE',
  quote: 'NOTE',
  bug: 'WARNING',
  failure: 'CAUTION',
};

export interface AdmonitionNode {
  type: 'admonition';
  admonitionType: AdmonitionType;
  title?: string;
  children: Blockquote['children'];
}

// GitHub-style: > [!NOTE]
const GITHUB_ADMONITION_REGEX =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER|INFO|ABSTRACT|SUCCESS|QUESTION|EXAMPLE|QUOTE|BUG|FAILURE)\](?:\s*\n)?/i;

// MkDocs-style header: !!! type "optional title"
const MKDOCS_HEADER_REGEX = /^!!!\s+(\w+)(?:\s+"([^"]*)")?/;

/**
 * Preprocesses markdown content to convert MkDocs-style admonitions
 * to a format the parser can handle (GitHub-style blockquotes).
 *
 * Converts:
 *   !!! danger "Title"
 *       Content here
 *       More content
 *
 * To:
 *   > [!DANGER]
 *   > **Title**
 *   >
 *   > Content here
 *   > More content
 */
export function preprocessAdmonitions(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(MKDOCS_HEADER_REGEX);

    if (match) {
      const rawType = match[1].toLowerCase();
      const canonicalType = TYPE_ALIASES[rawType] || 'note';
      const githubType = TYPE_TO_GITHUB[canonicalType] || 'NOTE';
      const customTitle = match[2];

      // Start the GitHub-style admonition
      result.push(`> [!${githubType}]`);

      // Add custom title if provided
      if (customTitle) {
        result.push(`> **${customTitle}**`);
        result.push(`>`);
      }

      // Collect indented content lines
      i++;
      while (i < lines.length) {
        const contentLine = lines[i];

        // Check if line is indented (part of admonition) or empty
        if (contentLine.startsWith('    ') || contentLine.startsWith('\t')) {
          // Remove the indent and add as blockquote
          const unindented = contentLine.startsWith('    ')
            ? contentLine.slice(4)
            : contentLine.slice(1);
          result.push(`> ${unindented}`);
          i++;
        } else if (contentLine.trim() === '') {
          // Empty line - could be inside or after admonition
          // Look ahead to see if next line is still indented
          if (
            i + 1 < lines.length &&
            (lines[i + 1].startsWith('    ') || lines[i + 1].startsWith('\t'))
          ) {
            result.push(`>`);
            i++;
          } else {
            // End of admonition
            break;
          }
        } else {
          // Non-indented, non-empty line - end of admonition
          break;
        }
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

/**
 * Remark plugin to transform admonitions into custom nodes.
 *
 * Supports GitHub-style alerts (including extended types):
 *   > [!NOTE]
 *   > Content here
 *
 * Note: MkDocs-style admonitions should be preprocessed using
 * preprocessAdmonitions() before parsing.
 */
export function remarkAdmonitions() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) => {
      if (!parent || index === undefined) return;

      const firstChild = node.children[0];
      if (!firstChild || firstChild.type !== 'paragraph') return;

      const paragraph = firstChild as Paragraph;
      const firstTextNode = paragraph.children[0];
      if (!firstTextNode || firstTextNode.type !== 'text') return;

      const text = (firstTextNode as Text).value;
      const match = text.match(GITHUB_ADMONITION_REGEX);

      if (!match) return;

      const rawType = match[1].toLowerCase();
      const admonitionType = (TYPE_ALIASES[rawType] ||
        'note') as AdmonitionType;

      // Create new children without the marker line
      const newChildren = [...node.children];

      // Check if there's a custom title (bold text on next line)
      let customTitle: string | undefined;
      const remainingText = text.slice(match[0].length);

      if (remainingText) {
        // There's text after the marker on the same line
        (firstTextNode as Text).value = remainingText;
      } else if (paragraph.children.length === 1) {
        // The paragraph only contains the marker, remove it
        newChildren.shift();

        // Check if next child is a paragraph with bold text (custom title)
        if (
          newChildren[0]?.type === 'paragraph' &&
          (newChildren[0] as Paragraph).children[0]?.type === 'strong'
        ) {
          const strongNode = (newChildren[0] as Paragraph).children[0];
          if (
            strongNode.type === 'strong' &&
            strongNode.children[0]?.type === 'text'
          ) {
            customTitle = (strongNode.children[0] as Text).value;
            // Remove the title paragraph if it only contains the title
            if ((newChildren[0] as Paragraph).children.length === 1) {
              newChildren.shift();
            }
          }
        }
      } else {
        // There's more content after the marker on the same line
        const newParagraph: Paragraph = {
          type: 'paragraph',
          children: paragraph.children.slice(1),
        };

        if (
          newParagraph.children[0]?.type === 'text' &&
          (newParagraph.children[0] as Text).value.startsWith('\n')
        ) {
          (newParagraph.children[0] as Text).value = (
            newParagraph.children[0] as Text
          ).value.slice(1);
        }

        newChildren[0] = newParagraph;
      }

      const admonitionNode: AdmonitionNode = {
        type: 'admonition',
        admonitionType,
        title: customTitle,
        children: newChildren,
      };

      (parent.children as unknown[])[index] = admonitionNode;
    });
  };
}

export default remarkAdmonitions;
