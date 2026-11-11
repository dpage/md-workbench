//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MarkdownViewer from '../components/MarkdownViewer';

const defaultProps = {
  fileName: 'test.md',
  filePath: '/path/to/test.md',
};

describe('MarkdownViewer Component', () => {
  it('renders markdown content', () => {
    render(<MarkdownViewer content="# Hello World" {...defaultProps} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders paragraphs', () => {
    render(<MarkdownViewer content="This is a paragraph." {...defaultProps} />);
    expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
  });

  it('renders multiple headings', () => {
    const content = `# Heading 1
## Heading 2
### Heading 3`;
    render(<MarkdownViewer content={content} {...defaultProps} />);
    expect(screen.getByText('Heading 1')).toBeInTheDocument();
    expect(screen.getByText('Heading 2')).toBeInTheDocument();
    expect(screen.getByText('Heading 3')).toBeInTheDocument();
  });

  it('renders lists', () => {
    const content = `- Item 1
- Item 2
- Item 3`;
    render(<MarkdownViewer content={content} {...defaultProps} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('renders code blocks', () => {
    const content = '`inline code`';
    render(<MarkdownViewer content={content} {...defaultProps} />);
    expect(screen.getByText('inline code')).toBeInTheDocument();
  });

  it('renders links', () => {
    const content = '[Test Link](https://example.com)';
    render(<MarkdownViewer content={content} {...defaultProps} />);
    const link = screen.getByText('Test Link');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('renders images with resolved paths', () => {
    const content = '![Alt text](./image.png)';
    render(
      <MarkdownViewer
        content={content}
        fileName="test.md"
        filePath="/path/to/docs/test.md"
      />
    );
    const img = screen.getByAltText('Alt text');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      'local-file://' + encodeURIComponent('/path/to/docs/./image.png')
    );
  });

  it('keeps absolute URLs for images', () => {
    const content = '![Alt text](https://example.com/image.png)';
    render(<MarkdownViewer content={content} {...defaultProps} />);
    const img = screen.getByAltText('Alt text');
    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
  });

  describe('search highlighting', () => {
    const search = { query: 'needle', caseSensitive: false, useRegex: false };

    it('finds matches inside inline code', async () => {
      const onMatchCountChange = jest.fn();
      const content = 'A needle in prose.\n`needle`';
      render(
        <MarkdownViewer
          content={content}
          {...defaultProps}
          searchHighlight={search}
          currentMatchIndex={0}
          onMatchCountChange={onMatchCountChange}
          useLinearNavigation={true}
        />
      );
      await waitFor(() => expect(onMatchCountChange).toHaveBeenLastCalledWith(2));
      expect(document.querySelectorAll('mark.search-highlight')).toHaveLength(2);
      expect(document.querySelector('code > mark.search-highlight')).toBeInTheDocument();
    });

    it('does not highlight matches inside fenced code blocks', async () => {
      const onMatchCountChange = jest.fn();
      const content =
        'A needle in prose.\n```sql\nSELECT needle;\n```\n```\nplain needle\n```';
      render(
        <MarkdownViewer
          content={content}
          {...defaultProps}
          searchHighlight={search}
          currentMatchIndex={0}
          onMatchCountChange={onMatchCountChange}
          useLinearNavigation={true}
        />
      );
      await waitFor(() => expect(onMatchCountChange).toHaveBeenLastCalledWith(1));
      expect(document.querySelectorAll('mark.search-highlight')).toHaveLength(1);
      expect(document.querySelector('pre mark')).not.toBeInTheDocument();
    });
  });
});
