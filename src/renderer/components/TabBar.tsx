//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useRef, useState, useEffect, useCallback } from 'react';

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  originalContent?: string;
  viewSource?: boolean;
  editMode?: boolean;
  isDirty?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollButtons();

    const container = tabsContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateScrollButtons);
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollButtons);
      resizeObserver.disconnect();
    };
  }, [updateScrollButtons, tabs]);

  const scroll = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const scrollAmount = 150;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (tabs.length === 0) {
    return null;
  }

  const showScrollButtons = canScrollLeft || canScrollRight;

  return (
    <div className="tab-bar">
      {showScrollButtons && (
        <button
          className={`tab-scroll-button tab-scroll-left ${!canScrollLeft ? 'disabled' : ''}`}
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll tabs left"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z" />
          </svg>
        </button>
      )}
      <div className="tabs-container" ref={tabsContainerRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
            onClick={() => onTabSelect(tab.id)}
            title={tab.filePath}
          >
            {tab.isDirty && <span className="tab-dirty-indicator" />}
            <span className="tab-title">{tab.fileName}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label={`Close ${tab.fileName}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      {showScrollButtons && (
        <button
          className={`tab-scroll-button tab-scroll-right ${!canScrollRight ? 'disabled' : ''}`}
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          aria-label="Scroll tabs right"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default TabBar;
