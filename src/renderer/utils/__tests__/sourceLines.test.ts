//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import type { Root } from 'hast';
import {
  composeLineMaps,
  identityLineMap,
  rangeToParsedLines,
  rehypeSourceLines,
  sourceSelectionFromParsedLines,
} from '../sourceLines';

describe('sourceLines', () => {
  describe('identityLineMap', () => {
    it('maps each line to itself', () => {
      expect(identityLineMap('a\nb\nc')).toEqual([0, 1, 2]);
    });
  });

  describe('composeLineMaps', () => {
    it('maps the last output back through every preprocessor', () => {
      // First pass expands line 0 into two lines; second pass expands its line 2
      const first = [0, 0, 1];
      const second = [0, 1, 2, 2];
      expect(composeLineMaps([first, second])).toEqual([0, 0, 1, 1]);
    });

    it('returns an empty map when there are no preprocessors', () => {
      expect(composeLineMaps([])).toEqual([]);
    });
  });

  describe('sourceSelectionFromParsedLines', () => {
    const source = 'one\ntwo\nthree\nfour';

    it('returns the whole source lines for a parsed line range', () => {
      expect(sourceSelectionFromParsedLines(source, [0, 1, 2, 3], 2, 3)).toEqual({
        start: 4,
        end: 13,
        text: 'two\nthree',
        source: 'preview',
      });
    });

    it('maps parsed lines through the line map', () => {
      // Parsed lines 1-3 were all generated from source line 1
      const selection = sourceSelectionFromParsedLines(source, [1, 1, 1, 2, 3], 1, 3);
      expect(selection?.text).toBe('two');
    });

    it('clamps lines beyond the end of the map', () => {
      const selection = sourceSelectionFromParsedLines(source, [0, 1, 2, 3], 4, 99);
      expect(selection?.text).toBe('four');
    });

    it('returns null for an empty line', () => {
      expect(sourceSelectionFromParsedLines('a\n\nb', [0, 1, 2], 2, 2)).toBeNull();
    });
  });

  describe('rehypeSourceLines', () => {
    it('tags nested elements with their source lines', () => {
      const position = (start: number, end: number) => ({
        start: { line: start, column: 1 },
        end: { line: end, column: 1 },
      });
      const tree: Root = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'ul',
            properties: {},
            position: position(2, 4),
            children: [
              {
                type: 'element',
                tagName: 'li',
                properties: { className: ['item'] },
                position: position(3, 3),
                children: [{ type: 'text', value: 'x' }],
              },
              { type: 'element', tagName: 'span', properties: {}, children: [] },
            ],
          },
        ],
      };

      rehypeSourceLines()(tree);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ul = tree.children[0] as any;
      expect(ul.properties).toEqual({ dataSourceStart: 2, dataSourceEnd: 4 });
      expect(ul.children[0].properties).toEqual({
        className: ['item'],
        dataSourceStart: 3,
        dataSourceEnd: 3,
      });
      expect(ul.children[1].properties).toEqual({});
    });
  });

  describe('rangeToParsedLines', () => {
    let root: HTMLElement;

    beforeEach(() => {
      root = document.createElement('div');
      root.innerHTML = [
        '<p data-source-start="1" data-source-end="1">First <strong data-source-start="1" data-source-end="1">bold</strong></p>',
        '<div class="generated">Generated</div>',
        '<ul data-source-start="5" data-source-end="7">',
        '<li data-source-start="5" data-source-end="5">Item one</li>',
        '<li data-source-start="6" data-source-end="7">Item two</li>',
        '</ul>',
      ].join('');
      document.body.appendChild(root);
    });

    afterEach(() => {
      root.remove();
    });

    const textOf = (selector: string) => root.querySelector(selector)!.firstChild!;

    it('uses the nearest tagged element at each end', () => {
      const range = document.createRange();
      range.setStart(textOf('strong'), 1);
      range.setEnd(textOf('li:nth-child(2)'), 3);
      expect(rangeToParsedLines(range, root)).toEqual({ start: 1, end: 7 });
    });

    it('returns the lines of a single block', () => {
      const range = document.createRange();
      range.setStart(textOf('li'), 0);
      range.setEnd(textOf('li'), 4);
      expect(rangeToParsedLines(range, root)).toEqual({ start: 5, end: 5 });
    });

    it('falls back to tagged elements inside the range when an end is untagged', () => {
      const range = document.createRange();
      range.setStart(textOf('.generated'), 2);
      range.setEnd(textOf('li'), 4);
      expect(rangeToParsedLines(range, root)).toEqual({ start: 5, end: 5 });
    });

    it('returns null when nothing tagged is selected', () => {
      const range = document.createRange();
      range.setStart(textOf('.generated'), 0);
      range.setEnd(textOf('.generated'), 4);
      expect(rangeToParsedLines(range, root)).toBeNull();
    });
  });
});
