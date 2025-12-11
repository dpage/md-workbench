//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import '@testing-library/jest-dom';

// Mock ResizeObserver which is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the electronAPI that's exposed via preload script
const mockElectronAPI = {
  platform: 'darwin',
  versions: {
    node: '18.0.0',
    chrome: '118.0.0',
    electron: '27.0.0',
  },
  openFileDialog: jest.fn(),
  readFile: jest.fn(),
  getTheme: jest.fn(() => Promise.resolve('dark')),
  setTheme: jest.fn(() => Promise.resolve()),
  saveSession: jest.fn(() => Promise.resolve()),
  getPreferences: jest.fn(() =>
    Promise.resolve({ autoReload: true, openLinksInNewTab: false })
  ),
  setPreferences: jest.fn(() => Promise.resolve()),
  startWatching: jest.fn(() => Promise.resolve()),
  stopWatching: jest.fn(() => Promise.resolve()),
  openExternal: jest.fn(() => Promise.resolve()),
  openLocalFile: jest.fn(() => Promise.resolve()),
  getOpenLinksInNewTab: jest.fn(() => Promise.resolve(false)),
  saveFile: jest.fn(() => Promise.resolve({ success: true, filePath: '/test.md' })),
  saveFileAs: jest.fn(() =>
    Promise.resolve({
      success: true,
      filePath: '/test-saved.md',
      fileName: 'test-saved.md',
    })
  ),
  showUnsavedDialog: jest.fn(() => Promise.resolve({ response: 1 })), // "Don't Save" by default
  confirmClose: jest.fn(() => Promise.resolve()),
  cancelClose: jest.fn(() => Promise.resolve()),
  onFileOpened: jest.fn(() => jest.fn()),
  onFileChanged: jest.fn(() => jest.fn()),
  onCloseCurrentTab: jest.fn(() => jest.fn()),
  onThemeChanged: jest.fn(() => jest.fn()),
  onRestoreSession: jest.fn((callback) => {
    // Immediately invoke callback with empty session so isRestoring becomes false
    setTimeout(() => callback({ files: [] }), 0);
    return jest.fn();
  }),
  onPreferencesChanged: jest.fn(() => jest.fn()),
  onSaveCurrentFile: jest.fn(() => jest.fn()),
  onSaveCurrentFileAs: jest.fn(() => jest.fn()),
  onCheckUnsavedBeforeClose: jest.fn(() => jest.fn()),
  onFind: jest.fn(() => jest.fn()),
  onFindReplace: jest.fn(() => jest.fn()),
  onFolderOpened: jest.fn(() => jest.fn()),
  onFolderClosed: jest.fn(() => jest.fn()),
  onFolderContentsChanged: jest.fn(() => jest.fn()),
  onShowPreferences: jest.fn(() => jest.fn()),
  onFormatDocument: jest.fn(() => jest.fn()),
  onSetViewMode: jest.fn(() => jest.fn()),
  onNewFile: jest.fn(() => jest.fn()),
  openFolderDialog: jest.fn(() => Promise.resolve()),
  readFolderContents: jest.fn(() => Promise.resolve([])),
  closeFolder: jest.fn(() => Promise.resolve()),
  getCurrentFolder: jest.fn(() => Promise.resolve(null)),
  startWatchingFolder: jest.fn(() => Promise.resolve()),
  stopWatchingFolder: jest.fn(() => Promise.resolve()),
  getFileViewMode: jest.fn(() => Promise.resolve(null)),
  setFileViewMode: jest.fn(() => Promise.resolve()),
  browseImageFile: jest.fn(() => Promise.resolve({ canceled: true })),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
