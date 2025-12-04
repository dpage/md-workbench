import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeScreen from '../components/WelcomeScreen';

describe('WelcomeScreen Component', () => {
  it('renders the title', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} />);
    expect(screen.getByText('Markdown Workbench')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} />);
    expect(screen.getByText('A simple markdown file viewer')).toBeInTheDocument();
  });

  it('renders the open file button', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} />);
    expect(screen.getByText('Open Markdown File')).toBeInTheDocument();
  });

  it('calls onOpenFile when clicking the button', () => {
    const onOpenFile = jest.fn();
    render(<WelcomeScreen onOpenFile={onOpenFile} />);
    fireEvent.click(screen.getByText('Open Markdown File'));
    expect(onOpenFile).toHaveBeenCalled();
  });

  it('displays keyboard shortcut hints', () => {
    render(<WelcomeScreen onOpenFile={jest.fn()} />);
    expect(screen.getByText(/Ctrl/)).toBeInTheDocument();
    expect(screen.getByText(/Cmd/)).toBeInTheDocument();
  });
});
