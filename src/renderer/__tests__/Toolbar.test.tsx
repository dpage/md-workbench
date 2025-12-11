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
  const mockOnNewFile = jest.fn();
  const mockOnOpenFile = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnSaveAs = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnForward = jest.fn();
  const mockOnToggleViewSource = jest.fn();
  const mockOnToggleEditMode = jest.fn();

  const defaultProps = {
    onNewFile: mockOnNewFile,
    onOpenFile: mockOnOpenFile,
    onSave: mockOnSave,
    onSaveAs: mockOnSaveAs,
    onBack: mockOnBack,
    onForward: mockOnForward,
    canGoBack: false,
    canGoForward: false,
    viewSource: false,
    onToggleViewSource: mockOnToggleViewSource,
    editMode: false,
    onToggleEditMode: mockOnToggleEditMode,
    hasActiveTab: false,
    isDirty: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all toolbar buttons', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go forward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
  });

  it('calls onNewFile when New button is clicked', () => {
    render(<Toolbar {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /new file/i }));
    expect(mockOnNewFile).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFile when Open button is clicked', () => {
    render(<Toolbar {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /open file/i }));
    expect(mockOnOpenFile).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back button is clicked and enabled', () => {
    render(<Toolbar {...defaultProps} canGoBack={true} />);

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('calls onForward when Forward button is clicked and enabled', () => {
    render(<Toolbar {...defaultProps} canGoForward={true} />);

    fireEvent.click(screen.getByRole('button', { name: /go forward/i }));
    expect(mockOnForward).toHaveBeenCalledTimes(1);
  });

  it('disables Back button when canGoBack is false', () => {
    render(<Toolbar {...defaultProps} canGoBack={false} canGoForward={true} />);

    const backButton = screen.getByRole('button', { name: /go back/i });
    expect(backButton).toBeDisabled();
  });

  it('disables Forward button when canGoForward is false', () => {
    render(<Toolbar {...defaultProps} canGoBack={true} canGoForward={false} />);

    const forwardButton = screen.getByRole('button', { name: /go forward/i });
    expect(forwardButton).toBeDisabled();
  });

  it('enables Back button when canGoBack is true', () => {
    render(<Toolbar {...defaultProps} canGoBack={true} />);

    const backButton = screen.getByRole('button', { name: /go back/i });
    expect(backButton).not.toBeDisabled();
  });

  it('enables Forward button when canGoForward is true', () => {
    render(<Toolbar {...defaultProps} canGoForward={true} />);

    const forwardButton = screen.getByRole('button', { name: /go forward/i });
    expect(forwardButton).not.toBeDisabled();
  });

  it('does not call onBack when Back button is disabled', () => {
    render(<Toolbar {...defaultProps} canGoBack={false} />);

    const backButton = screen.getByRole('button', { name: /go back/i });
    fireEvent.click(backButton);
    expect(mockOnBack).not.toHaveBeenCalled();
  });

  it('does not call onForward when Forward button is disabled', () => {
    render(<Toolbar {...defaultProps} canGoForward={false} />);

    const forwardButton = screen.getByRole('button', { name: /go forward/i });
    fireEvent.click(forwardButton);
    expect(mockOnForward).not.toHaveBeenCalled();
  });

  it('calls onSave when Save button is clicked and enabled', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={true} isDirty={true} />);

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('calls onSaveAs when Save As button is clicked and enabled', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={true} />);

    fireEvent.click(screen.getByRole('button', { name: /save as/i }));
    expect(mockOnSaveAs).toHaveBeenCalledTimes(1);
  });

  it('disables Save button when no active tab', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={false} />);

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();
  });

  it('disables Save button when file is not dirty', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={true} isDirty={false} />);

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables Save button when file is dirty', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={true} isDirty={true} />);

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('disables Save As button when no active tab', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={false} />);

    const saveAsButton = screen.getByRole('button', { name: /save as/i });
    expect(saveAsButton).toBeDisabled();
  });

  it('enables Save As button when there is an active tab', () => {
    render(<Toolbar {...defaultProps} hasActiveTab={true} />);

    const saveAsButton = screen.getByRole('button', { name: /save as/i });
    expect(saveAsButton).not.toBeDisabled();
  });
});
