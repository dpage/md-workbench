//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Helpers for mapping a selection in the rendered preview back to the
// markdown source. The preview renders preprocessed content, so each
// preprocessor records which input line every output line came from.

import type { Root, RootContent } from 'hast';
import type { SelectionInfo } from '../../shared/chatTypes';

// Output of a line-based preprocessor: lineMap[outputLine] = inputLine (0-based)
export interface PreprocessResult {
  content: string;
  lineMap: number[];
}

export const SOURCE_START_ATTR = 'data-source-start';
export const SOURCE_END_ATTR = 'data-source-end';

// Build a PreprocessResult from output lines and the input line each came from
export function fromLines(lines: string[], origins: number[]): PreprocessResult {
  return { content: lines.join('\n'), lineMap: origins };
}

// Line map for a preprocessor that leaves the line count unchanged
export function identityLineMap(content: string): number[] {
  return content.split('\n').map((_, i) => i);
}

// Compose line maps applied in order (first map is the first preprocessor)
export function composeLineMaps(maps: number[][]): number[] {
  if (maps.length === 0) return [];
  const last = maps[maps.length - 1];
  return last.map((line) => {
    let result = line;
    for (let i = maps.length - 2; i >= 0; i--) {
      result = maps[i][Math.min(result, maps[i].length - 1)];
    }
    return result;
  });
}

// Rehype plugin: tag every element that has a source position with the
// (1-based) line range it came from in the content passed to the parser
// (a plain walk rather than unist-util-visit, which is ESM-only and can't be
// loaded by the tests)
export function rehypeSourceLines() {
  const tag = (nodes: RootContent[]) => {
    for (const node of nodes) {
      if (node.type !== 'element') continue;
      const position = node.position;
      if (position) {
        node.properties = {
          ...node.properties,
          dataSourceStart: position.start.line,
          dataSourceEnd: position.end.line,
        };
      }
      tag(node.children);
    }
  };
  return (tree: Root) => tag(tree.children);
}

function nearestTaggedElement(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.hasAttribute(SOURCE_START_ATTR)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

// Find the (1-based) line range in the parsed content covered by a DOM range
// inside the rendered preview
export function rangeToParsedLines(
  range: Range,
  root: HTMLElement
): { start: number; end: number } | null {
  const tagged: HTMLElement[] = [];
  const startEl = nearestTaggedElement(range.startContainer, root);
  const endEl = nearestTaggedElement(range.endContainer, root);
  if (startEl) tagged.push(startEl);
  if (endEl) tagged.push(endEl);

  // An end of the range that lies outside any tagged element (e.g. between
  // blocks, or in generated markup) falls back to the tagged elements inside
  // the range, excluding ancestors of the whole range or of the other end
  if (!startEl || !endEl) {
    const common = range.commonAncestorContainer;
    const found = startEl ?? endEl;
    root.querySelectorAll<HTMLElement>(`[${SOURCE_START_ATTR}]`).forEach((el) => {
      if (range.intersectsNode(el) && !el.contains(common) && !(found && el !== found && el.contains(found))) {
        tagged.push(el);
      }
    });
  }

  let start = Infinity;
  let end = -Infinity;
  for (const el of tagged) {
    const elStart = Number(el.getAttribute(SOURCE_START_ATTR));
    const elEnd = Number(el.getAttribute(SOURCE_END_ATTR) ?? elStart);
    if (Number.isFinite(elStart)) start = Math.min(start, elStart);
    if (Number.isFinite(elEnd)) end = Math.max(end, elEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
}

// Convert a (1-based) line range in the parsed content into a selection of
// the corresponding whole lines of the original source
export function sourceSelectionFromParsedLines(
  source: string,
  lineMap: number[],
  parsedStart: number,
  parsedEnd: number
): SelectionInfo | null {
  if (lineMap.length === 0) return null;
  const clamp = (line: number) => Math.max(0, Math.min(line - 1, lineMap.length - 1));
  const firstLine = lineMap[clamp(parsedStart)];
  const lastLine = Math.max(firstLine, lineMap[clamp(parsedEnd)]);

  const lines = source.split('\n');
  let start = 0;
  for (let i = 0; i < firstLine && i < lines.length; i++) {
    start += lines[i].length + 1;
  }
  let end = start;
  for (let i = firstLine; i <= lastLine && i < lines.length; i++) {
    end += lines[i].length + (i < lastLine ? 1 : 0);
  }

  if (end <= start) return null;
  return { start, end, text: source.substring(start, end), source: 'preview' };
}
