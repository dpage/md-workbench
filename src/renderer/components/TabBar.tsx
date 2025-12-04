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
  onCloseOthers?: (tabId: string) => void;
  onCloseAll?: () => void;
  onCloseToRight?: (tabId: string) => void;
  onCloseToLeft?: (tabId: string) => void;
  onCloseSaved?: () => void;
  onCopyPath?: (filePath: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
  tabIndex: number;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onCloseOthers,
  onCloseAll,
  onCloseToRight,
  onCloseToLeft,
  onCloseSaved,
  onCopyPath,
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
    tabIndex: -1,
  });

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

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string, tabIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        tabId,
        tabIndex,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [contextMenu.visible, closeContextMenu]);

  const handleMenuAction = useCallback(
    (action: string) => {
      const { tabId, tabIndex } = contextMenu;
      if (!tabId) return;

      const tab = tabs.find((t) => t.id === tabId);

      switch (action) {
        case 'close':
          onTabClose(tabId);
          break;
        case 'closeOthers':
          onCloseOthers?.(tabId);
          break;
        case 'closeAll':
          onCloseAll?.();
          break;
        case 'closeToRight':
          onCloseToRight?.(tabId);
          break;
        case 'closeToLeft':
          onCloseToLeft?.(tabId);
          break;
        case 'closeSaved':
          onCloseSaved?.();
          break;
        case 'copyPath':
          if (tab) {
            onCopyPath?.(tab.filePath);
          }
          break;
      }

      closeContextMenu();
    },
    [
      contextMenu,
      tabs,
      onTabClose,
      onCloseOthers,
      onCloseAll,
      onCloseToRight,
      onCloseToLeft,
      onCloseSaved,
      onCopyPath,
      closeContextMenu,
    ]
  );

  if (tabs.length === 0) {
    return null;
  }

  // Compute menu item availability
  const contextTabIndex = contextMenu.tabIndex;
  const hasTabsToRight = contextTabIndex >= 0 && contextTabIndex < tabs.length - 1;
  const hasTabsToLeft = contextTabIndex > 0;
  const hasOtherTabs = tabs.length > 1;
  const hasSavedTabs = tabs.some((t) => !t.isDirty);

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
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
            onClick={() => onTabSelect(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id, index)}
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
      {contextMenu.visible && (
        <div
          className="tab-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('close')}
          >
            Close
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('closeOthers')}
            disabled={!hasOtherTabs}
          >
            Close Others
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('closeAll')}
          >
            Close All
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('closeToLeft')}
            disabled={!hasTabsToLeft}
          >
            Close to the Left
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('closeToRight')}
            disabled={!hasTabsToRight}
          >
            Close to the Right
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('closeSaved')}
            disabled={!hasSavedTabs}
          >
            Close Saved
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => handleMenuAction('copyPath')}
          >
            Copy Path
          </button>
        </div>
      )}
    </div>
  );
};

export default TabBar;
