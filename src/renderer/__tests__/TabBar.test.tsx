import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar, { Tab } from '../components/TabBar';

const mockTabs: Tab[] = [
  { id: 'tab-1', filePath: '/path/to/file1.md', fileName: 'file1.md', content: '# Test 1' },
  { id: 'tab-2', filePath: '/path/to/file2.md', fileName: 'file2.md', content: '# Test 2' },
];

describe('TabBar Component', () => {
  it('renders nothing when there are no tabs', () => {
    const { container } = render(
      <TabBar
        tabs={[]}
        activeTabId={null}
        onTabSelect={jest.fn()}
        onTabClose={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all tabs', () => {
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabSelect={jest.fn()}
        onTabClose={jest.fn()}
      />
    );
    expect(screen.getByText('file1.md')).toBeInTheDocument();
    expect(screen.getByText('file2.md')).toBeInTheDocument();
  });

  it('applies active class to the active tab', () => {
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabSelect={jest.fn()}
        onTabClose={jest.fn()}
      />
    );
    const activeTab = screen.getByText('file1.md').closest('.tab');
    expect(activeTab).toHaveClass('active');
  });

  it('calls onTabSelect when clicking a tab', () => {
    const onTabSelect = jest.fn();
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabSelect={onTabSelect}
        onTabClose={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('file2.md'));
    expect(onTabSelect).toHaveBeenCalledWith('tab-2');
  });

  it('calls onTabClose when clicking the close button', () => {
    const onTabClose = jest.fn();
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabSelect={jest.fn()}
        onTabClose={onTabClose}
      />
    );
    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[0]);
    expect(onTabClose).toHaveBeenCalledWith('tab-1');
  });

  it('does not call onTabSelect when clicking close button', () => {
    const onTabSelect = jest.fn();
    const onTabClose = jest.fn();
    render(
      <TabBar
        tabs={mockTabs}
        activeTabId="tab-1"
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
      />
    );
    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[0]);
    expect(onTabSelect).not.toHaveBeenCalled();
  });
});
