//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../components/Toolbar';

describe('Toolbar Component', () => {
  const mockOnOpenFile = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnForward = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all toolbar buttons', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={false}
      />
    );

    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go forward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument();
  });

  it('calls onOpenFile when Open button is clicked', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /open file/i }));
    expect(mockOnOpenFile).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back button is clicked and enabled', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={true}
        canGoForward={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('calls onForward when Forward button is clicked and enabled', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /go forward/i }));
    expect(mockOnForward).toHaveBeenCalledTimes(1);
  });

  it('disables Back button when canGoBack is false', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={true}
      />
    );

    const backButton = screen.getByRole('button', { name: /go back/i });
    expect(backButton).toBeDisabled();
  });

  it('disables Forward button when canGoForward is false', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={true}
        canGoForward={false}
      />
    );

    const forwardButton = screen.getByRole('button', { name: /go forward/i });
    expect(forwardButton).toBeDisabled();
  });

  it('enables Back button when canGoBack is true', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={true}
        canGoForward={false}
      />
    );

    const backButton = screen.getByRole('button', { name: /go back/i });
    expect(backButton).not.toBeDisabled();
  });

  it('enables Forward button when canGoForward is true', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={true}
      />
    );

    const forwardButton = screen.getByRole('button', { name: /go forward/i });
    expect(forwardButton).not.toBeDisabled();
  });

  it('does not call onBack when Back button is disabled', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={false}
      />
    );

    const backButton = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backButton);
    expect(mockOnBack).not.toHaveBeenCalled();
  });

  it('does not call onForward when Forward button is disabled', () => {
    render(
      <Toolbar
        onOpenFile={mockOnOpenFile}
        onBack={mockOnBack}
        onForward={mockOnForward}
        canGoBack={false}
        canGoForward={false}
      />
    );

    const forwardButton = screen.getByRole('button', { name: /go forward/i });
    fireEvent.click(forwardButton);
    expect(mockOnForward).not.toHaveBeenCalled();
  });
});
