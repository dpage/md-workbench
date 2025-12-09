import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeScreen from '../components/WelcomeScreen';

describe('WelcomeScreen Component', () => {
  it('renders the title parts', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('Markdown')).toBeInTheDocument();
    expect(screen.getByText('Workbench')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('A thoughtful editor for your documents')).toBeInTheDocument();
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

  it('displays keyboard shortcut hint', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByText('O')).toBeInTheDocument();
    expect(screen.getByText(/to open a file/)).toBeInTheDocument();
  });
});
