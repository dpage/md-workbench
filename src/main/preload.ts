//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import { contextBridge, ipcRenderer } from 'electron';
import type {
  AIProvider,
  AIOptions,
  AIModel,
  AIConnectionStatus,
  AIKeyStatus,
} from '../shared/aiProviders';
import type {
  ChatMessage,
  Conversation,
  ChatTokenEvent,
  ChatToolCallEvent,
  ChatToolResultEvent,
  ChatCompleteEvent,
  ChatErrorEvent,
  ChatContentUpdateEvent,
  ChatStreamRequest,
  ToolDefinition,
} from '../shared/chatTypes';

export interface FileData {
  filePath: string;
  fileName: string;
  content: string;
  replaceCurrentTab?: boolean;
  fileType?: string;
  highlightLanguage?: string;
  supportsRenderedView?: boolean;
  supportsFormatting?: boolean;
}

export interface OpenFile {
  filePath: string;
  fileName: string;
}

export interface SessionData {
  files: OpenFile[];
  activeFilePath: string | null;
}

export interface Preferences {
  autoReload: boolean;
  autoSave: boolean;
  openLinksInNewTab: boolean;
}

export interface FolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FolderData {
  folderPath: string;
  folderName: string;
}

export type Theme = 'light' | 'dark';
export type ThemeSetting = 'light' | 'dark' | 'system';
export type MarkdownViewMode = 'preview' | 'edit' | 'split';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  browseImageFile: (currentFilePath: string) =>
    ipcRenderer.invoke('browse-image-file', currentFilePath) as Promise<{
      canceled: boolean;
      absolutePath?: string;
      relativePath?: string;
    }>,

  // Theme operations
  getTheme: () => ipcRenderer.invoke('get-theme') as Promise<Theme>,
  setTheme: (theme: ThemeSetting) => ipcRenderer.invoke('set-theme', theme),

  // Session operations
  saveSession: (data: SessionData) => ipcRenderer.invoke('save-session', data),

  // Preferences operations
  getPreferences: () =>
    ipcRenderer.invoke('get-preferences') as Promise<Preferences>,
  setPreferences: (preferences: Preferences) =>
    ipcRenderer.invoke('set-preferences', preferences),

  // File watcher operations
  startWatching: (filePath: string) =>
    ipcRenderer.invoke('start-watching', filePath),
  stopWatching: (filePath: string) =>
    ipcRenderer.invoke('stop-watching', filePath),

  // Folder watcher operations
  startWatchingFolder: (folderPath: string) =>
    ipcRenderer.invoke('start-watching-folder', folderPath),
  stopWatchingFolder: (folderPath: string) =>
    ipcRenderer.invoke('stop-watching-folder', folderPath),

  // Link handling
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openLocalFile: (filePath: string) =>
    ipcRenderer.invoke('open-local-file', filePath),
  getOpenLinksInNewTab: () =>
    ipcRenderer.invoke('get-open-links-in-new-tab') as Promise<boolean>,

  // File save operations
  saveFile: (data: { filePath: string; content: string }) =>
    ipcRenderer.invoke('save-file', data) as Promise<{
      success: boolean;
      filePath: string;
    }>,
  saveFileAs: (data: { content: string; defaultPath?: string }) =>
    ipcRenderer.invoke('save-file-as', data) as Promise<{
      success: boolean;
      canceled?: boolean;
      filePath?: string;
      fileName?: string;
    }>,
  showUnsavedDialog: (data: { fileName: string }) =>
    ipcRenderer.invoke('show-unsaved-dialog', data) as Promise<{
      response: number;
    }>,

  // Window close operations
  confirmClose: () => ipcRenderer.invoke('confirm-close'),
  cancelClose: () => ipcRenderer.invoke('cancel-close'),

  // Folder operations
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  readFolderContents: (folderPath: string) =>
    ipcRenderer.invoke('read-folder-contents', folderPath) as Promise<
      Array<{ name: string; path: string; isDirectory: boolean }>
    >,
  closeFolder: () => ipcRenderer.invoke('close-folder'),
  getCurrentFolder: () =>
    ipcRenderer.invoke('get-current-folder') as Promise<{
      folderPath: string;
      folderName: string;
    } | null>,

  // File view mode storage
  getFileViewMode: (filePath: string) =>
    ipcRenderer.invoke('get-file-view-mode', filePath) as Promise<MarkdownViewMode | null>,
  setFileViewMode: (filePath: string, mode: MarkdownViewMode) =>
    ipcRenderer.invoke('set-file-view-mode', filePath, mode),

  // Event listeners
  onFileOpened: (callback: (data: FileData) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: FileData) => {
      callback(data);
    };
    ipcRenderer.on('file-opened', listener);
    return () => ipcRenderer.removeListener('file-opened', listener);
  },

  onFileChanged: (callback: (data: FileData) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: FileData) => {
      callback(data);
    };
    ipcRenderer.on('file-changed', listener);
    return () => ipcRenderer.removeListener('file-changed', listener);
  },

  onCloseCurrentTab: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('close-current-tab', listener);
    return () => ipcRenderer.removeListener('close-current-tab', listener);
  },

  onThemeChanged: (callback: (theme: Theme) => void) => {
    const listener = (_: Electron.IpcRendererEvent, theme: Theme) => {
      callback(theme);
    };
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },

  onRestoreSession: (callback: (data: SessionData) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: SessionData) => {
      callback(data);
    };
    ipcRenderer.on('restore-session', listener);
    return () => ipcRenderer.removeListener('restore-session', listener);
  },

  onPreferencesChanged: (callback: (preferences: Preferences) => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      preferences: Preferences
    ) => {
      callback(preferences);
    };
    ipcRenderer.on('preferences-changed', listener);
    return () => ipcRenderer.removeListener('preferences-changed', listener);
  },

  onSaveCurrentFile: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('save-current-file', listener);
    return () => ipcRenderer.removeListener('save-current-file', listener);
  },

  onSaveCurrentFileAs: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('save-current-file-as', listener);
    return () => ipcRenderer.removeListener('save-current-file-as', listener);
  },

  onCheckUnsavedBeforeClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('check-unsaved-before-close', listener);
    return () =>
      ipcRenderer.removeListener('check-unsaved-before-close', listener);
  },

  onFind: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('find', listener);
    return () => ipcRenderer.removeListener('find', listener);
  },

  onFindReplace: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('find-replace', listener);
    return () => ipcRenderer.removeListener('find-replace', listener);
  },

  onFolderOpened: (
    callback: (data: { folderPath: string; folderName: string }) => void
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      data: { folderPath: string; folderName: string }
    ) => {
      callback(data);
    };
    ipcRenderer.on('folder-opened', listener);
    return () => ipcRenderer.removeListener('folder-opened', listener);
  },

  onFolderClosed: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('folder-closed', listener);
    return () => ipcRenderer.removeListener('folder-closed', listener);
  },

  onFolderContentsChanged: (
    callback: (data: {
      folderPath: string;
      eventType: string;
      filename: string | null;
    }) => void
  ) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      data: { folderPath: string; eventType: string; filename: string | null }
    ) => {
      callback(data);
    };
    ipcRenderer.on('folder-contents-changed', listener);
    return () =>
      ipcRenderer.removeListener('folder-contents-changed', listener);
  },

  onShowPreferences: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('show-preferences', listener);
    return () => ipcRenderer.removeListener('show-preferences', listener);
  },

  onFormatDocument: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('format-document', listener);
    return () => ipcRenderer.removeListener('format-document', listener);
  },

  onSetViewMode: (callback: (mode: MarkdownViewMode) => void) => {
    const listener = (_: Electron.IpcRendererEvent, mode: MarkdownViewMode) => {
      callback(mode);
    };
    ipcRenderer.on('set-view-mode', listener);
    return () => ipcRenderer.removeListener('set-view-mode', listener);
  },

  onNewFile: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('new-file', listener);
    return () => ipcRenderer.removeListener('new-file', listener);
  },

  // AI provider operations
  testAIConnection: (provider: AIProvider, options: AIOptions) =>
    ipcRenderer.invoke('test-ai-connection', provider, options) as Promise<AIConnectionStatus>,

  listAIModels: (provider: AIProvider, options: AIOptions) =>
    ipcRenderer.invoke('list-ai-models', provider, options) as Promise<{
      models: AIModel[];
      error?: string;
    }>,

  getAIKeyStatus: (provider: AIProvider, keyFilePath: string) =>
    ipcRenderer.invoke('get-ai-key-status', provider, keyFilePath) as Promise<AIKeyStatus>,

  smartMatchAIModel: (
    provider: AIProvider,
    savedModelId: string | null,
    availableModels: AIModel[]
  ) =>
    ipcRenderer.invoke('smart-match-ai-model', provider, savedModelId, availableModels) as Promise<string | null>,

  browseKeyFile: () =>
    ipcRenderer.invoke('browse-key-file') as Promise<{
      canceled: boolean;
      filePath?: string;
    }>,

  // Chat operations
  chatGetConversation: (filePath: string) =>
    ipcRenderer.invoke('chat-get-conversation', filePath) as Promise<Conversation | null>,

  chatSaveMessage: (filePath: string, message: ChatMessage) =>
    ipcRenderer.invoke('chat-save-message', filePath, message) as Promise<number>,

  chatClearConversation: (filePath: string) =>
    ipcRenderer.invoke('chat-clear-conversation', filePath) as Promise<{ success: boolean }>,

  chatGetMessageCount: (filePath: string) =>
    ipcRenderer.invoke('chat-get-message-count', filePath) as Promise<number>,

  chatNeedsCompaction: (filePath: string, threshold: number) =>
    ipcRenderer.invoke('chat-needs-compaction', filePath, threshold) as Promise<boolean>,

  chatStreamStart: (request: ChatStreamRequest, tools: ToolDefinition[]) =>
    ipcRenderer.invoke('chat-stream-start', request, tools) as Promise<void>,

  chatStreamStop: (requestId: string) =>
    ipcRenderer.invoke('chat-stream-stop', requestId) as Promise<boolean>,

  // Chat streaming event listeners
  onChatToken: (callback: (event: ChatTokenEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ChatTokenEvent) => {
      callback(event);
    };
    ipcRenderer.on('chat-token', listener);
    return () => ipcRenderer.removeListener('chat-token', listener);
  },

  onChatToolCall: (callback: (event: ChatToolCallEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ChatToolCallEvent) => {
      callback(event);
    };
    ipcRenderer.on('chat-tool-call', listener);
    return () => ipcRenderer.removeListener('chat-tool-call', listener);
  },

  onChatToolResult: (callback: (event: ChatToolResultEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ChatToolResultEvent) => {
      callback(event);
    };
    ipcRenderer.on('chat-tool-result', listener);
    return () => ipcRenderer.removeListener('chat-tool-result', listener);
  },

  onChatAssistantMessage: (callback: (event: { requestId: string; message: ChatMessage }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: { requestId: string; message: ChatMessage }) => {
      callback(event);
    };
    ipcRenderer.on('chat-assistant-message', listener);
    return () => ipcRenderer.removeListener('chat-assistant-message', listener);
  },

  onChatComplete: (callback: (event: ChatCompleteEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ChatCompleteEvent) => {
      callback(event);
    };
    ipcRenderer.on('chat-complete', listener);
    return () => ipcRenderer.removeListener('chat-complete', listener);
  },

  onChatError: (callback: (event: ChatErrorEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ChatErrorEvent) => {
      callback(event);
    };
    ipcRenderer.on('chat-error', listener);
    return () => ipcRenderer.removeListener('chat-error', listener);
  },

  onChatContentUpdate: (callback: (event: ChatContentUpdateEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ChatContentUpdateEvent) => {
      callback(event);
    };
    ipcRenderer.on('chat-content-update', listener);
    return () => ipcRenderer.removeListener('chat-content-update', listener);
  },

  // App info
  getIsPackaged: () =>
    ipcRenderer.invoke('get-is-packaged') as Promise<boolean>,
});
