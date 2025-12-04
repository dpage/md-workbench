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
import App from '../App';

describe('App Component', () => {
  it('renders the welcome screen when no tabs are open', () => {
    render(<App />);
    expect(screen.getByText('Markdown Workbench')).toBeInTheDocument();
    expect(screen.getByText('A simple markdown file viewer')).toBeInTheDocument();
  });

  it('renders the toolbar', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go forward/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument();
  });

  it('renders the open file button', () => {
    render(<App />);
    expect(screen.getByText('Open Markdown File')).toBeInTheDocument();
  });

  it('calls openFileDialog when clicking the open button', () => {
    render(<App />);
    const openButton = screen.getByText('Open Markdown File');
    fireEvent.click(openButton);
    expect(window.electronAPI.openFileDialog).toHaveBeenCalled();
  });

  it('sets up event listeners on mount', () => {
    render(<App />);
    expect(window.electronAPI.onFileOpened).toHaveBeenCalled();
    expect(window.electronAPI.onFileChanged).toHaveBeenCalled();
    expect(window.electronAPI.onCloseCurrentTab).toHaveBeenCalled();
    expect(window.electronAPI.onThemeChanged).toHaveBeenCalled();
    expect(window.electronAPI.onRestoreSession).toHaveBeenCalled();
  });

  it('has the correct default theme attribute', () => {
    render(<App />);
    const appDiv = document.querySelector('.app');
    expect(appDiv).toHaveAttribute('data-theme', 'dark');
  });
});
