//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import { fromMarkdown } from 'mdast-util-from-markdown';
import { math } from 'micromark-extension-math';
import { mathFromMarkdown } from 'mdast-util-math';
import type { Nodes } from 'mdast';
import { mathTextPandoc } from '../mathTextPandoc';

function inlineMath(markdown: string): string[] {
  const syntax = math();
  syntax.text = { [36]: mathTextPandoc() };
  const tree = fromMarkdown(markdown, {
    extensions: [syntax],
    mdastExtensions: [mathFromMarkdown()],
  });

  const found: string[] = [];
  const walk = (node: Nodes) => {
    if (node.type === 'inlineMath') found.push(node.value);
    if ('children' in node) node.children.forEach(walk);
  };
  walk(tree);
  return found;
}

describe('mathTextPandoc', () => {
  it.each([
    ['two prices in a sentence', 'Costs $20,000 and $30,000 a year.', []],
    [
      'prices with words between',
      'About $275 a month on one host. The other is at $800 a month.',
      [],
    ],
    ['opening $ followed by a space', 'Pay $ 5 now, $x$ later.', ['x']],
    ['closing $ followed by a digit', '$a$1 and more', []],
    ['simple formula', 'Area is $x^2$.', ['x^2']],
    ['formula with spaces inside', 'Then $a + b = c$ holds.', ['a + b = c']],
    ['escaped dollar', 'Price \\$5 and $y$.', ['y']],
    ['double-dollar inline', 'Inline $$a $b$$ here.', ['a $b']],
    [
      'unclosable $ skipped inside a formula',
      '$a $b$ c',
      ['a $b'],
    ],
  ])('%s', (_name, markdown, expected) => {
    expect(inlineMath(markdown)).toEqual(expected);
  });

  it('still parses block maths', () => {
    const syntax = math();
    syntax.text = { [36]: mathTextPandoc() };
    const tree = fromMarkdown('$$\nE = mc^2\n$$', {
      extensions: [syntax],
      mdastExtensions: [mathFromMarkdown()],
    });
    expect(tree.children[0]).toMatchObject({ type: 'math', value: 'E = mc^2' });
  });
});
