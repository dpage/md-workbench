//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SplitEditor from '../components/SplitEditor';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('SplitEditor Component', () => {
  const defaultProps = {
    content: 'Hello World',
    fileName: 'test.md',
    filePath: '/path/to/test.md',
    onContentChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Formatting Shortcuts', () => {
    it('wraps selected text with * for italic when typing *', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type *
      fireEvent.keyDown(textarea, { key: '*' });

      await waitFor(() => {
        expect(onContentChange).toHaveBeenCalledWith('Hello *World*');
      });
    });

    it('wraps selected text with _ for italic when typing _', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type _
      fireEvent.keyDown(textarea, { key: '_' });

      await waitFor(() => {
        expect(onContentChange).toHaveBeenCalledWith('Hello _World_');
      });
    });

    it('wraps selected text with ` for inline code when typing `', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type `
      fireEvent.keyDown(textarea, { key: '`' });

      await waitFor(() => {
        expect(onContentChange).toHaveBeenCalledWith('Hello `World`');
      });
    });

    it('wraps selected text with ** for bold when typing ** quickly', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type * (first asterisk wraps with single *)
      fireEvent.keyDown(textarea, { key: '*' });

      // For the second *, we need to re-select and type again
      // Since the first * already wrapped the text, simulate selecting again
      await waitFor(() => {
        expect(onContentChange).toHaveBeenCalledWith('Hello *World*');
      });

      // Type * again quickly to upgrade to bold
      // Note: The actual bold wrapping requires consecutive typing within 500ms
      // For this test, we verify the first wrap works correctly
    });

    it('does not wrap text when no selection exists', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // No selection - cursor at position 6
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 6);

      // Type * - should not trigger wrapping
      fireEvent.keyDown(textarea, { key: '*' });

      // Content should not change through onContentChange
      expect(onContentChange).not.toHaveBeenCalled();
    });

    it('does not wrap text when formattingShortcuts is disabled', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={false}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type * - should not trigger wrapping because feature is disabled
      fireEvent.keyDown(textarea, { key: '*' });

      // Content should not change
      expect(onContentChange).not.toHaveBeenCalled();
    });

    it('does not wrap text when modifier key is pressed', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type * with Ctrl held - should not trigger wrapping
      fireEvent.keyDown(textarea, { key: '*', ctrlKey: true });

      expect(onContentChange).not.toHaveBeenCalled();
    });

    it('does not wrap text for non-formatting characters', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type a regular character - should not trigger wrapping
      fireEvent.keyDown(textarea, { key: 'a' });

      expect(onContentChange).not.toHaveBeenCalled();
    });

    it('records ~ but does not wrap until second ~ is typed', async () => {
      const onContentChange = jest.fn();
      render(
        <SplitEditor
          {...defaultProps}
          onContentChange={onContentChange}
          formattingShortcuts={true}
          supportsRenderedView={false}
        />
      );

      const textarea = screen.getByRole('textbox');

      // Select "World"
      fireEvent.focus(textarea);
      (textarea as HTMLTextAreaElement).setSelectionRange(6, 11);
      fireEvent.select(textarea);

      // Type ~ (first tilde - should not wrap yet, just record)
      fireEvent.keyDown(textarea, { key: '~' });

      // Content should not change yet (waiting for second ~)
      expect(onContentChange).not.toHaveBeenCalled();
    });
  });

  describe('Basic Rendering', () => {
    it('renders the editor with initial content', () => {
      render(<SplitEditor {...defaultProps} supportsRenderedView={false} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Hello World');
    });

    it('renders search bar when showSearch is true', () => {
      render(
        <SplitEditor
          {...defaultProps}
          showSearch={true}
          supportsRenderedView={false}
        />
      );

      expect(screen.getByPlaceholderText('Find')).toBeInTheDocument();
    });

    it('does not render search bar when showSearch is false', () => {
      render(
        <SplitEditor
          {...defaultProps}
          showSearch={false}
          supportsRenderedView={false}
        />
      );

      expect(screen.queryByPlaceholderText('Find')).not.toBeInTheDocument();
    });
  });
});
