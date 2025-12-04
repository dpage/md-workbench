//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Toolbar from './components/Toolbar';
import TabBar, { Tab } from './components/TabBar';
import MarkdownViewer, { SearchHighlightOptions } from './components/MarkdownViewer';
import SplitEditor from './components/SplitEditor';
import SourceViewer from './components/SourceViewer';
import WelcomeScreen from './components/WelcomeScreen';
import SearchBar, { SearchOptions, SearchResult } from './components/SearchBar';
import HelpPanel from './components/HelpPanel';

interface FileData {
  filePath: string;
  fileName: string;
  content: string;
  replaceCurrentTab?: boolean;
}

interface OpenFile {
  filePath: string;
  fileName: string;
}

interface SessionData {
  files: OpenFile[];
  activeFilePath: string | null;
}

interface Preferences {
  autoReload: boolean;
  openLinksInNewTab: boolean;
}

type Theme = 'light' | 'dark';
type ThemeSetting = 'light' | 'dark' | 'system';

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      versions: {
        node: string;
        chrome: string;
        electron: string;
      };
      openFileDialog: () => Promise<void>;
      readFile: (filePath: string) => Promise<FileData>;
      getTheme: () => Promise<Theme>;
      setTheme: (theme: ThemeSetting) => Promise<void>;
      saveSession: (data: SessionData) => Promise<void>;
      getPreferences: () => Promise<Preferences>;
      setPreferences: (preferences: Preferences) => Promise<void>;
      startWatching: (filePath: string) => Promise<void>;
      stopWatching: (filePath: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      openLocalFile: (filePath: string) => Promise<void>;
      getOpenLinksInNewTab: () => Promise<boolean>;
      saveFile: (data: { filePath: string; content: string }) => Promise<{
        success: boolean;
        filePath: string;
      }>;
      saveFileAs: (data: { content: string; defaultPath?: string }) => Promise<{
        success: boolean;
        canceled?: boolean;
        filePath?: string;
        fileName?: string;
      }>;
      showUnsavedDialog: (data: { fileName: string }) => Promise<{
        response: number;
      }>;
      confirmClose: () => Promise<void>;
      cancelClose: () => Promise<void>;
      onFileOpened: (callback: (data: FileData) => void) => () => void;
      onFileChanged: (callback: (data: FileData) => void) => () => void;
      onCloseCurrentTab: (callback: () => void) => () => void;
      onThemeChanged: (callback: (theme: Theme) => void) => () => void;
      onRestoreSession: (callback: (data: SessionData) => void) => () => void;
      onPreferencesChanged: (callback: (preferences: Preferences) => void) => () => void;
      onSaveCurrentFile: (callback: () => void) => () => void;
      onSaveCurrentFileAs: (callback: () => void) => () => void;
      onCheckUnsavedBeforeClose: (callback: () => void) => () => void;
      onFind: (callback: () => void) => () => void;
      onFindReplace: (callback: () => void) => () => void;
    };
  }
}

interface ScrollPosition {
  top: number;
  left: number;
}

interface NavigationHistory {
  entries: string[]; // file paths
  currentIndex: number;
}

const App: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [isRestoring, setIsRestoring] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Search state for view mode (non-edit mode)
  const [viewSearchQuery, setViewSearchQuery] = useState('');
  const [viewSearchOptions, setViewSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    useRegex: false,
  });
  const [viewMatchCount, setViewMatchCount] = useState(0);
  const [viewCurrentMatch, setViewCurrentMatch] = useState(0);

  // Ref to track the active editor's textarea for clipboard operations
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // Use ref to avoid stale closure issues in event handlers
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  const activeTabIdRef = useRef<string | null>(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Store scroll positions per tab
  const scrollPositionsRef = useRef<Map<string, ScrollPosition>>(new Map());

  // Store navigation history per tab
  const navigationHistoryRef = useRef<Map<string, NavigationHistory>>(new Map());

  // Track if current navigation is from back/forward (to avoid adding to history)
  const isNavigatingRef = useRef(false);

  // Save session whenever tabs or active tab changes
  const saveSession = useCallback(() => {
    if (isRestoring) return; // Don't save while restoring

    const files = tabsRef.current.map((tab) => ({
      filePath: tab.filePath,
      fileName: tab.fileName,
    }));

    const activeTab = tabsRef.current.find(
      (tab) => tab.id === activeTabIdRef.current
    );

    window.electronAPI?.saveSession({
      files,
      activeFilePath: activeTab?.filePath || null,
    });
  }, [isRestoring]);

  // Save session when tabs change
  useEffect(() => {
    saveSession();
  }, [tabs, activeTabId, saveSession]);

  const handleOpenFile = useCallback(() => {
    window.electronAPI?.openFileDialog();
  }, []);

  const handleFileOpened = useCallback((data: FileData) => {
    const currentTabs = tabsRef.current;
    const existingTab = currentTabs.find(
      (tab) => tab.filePath === data.filePath
    );

    if (existingTab) {
      // File already open - just switch to it
      setActiveTabId(existingTab.id);
    } else if (data.replaceCurrentTab && activeTabIdRef.current) {
      // Replace current tab with new file
      const currentTabId = activeTabIdRef.current;
      const currentTab = currentTabs.find((tab) => tab.id === currentTabId);

      if (currentTab) {
        // Stop watching the old file
        window.electronAPI?.stopWatching(currentTab.filePath);
        // Clear scroll position for old tab
        scrollPositionsRef.current.delete(currentTabId);

        // Update navigation history (only if not navigating via back/forward)
        if (!isNavigatingRef.current) {
          const history = navigationHistoryRef.current.get(currentTabId);
          if (history) {
            // Truncate forward history when navigating to new page
            const newEntries = history.entries.slice(0, history.currentIndex + 1);
            newEntries.push(data.filePath);
            navigationHistoryRef.current.set(currentTabId, {
              entries: newEntries,
              currentIndex: newEntries.length - 1,
            });
          }
        }
        isNavigatingRef.current = false;
      }

      // Update the current tab with new file data
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === currentTabId
            ? {
                ...tab,
                filePath: data.filePath,
                fileName: data.fileName,
                content: data.content,
              }
            : tab
        )
      );
    } else {
      // Open in new tab
      const newTab: Tab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filePath: data.filePath,
        fileName: data.fileName,
        content: data.content,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);

      // Initialize navigation history for new tab
      navigationHistoryRef.current.set(newTab.id, {
        entries: [data.filePath],
        currentIndex: 0,
      });
    }
  }, []);

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Save scroll position for a tab
  const handleScrollChange = useCallback(
    (position: ScrollPosition) => {
      const currentTabId = activeTabIdRef.current;
      if (currentTabId) {
        scrollPositionsRef.current.set(currentTabId, position);
      }
    },
    []
  );

  // Navigate back in history
  const handleBack = useCallback(async () => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    const history = navigationHistoryRef.current.get(currentTabId);
    if (!history || history.currentIndex <= 0) return;

    const newIndex = history.currentIndex - 1;
    const targetPath = history.entries[newIndex];

    // Update history index
    navigationHistoryRef.current.set(currentTabId, {
      ...history,
      currentIndex: newIndex,
    });

    // Mark as navigating to prevent adding to history
    isNavigatingRef.current = true;

    // Load the file
    try {
      const fileData = await window.electronAPI.readFile(targetPath);
      // Clear scroll position before navigation
      scrollPositionsRef.current.delete(currentTabId);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === currentTabId
            ? {
                ...tab,
                filePath: fileData.filePath,
                fileName: fileData.fileName,
                content: fileData.content,
              }
            : tab
        )
      );
    } catch (error) {
      console.error('Failed to navigate back:', error);
      isNavigatingRef.current = false;
    }
  }, []);

  // Navigate forward in history
  const handleForward = useCallback(async () => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    const history = navigationHistoryRef.current.get(currentTabId);
    if (!history || history.currentIndex >= history.entries.length - 1) return;

    const newIndex = history.currentIndex + 1;
    const targetPath = history.entries[newIndex];

    // Update history index
    navigationHistoryRef.current.set(currentTabId, {
      ...history,
      currentIndex: newIndex,
    });

    // Mark as navigating to prevent adding to history
    isNavigatingRef.current = true;

    // Load the file
    try {
      const fileData = await window.electronAPI.readFile(targetPath);
      // Clear scroll position before navigation
      scrollPositionsRef.current.delete(currentTabId);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === currentTabId
            ? {
                ...tab,
                filePath: fileData.filePath,
                fileName: fileData.fileName,
                content: fileData.content,
              }
            : tab
        )
      );
    } catch (error) {
      console.error('Failed to navigate forward:', error);
      isNavigatingRef.current = false;
    }
  }, []);

  const handleToggleViewSource = useCallback(() => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === currentTabId
          ? { ...tab, viewSource: !tab.viewSource, editMode: false }
          : tab
      )
    );
  }, []);

  const handleToggleEditMode = useCallback(() => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === currentTabId) {
          // When entering edit mode, store original content if not already stored
          const originalContent =
            tab.originalContent !== undefined
              ? tab.originalContent
              : tab.content;
          return { ...tab, editMode: !tab.editMode, viewSource: false, originalContent };
        }
        return tab;
      })
    );
  }, []);

  // Handle content changes from editor
  const handleContentChange = useCallback((newContent: string) => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === currentTabId) {
          const originalContent =
            tab.originalContent !== undefined
              ? tab.originalContent
              : tab.content;
          const isDirty = newContent !== originalContent;
          return { ...tab, content: newContent, isDirty };
        }
        return tab;
      })
    );
  }, []);

  // Save current file
  const handleSave = useCallback(async () => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    const currentTab = tabsRef.current.find((tab) => tab.id === currentTabId);
    if (!currentTab || !currentTab.isDirty) return;

    try {
      await window.electronAPI.saveFile({
        filePath: currentTab.filePath,
        content: currentTab.content,
      });

      // Update tab to mark as saved
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === currentTabId
            ? { ...tab, isDirty: false, originalContent: tab.content }
            : tab
        )
      );
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, []);

  // Save As
  const handleSaveAs = useCallback(async () => {
    const currentTabId = activeTabIdRef.current;
    if (!currentTabId) return;

    const currentTab = tabsRef.current.find((tab) => tab.id === currentTabId);
    if (!currentTab) return;

    try {
      const result = await window.electronAPI.saveFileAs({
        content: currentTab.content,
        defaultPath: currentTab.filePath,
      });

      if (result.success && result.filePath && result.fileName) {
        // Stop watching old file
        window.electronAPI?.stopWatching(currentTab.filePath);

        // Update tab with new file info
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === currentTabId
              ? {
                  ...tab,
                  filePath: result.filePath!,
                  fileName: result.fileName!,
                  isDirty: false,
                  originalContent: tab.content,
                }
              : tab
          )
        );
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, []);

  // Handle check for unsaved changes before window close
  const handleCheckUnsavedBeforeClose = useCallback(async () => {
    const dirtyTabs = tabsRef.current.filter((tab) => tab.isDirty);

    if (dirtyTabs.length === 0) {
      // No unsaved changes, proceed with close
      window.electronAPI?.confirmClose();
      return;
    }

    // Prompt for each dirty file
    for (const tab of dirtyTabs) {
      const result = await window.electronAPI.showUnsavedDialog({
        fileName: tab.fileName,
      });

      if (result.response === 0) {
        // Save
        try {
          await window.electronAPI.saveFile({
            filePath: tab.filePath,
            content: tab.content,
          });
        } catch (error) {
          console.error('Failed to save file:', error);
          // Cancel close on save error
          window.electronAPI?.cancelClose();
          return;
        }
      } else if (result.response === 2) {
        // Cancel - stop the close process
        window.electronAPI?.cancelClose();
        return;
      }
      // response === 1 means "Don't Save" - continue to next file
    }

    // All files handled, proceed with close
    window.electronAPI?.confirmClose();
  }, []);

  // Clipboard operations - these work via the native textarea
  const handleCut = useCallback(() => {
    document.execCommand('cut');
  }, []);

  const handleCopy = useCallback(() => {
    document.execCommand('copy');
  }, []);

  const handlePaste = useCallback(() => {
    document.execCommand('paste');
  }, []);

  // Search operations
  const handleFind = useCallback(() => {
    const currentTab = tabsRef.current.find(
      (tab) => tab.id === activeTabIdRef.current
    );
    if (currentTab) {
      setShowSearch(true);
      setShowReplace(false);
    }
  }, []);

  const handleFindReplace = useCallback(() => {
    const currentTab = tabsRef.current.find(
      (tab) => tab.id === activeTabIdRef.current
    );
    if (currentTab?.editMode) {
      setShowSearch(true);
      setShowReplace(true);
    }
  }, []);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setShowReplace(false);
    setViewSearchQuery('');
    setViewMatchCount(0);
    setViewCurrentMatch(0);
  }, []);

  // View mode search handlers
  const handleViewSearch = useCallback(
    (query: string, options: SearchOptions): SearchResult => {
      setViewSearchQuery(query);
      setViewSearchOptions(options);

      if (!query) {
        setViewMatchCount(0);
        setViewCurrentMatch(0);
        return { matches: [] };
      }

      // Count matches in the active tab's content
      const currentTab = tabsRef.current.find(
        (tab) => tab.id === activeTabIdRef.current
      );
      if (!currentTab) {
        return { matches: [] };
      }

      try {
        let searchRegex: RegExp;
        if (options.useRegex) {
          searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
        } else {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escapedQuery, options.caseSensitive ? 'g' : 'gi');
        }

        const matches: Array<{ start: number; end: number }> = [];
        let match;
        while ((match = searchRegex.exec(currentTab.content)) !== null) {
          matches.push({ start: match.index, end: match.index + match[0].length });
          if (match[0].length === 0) searchRegex.lastIndex++;
        }

        setViewMatchCount(matches.length);
        if (matches.length > 0 && viewCurrentMatch === 0) {
          setViewCurrentMatch(1);
        } else if (matches.length === 0) {
          setViewCurrentMatch(0);
        }

        return { matches };
      } catch {
        setViewMatchCount(0);
        setViewCurrentMatch(0);
        return { matches: [], error: 'Invalid regex' };
      }
    },
    [viewCurrentMatch]
  );

  const handleViewNavigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (viewMatchCount === 0) return;

      if (direction === 'next') {
        setViewCurrentMatch((prev) => (prev % viewMatchCount) + 1);
      } else {
        setViewCurrentMatch((prev) =>
          prev === 1 ? viewMatchCount : prev - 1
        );
      }
    },
    [viewMatchCount]
  );

  // No-op handlers for view mode (no replace functionality)
  const handleViewReplace = useCallback(() => {}, []);
  const handleViewReplaceAll = useCallback(() => 0, []);

  // Handle search state changes from SplitEditor
  const handleSearchStateChange = useCallback((query: string, options: SearchOptions) => {
    setViewSearchQuery(query);
    setViewSearchOptions(options);
  }, []);

  // Handle current match index changes from SplitEditor or SourceViewer
  const handleCurrentMatchChange = useCallback((matchIndex: number, totalMatches: number) => {
    setViewCurrentMatch(matchIndex + 1); // Convert 0-based to 1-based
    setViewMatchCount(totalMatches);
  }, []);

  // Help panel
  const handleToggleHelp = useCallback(() => {
    setShowHelp((prev) => !prev);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    // Stop watching the file being closed
    const tabToClose = tabsRef.current.find((tab) => tab.id === tabId);
    if (tabToClose) {
      window.electronAPI?.stopWatching(tabToClose.filePath);
    }

    // Clean up scroll position and navigation history for closed tab
    scrollPositionsRef.current.delete(tabId);
    navigationHistoryRef.current.delete(tabId);

    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== tabId);
      return newTabs;
    });

    setActiveTabId((currentActiveId) => {
      if (currentActiveId === tabId) {
        const currentTabs = tabsRef.current;
        const closedIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        const remainingTabs = currentTabs.filter((tab) => tab.id !== tabId);
        if (remainingTabs.length > 0) {
          // Ensure index is valid (closedIndex could be -1 if tab already removed)
          const safeIndex = Math.max(0, closedIndex);
          const newActiveIndex = Math.min(safeIndex, remainingTabs.length - 1);
          return remainingTabs[newActiveIndex].id;
        }
        return null;
      }
      return currentActiveId;
    });
  }, []);

  const handleCloseCurrentTab = useCallback(() => {
    setActiveTabId((currentActiveId) => {
      if (currentActiveId) {
        setTimeout(() => handleTabClose(currentActiveId), 0);
      }
      return currentActiveId;
    });
  }, [handleTabClose]);

  const handleThemeChanged = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const handleFileChanged = useCallback((data: FileData) => {
    // Update the tab content when file changes on disk
    setTabs((prev) =>
      prev.map((tab) =>
        tab.filePath === data.filePath ? { ...tab, content: data.content } : tab
      )
    );
  }, []);

  const handleRestoreSession = useCallback(
    async (data: SessionData) => {
      if (data.files.length === 0) {
        setIsRestoring(false);
        return;
      }

      // Load each file
      const loadedTabs: Tab[] = [];
      let activeTab: Tab | null = null;

      for (const file of data.files) {
        try {
          const fileData = await window.electronAPI.readFile(file.filePath);
          const tab: Tab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            filePath: fileData.filePath,
            fileName: fileData.fileName,
            content: fileData.content,
          };
          loadedTabs.push(tab);

          if (file.filePath === data.activeFilePath) {
            activeTab = tab;
          }
        } catch (error) {
          // File no longer exists, skip it
          console.warn(`Could not restore file: ${file.filePath}`);
        }
      }

      if (loadedTabs.length > 0) {
        setTabs(loadedTabs);
        setActiveTabId(activeTab?.id || loadedTabs[0].id);
      }

      setIsRestoring(false);
    },
    []
  );

  useEffect(() => {
    const unsubscribeFileOpened =
      window.electronAPI?.onFileOpened(handleFileOpened);
    const unsubscribeFileChanged =
      window.electronAPI?.onFileChanged(handleFileChanged);
    const unsubscribeCloseTab =
      window.electronAPI?.onCloseCurrentTab(handleCloseCurrentTab);
    const unsubscribeThemeChanged =
      window.electronAPI?.onThemeChanged(handleThemeChanged);
    const unsubscribeRestoreSession =
      window.electronAPI?.onRestoreSession(handleRestoreSession);
    const unsubscribeSave = window.electronAPI?.onSaveCurrentFile(handleSave);
    const unsubscribeSaveAs =
      window.electronAPI?.onSaveCurrentFileAs(handleSaveAs);
    const unsubscribeCheckUnsaved =
      window.electronAPI?.onCheckUnsavedBeforeClose(
        handleCheckUnsavedBeforeClose
      );
    const unsubscribeFind = window.electronAPI?.onFind(handleFind);
    const unsubscribeFindReplace =
      window.electronAPI?.onFindReplace(handleFindReplace);

    return () => {
      unsubscribeFileOpened?.();
      unsubscribeFileChanged?.();
      unsubscribeCloseTab?.();
      unsubscribeThemeChanged?.();
      unsubscribeRestoreSession?.();
      unsubscribeSave?.();
      unsubscribeSaveAs?.();
      unsubscribeCheckUnsaved?.();
      unsubscribeFind?.();
      unsubscribeFindReplace?.();
    };
  }, [
    handleFileOpened,
    handleFileChanged,
    handleCloseCurrentTab,
    handleThemeChanged,
    handleRestoreSession,
    handleSave,
    handleSaveAs,
    handleCheckUnsavedBeforeClose,
    handleFind,
    handleFindReplace,
  ]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  // Search highlight options for view mode MarkdownViewer
  const viewSearchHighlight: SearchHighlightOptions | undefined = useMemo(() => {
    if (!viewSearchQuery || !showSearch || activeTab?.editMode) return undefined;
    return {
      query: viewSearchQuery,
      caseSensitive: viewSearchOptions.caseSensitive,
      useRegex: viewSearchOptions.useRegex,
    };
  }, [viewSearchQuery, viewSearchOptions, showSearch, activeTab?.editMode]);

  // Compute navigation state for current tab
  const currentHistory = activeTabId
    ? navigationHistoryRef.current.get(activeTabId)
    : null;
  const canGoBack = currentHistory ? currentHistory.currentIndex > 0 : false;
  const canGoForward = currentHistory
    ? currentHistory.currentIndex < currentHistory.entries.length - 1
    : false;

  return (
    <div className="app" data-theme={theme}>
      <Toolbar
        onOpenFile={handleOpenFile}
        onBack={handleBack}
        onForward={handleForward}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        viewSource={activeTab?.viewSource ?? false}
        onToggleViewSource={handleToggleViewSource}
        editMode={activeTab?.editMode ?? false}
        onToggleEditMode={handleToggleEditMode}
        hasActiveTab={!!activeTab}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onFind={handleFind}
        onFindReplace={handleFindReplace}
        onHelp={handleToggleHelp}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
      />
      <main className="app-main">
        {activeTab ? (
          activeTab.viewSource ? (
            <div className="view-mode-container">
              {showSearch && (
                <SearchBar
                  onClose={handleCloseSearch}
                  onSearch={handleViewSearch}
                  onReplace={handleViewReplace}
                  onReplaceAll={handleViewReplaceAll}
                  onNavigate={handleViewNavigate}
                  matchCount={viewMatchCount}
                  currentMatch={viewCurrentMatch}
                  showReplace={false}
                  allowReplace={false}
                  initialQuery={viewSearchQuery}
                  initialOptions={viewSearchOptions}
                />
              )}
              <SourceViewer
                content={activeTab.content}
                searchQuery={showSearch ? viewSearchQuery : ''}
                searchOptions={viewSearchOptions}
                initialMatchIndex={viewCurrentMatch - 1}
                onMatchChange={handleCurrentMatchChange}
              />
            </div>
          ) : activeTab.editMode ? (
            <SplitEditor
              key={`split-${activeTab.id}`}
              content={activeTab.content}
              fileName={activeTab.fileName}
              filePath={activeTab.filePath}
              onContentChange={handleContentChange}
              showSearch={showSearch}
              showReplace={showReplace}
              onCloseSearch={handleCloseSearch}
              initialSearchQuery={viewSearchQuery}
              initialSearchOptions={viewSearchOptions}
              initialMatchIndex={viewCurrentMatch - 1}
              onSearchStateChange={handleSearchStateChange}
              onCurrentMatchChange={handleCurrentMatchChange}
            />
          ) : (
            <div className="view-mode-container">
              {showSearch && (
                <SearchBar
                  onClose={handleCloseSearch}
                  onSearch={handleViewSearch}
                  onReplace={handleViewReplace}
                  onReplaceAll={handleViewReplaceAll}
                  onNavigate={handleViewNavigate}
                  matchCount={viewMatchCount}
                  currentMatch={viewCurrentMatch}
                  showReplace={false}
                  allowReplace={false}
                  initialQuery={viewSearchQuery}
                  initialOptions={viewSearchOptions}
                />
              )}
              <MarkdownViewer
                key={activeTab.id}
                content={activeTab.content}
                fileName={activeTab.fileName}
                filePath={activeTab.filePath}
                initialScrollPosition={scrollPositionsRef.current.get(activeTab.id)}
                onScrollChange={handleScrollChange}
                searchHighlight={viewSearchHighlight}
                currentMatchIndex={viewCurrentMatch - 1}
              />
            </div>
          )
        ) : (
          <WelcomeScreen onOpenFile={handleOpenFile} />
        )}
      </main>
      <HelpPanel isOpen={showHelp} onClose={handleCloseHelp} />
    </div>
  );
};

export default App;
