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
import App from '../App';

describe('App Component', () => {
  it('renders the welcome screen when no tabs are open', async () => {
    render(<App />);
    await waitFor(() => {
      // Welcome screen has the tagline
      expect(screen.getByText('A thoughtful editor for your documents')).toBeInTheDocument();
    });
    // Check for welcome screen title (there may be multiple "Markdown" texts)
    const markdownTexts = screen.getAllByText('Markdown');
    expect(markdownTexts.length).toBeGreaterThan(0);
  });

  it('renders the toolbar', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /go forward/i })).toBeInTheDocument();
    // Use the toolbar-specific button via class
    const toolbar = document.querySelector('.toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar?.querySelector('.toolbar-button-open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new file/i })).toBeInTheDocument();
  });

  it('renders the welcome screen open file button', async () => {
    render(<App />);
    await waitFor(() => {
      // The welcome screen has "Open File" and "Open Folder" buttons
      const openButtons = screen.getAllByText('Open File');
      expect(openButtons.length).toBeGreaterThan(0);
    });
  });

  it('calls openFileDialog when clicking the welcome screen open button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('A thoughtful editor for your documents')).toBeInTheDocument();
    });
    // Get the welcome screen's Open File button (the one with welcome-btn class)
    const welcomeOpenButton = document.querySelector('.welcome-btn-primary');
    expect(welcomeOpenButton).toBeInTheDocument();
    if (welcomeOpenButton) {
      fireEvent.click(welcomeOpenButton);
      expect(window.electronAPI.openFileDialog).toHaveBeenCalled();
    }
  });

  it('sets up event listeners on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(window.electronAPI.onFileOpened).toHaveBeenCalled();
    });
    expect(window.electronAPI.onFileChanged).toHaveBeenCalled();
    expect(window.electronAPI.onCloseCurrentTab).toHaveBeenCalled();
    expect(window.electronAPI.onThemeChanged).toHaveBeenCalled();
    expect(window.electronAPI.onRestoreSession).toHaveBeenCalled();
    expect(window.electronAPI.onNewFile).toHaveBeenCalled();
  });

  it('has the correct default theme attribute', async () => {
    render(<App />);
    await waitFor(() => {
      const appDiv = document.querySelector('.app');
      expect(appDiv).toHaveAttribute('data-theme', 'dark');
    });
  });
});
