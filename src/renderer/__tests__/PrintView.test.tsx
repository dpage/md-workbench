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
import PrintView from '../components/PrintView';

const defaultProps = {
  fileName: 'test.md',
  filePath: '/path/to/test.md',
};

describe('PrintView Component', () => {
  it('renders markdown into a light-themed container outside the app root', async () => {
    const onReady = jest.fn();
    const { container } = render(
      <PrintView content="# Printed Heading" isMarkdown={true} onReady={onReady} {...defaultProps} />
    );

    const heading = screen.getByText('Printed Heading');
    const printContainer = heading.closest('.print-container');
    expect(printContainer).toHaveAttribute('data-theme', 'light');
    expect(container.contains(printContainer)).toBe(false);

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });

  it('renders non-markdown files as source', async () => {
    const onReady = jest.fn();
    render(
      <PrintView
        content={'key: value\n'}
        isMarkdown={false}
        highlightLanguage="yaml"
        onReady={onReady}
        fileName="test.yaml"
        filePath="/path/to/test.yaml"
      />
    );

    const source = document.querySelector('.print-source');
    expect(source).toHaveTextContent('key: value');

    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });
});
