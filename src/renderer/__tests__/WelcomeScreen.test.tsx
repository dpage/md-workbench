import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeScreen from '../components/WelcomeScreen';

describe('WelcomeScreen Component', () => {
  it('renders the title', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('Markdown Workbench')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('View and edit Markdown, code, and configuration files')).toBeInTheDocument();
  });

  it('renders the open file button', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('Open File')).toBeInTheDocument();
  });

  it('renders the open folder button', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('Open Folder')).toBeInTheDocument();
  });

  it('calls onOpenFile when clicking the Open File button', () => {
    const onOpenFile = jest.fn();
    render(<WelcomeScreen onOpenFile={onOpenFile} onOpenFolder={jest.fn()} />);
    fireEvent.click(screen.getByText('Open File'));
    expect(onOpenFile).toHaveBeenCalled();
  });

  it('calls onOpenFolder when clicking the Open Folder button', () => {
    const onOpenFolder = jest.fn();
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={onOpenFolder} />);
    fireEvent.click(screen.getByText('Open Folder'));
    expect(onOpenFolder).toHaveBeenCalled();
  });

  it('displays keyboard shortcut hints', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText(/Ctrl/)).toBeInTheDocument();
    expect(screen.getByText(/Cmd/)).toBeInTheDocument();
  });
});
