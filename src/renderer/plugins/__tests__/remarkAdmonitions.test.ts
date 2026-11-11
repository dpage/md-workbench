//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// unist-util-visit is ESM-only; the preprocessor doesn't use it
jest.mock('unist-util-visit', () => ({ visit: jest.fn() }));

import { preprocessAdmonitions, preprocessAdmonitionsWithLineMap } from '../remarkAdmonitions';

describe('preprocessAdmonitionsWithLineMap', () => {
  it('maps generated blockquote lines to the admonition source lines', () => {
    const content = [
      'Intro',
      '!!! note "Title"',
      '    First',
      '',
      '    Second',
      'After',
    ].join('\n');

    const result = preprocessAdmonitionsWithLineMap(content);

    expect(result.content.split('\n')).toEqual([
      'Intro',
      '> [!NOTE]',
      '> **Title**',
      '>',
      '> First',
      '>',
      '> Second',
      'After',
    ]);
    expect(result.lineMap).toEqual([0, 1, 1, 1, 2, 3, 4, 5]);
  });

  it('produces the same content as preprocessAdmonitions', () => {
    const content = '!!! warning\n    Careful\n\nText';
    expect(preprocessAdmonitionsWithLineMap(content).content).toBe(preprocessAdmonitions(content));
  });
});
