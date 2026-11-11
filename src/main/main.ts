//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  nativeTheme,
  session,
  protocol,
  net,
  shell,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import Store from 'electron-store';
import { getFileTypeInfo, SUPPORTED_EXTENSIONS } from '../shared/fileTypes';
import {
  Preferences,
  ThemeSetting,
  MarkdownViewMode,
  DEFAULT_PREFERENCES,
  DEFAULT_MARKDOWN_OPTIONS,
  DEFAULT_FORMATTING_OPTIONS,
  DEFAULT_EDITOR_OPTIONS,
  DEFAULT_AI_OPTIONS,
  DEFAULT_CHAT_OPTIONS,
} from '../shared/preferences';
import { AIProvider, AIOptions } from '../shared/aiProviders';
import {
  testConnection,
  listModels,
  getKeyStatus,
  smartMatchModel,
} from './aiService';
import { saveBookmark } from './fileBookmarks';
import {
  initDatabase as initChatDatabase,
  closeDatabase as closeChatDatabase,
  getConversation,
  saveMessage,
  clearConversation,
  getMessageCount,
  needsCompaction,
} from './chatDatabase';
import { streamChat, abortChat } from './chatService';
import { executeTool, ToolContext } from './toolExecutor';
import type { ChatMessage, ChatStreamRequest, ToolDefinition, ToolCall, ToolResult } from '../shared/chatTypes';

// Register custom protocol for serving local files
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

// Set app name before anything else (important for macOS menu bar)
app.name = 'Markdown Workbench';

// App info
const APP_VERSION = app.getVersion();
const APP_COPYRIGHT = 'Copyright \u00A9 2025 - 2026 Dave Page';

// Types for stored data
interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

interface OpenFile {
  filePath: string;
  fileName: string;
}

interface FolderEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface StoreSchema {
  windowBounds: WindowBounds;
  openFiles: OpenFile[];
  activeFilePath: string | null;
  theme: ThemeSetting;
  preferences: Preferences;
  recentFiles: string[];
  recentFolders: string[];
  currentFolder: string | null;
  fileViewModes: Record<string, MarkdownViewMode>;
}

const MAX_RECENT_FILES = 10;
const MAX_RECENT_FOLDERS = 10;

// Initialize store with defaults
const store = new Store<StoreSchema>({
  defaults: {
    windowBounds: {
      width: 1200,
      height: 800,
    },
    openFiles: [],
    activeFilePath: null,
    theme: 'system',
    preferences: DEFAULT_PREFERENCES,
    recentFiles: [],
    recentFolders: [],
    currentFolder: null,
    fileViewModes: {},
  },
});

// Ensure preferences has all required fields (for upgrades from older versions)
function getPreferencesWithDefaults(): Preferences {
  const stored = store.get('preferences');
  // Always use store.get('theme') as the source of truth for theme setting
  // This ensures preferences.theme stays in sync even if it was changed via View menu
  const actualTheme = store.get('theme') as ThemeSetting;
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    theme: actualTheme, // Override with actual theme to keep in sync
    markdown: {
      ...DEFAULT_MARKDOWN_OPTIONS,
      ...(stored.markdown || {}),
    },
    formatting: {
      ...DEFAULT_FORMATTING_OPTIONS,
      ...(stored.formatting || {}),
    },
    editor: {
      ...DEFAULT_EDITOR_OPTIONS,
      ...(stored.editor || {}),
    },
    ai: {
      ...DEFAULT_AI_OPTIONS,
      ...(stored.ai || {}),
    },
    chat: {
      ...DEFAULT_CHAT_OPTIONS,
      ...(stored.chat || {}),
    },
  };
}

let mainWindow: BrowserWindow | null = null;

// Files to open when app is ready (from command line or open-file event)
let filesToOpenOnReady: string[] = [];

// Track if renderer is ready to receive IPC messages
let webContentsReady = false;

// Track if initial startup sequence is complete (session restored + queued files opened)
let initialStartupComplete = false;

// File watchers map
const fileWatchers = new Map<string, fs.FSWatcher>();

// Folder watchers map - for watching directory changes
const folderWatchers = new Map<string, fs.FSWatcher>();

// Debounce timers for folder changes to avoid duplicate events
const folderChangeDebounce = new Map<string, NodeJS.Timeout>();

// Track if we're force closing (bypass unsaved check)
let forceClose = false;

// Check if a file path is a supported file type
function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().slice(1); // Remove the leading dot
  const fileName = path.basename(filePath).toLowerCase();

  // Check for exact filename matches (e.g., Dockerfile)
  if (SUPPORTED_EXTENSIONS.includes(fileName)) {
    return true;
  }

  // Check for extension matches
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// Extract file paths from command line arguments
function getFilePathsFromArgs(args: string[]): string[] {
  return args
    .slice(1) // Skip the first arg (electron executable or app path)
    .filter((arg) => !arg.startsWith('-')) // Skip flags
    .filter((arg) => {
      try {
        return fs.existsSync(arg) && fs.statSync(arg).isFile() && isSupportedFile(arg);
      } catch {
        return false;
      }
    })
    .map((arg) => path.resolve(arg)); // Convert to absolute path
}

function startWatchingFile(filePath: string): void {
  if (fileWatchers.has(filePath)) return;

  try {
    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change' && getPreferencesWithDefaults().autoReload) {
        // Debounce: wait a bit for file to finish writing
        setTimeout(async () => {
          try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath);
            mainWindow?.webContents.send('file-changed', {
              filePath,
              fileName,
              content,
            });
          } catch (error) {
            console.error(`Error reading changed file: ${filePath}`, error);
          }
        }, 100);
      }
    });

    fileWatchers.set(filePath, watcher);
  } catch (error) {
    console.error(`Error watching file: ${filePath}`, error);
  }
}

function stopWatchingFile(filePath: string): void {
  const watcher = fileWatchers.get(filePath);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(filePath);
  }
}

function stopAllWatchers(): void {
  fileWatchers.forEach((watcher) => watcher.close());
  fileWatchers.clear();
  folderWatchers.forEach((watcher) => watcher.close());
  folderWatchers.clear();
  folderChangeDebounce.forEach((timer) => clearTimeout(timer));
  folderChangeDebounce.clear();
}

function startWatchingFolder(folderPath: string): void {
  if (folderWatchers.has(folderPath)) return;

  try {
    const watcher = fs.watch(folderPath, (eventType, filename) => {
      // Debounce folder change events
      const existingTimer = folderChangeDebounce.get(folderPath);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        folderChangeDebounce.delete(folderPath);
        mainWindow?.webContents.send('folder-contents-changed', {
          folderPath,
          eventType,
          filename,
        });
      }, 200); // 200ms debounce

      folderChangeDebounce.set(folderPath, timer);
    });

    folderWatchers.set(folderPath, watcher);
  } catch (error) {
    console.error(`Error watching folder: ${folderPath}`, error);
  }
}

function stopWatchingFolder(folderPath: string): void {
  const watcher = folderWatchers.get(folderPath);
  if (watcher) {
    watcher.close();
    folderWatchers.delete(folderPath);
  }
  const timer = folderChangeDebounce.get(folderPath);
  if (timer) {
    clearTimeout(timer);
    folderChangeDebounce.delete(folderPath);
  }
}

function addToRecentFiles(filePath: string): void {
  const recentFiles = store.get('recentFiles');

  // Remove the file if it already exists (we'll add it to the front)
  const filtered = recentFiles.filter((f) => f !== filePath);

  // Add to front and limit to max
  const updated = [filePath, ...filtered].slice(0, MAX_RECENT_FILES);

  store.set('recentFiles', updated);

  // Rebuild menu to update recent files list
  createMenu();
}

function getFilteredRecentFiles(openFilePaths: string[]): string[] {
  const recentFiles = store.get('recentFiles');

  // Filter out non-existent files and currently open files
  const filtered = recentFiles.filter((filePath) => {
    // Skip if file doesn't exist
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }
    } catch {
      return false;
    }

    // Skip if file is currently open
    if (openFilePaths.includes(filePath)) {
      return false;
    }

    return true;
  });

  // Update store if we removed any non-existent files
  const existingFiles = recentFiles.filter((filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });

  if (existingFiles.length !== recentFiles.length) {
    store.set('recentFiles', existingFiles);
  }

  return filtered;
}

function clearRecentFiles(): void {
  store.set('recentFiles', []);
  createMenu();
}

// Folder management functions
function addToRecentFolders(folderPath: string): void {
  const recentFolders = store.get('recentFolders');

  // Remove the folder if it already exists (we'll add it to the front)
  const filtered = recentFolders.filter((f) => f !== folderPath);

  // Add to front and limit to max
  const updated = [folderPath, ...filtered].slice(0, MAX_RECENT_FOLDERS);

  store.set('recentFolders', updated);

  // Rebuild menu to update recent folders list
  createMenu();
}

function getFilteredRecentFolders(): string[] {
  const recentFolders = store.get('recentFolders');
  const currentFolder = store.get('currentFolder');

  // Filter out non-existent folders and currently open folder
  const filtered = recentFolders.filter((folderPath) => {
    try {
      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return false;
      }
    } catch {
      return false;
    }

    // Skip if folder is currently open
    if (folderPath === currentFolder) {
      return false;
    }

    return true;
  });

  // Update store if we removed any non-existent folders
  const existingFolders = recentFolders.filter((folderPath) => {
    try {
      return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
    } catch {
      return false;
    }
  });

  if (existingFolders.length !== recentFolders.length) {
    store.set('recentFolders', existingFolders);
  }

  return filtered;
}

function clearRecentFolders(): void {
  store.set('recentFolders', []);
  createMenu();
}

async function openFolderDialog(): Promise<void> {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    await openFolder(folderPath);
  }
}

async function openFolder(folderPath: string): Promise<void> {
  if (!mainWindow) return;

  try {
    const stats = await fs.promises.stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error('Not a directory');
    }

    store.set('currentFolder', folderPath);
    addToRecentFolders(folderPath);

    mainWindow.webContents.send('folder-opened', {
      folderPath,
      folderName: path.basename(folderPath),
    });
  } catch (error) {
    dialog.showErrorBox('Error', `Failed to open folder: ${error}`);
  }
}

function closeFolder(): void {
  store.set('currentFolder', null);
  mainWindow?.webContents.send('folder-closed');
  createMenu();
}

async function readFolderContents(folderPath: string): Promise<FolderEntry[]> {
  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const result: FolderEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files/folders
      if (entry.name.startsWith('.')) continue;

      const entryPath = path.join(folderPath, entry.name);
      const isDirectory = entry.isDirectory();

      // For files, only include supported types
      if (!isDirectory && !isSupportedFile(entryPath)) continue;

      result.push({
        name: entry.name,
        path: entryPath,
        isDirectory,
      });
    }

    // Sort: directories first, then alphabetically
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch (error) {
    console.error(`Error reading folder: ${folderPath}`, error);
    return [];
  }
}

function getTheme(): 'light' | 'dark' {
  const storedTheme = store.get('theme');
  if (storedTheme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return storedTheme;
}

function showAboutDialog(): void {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Markdown Workbench',
    message: 'Markdown Workbench',
    detail: `Version ${APP_VERSION}\n\n${APP_COPYRIGHT}\n\nA cross-platform markdown viewer.`,
    buttons: ['OK'],
  });
}

function createMenu(): void {
  // Get currently open files to filter from recent files
  const openFiles = store.get('openFiles');
  const openFilePaths = openFiles.map((f) => f.filePath);
  const recentFiles = getFilteredRecentFiles(openFilePaths);
  const recentFolders = getFilteredRecentFolders();
  const currentFolder = store.get('currentFolder');

  // Build recent files submenu
  const recentFilesSubmenu: Electron.MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? [
          ...recentFiles.map((filePath) => ({
            label: path.basename(filePath),
            sublabel: filePath,
            click: () => openFile(filePath),
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent Files',
            click: clearRecentFiles,
          },
        ]
      : [
          {
            label: 'No Recent Files',
            enabled: false,
          },
        ];

  // Build recent folders submenu
  const recentFoldersSubmenu: Electron.MenuItemConstructorOptions[] =
    recentFolders.length > 0
      ? [
          ...recentFolders.map((folderPath) => ({
            label: path.basename(folderPath),
            sublabel: folderPath,
            click: () => openFolder(folderPath),
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent Folders',
            click: clearRecentFolders,
          },
        ]
      : [
          {
            label: 'No Recent Folders',
            enabled: false,
          },
        ];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('new-file');
          },
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            await openFileDialog();
          },
        },
        {
          label: 'Open Recent',
          submenu: recentFilesSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            await openFolderDialog();
          },
        },
        {
          label: 'Open Recent Folder',
          submenu: recentFoldersSubmenu,
        },
        {
          label: 'Close Folder',
          enabled: !!currentFolder,
          click: () => {
            closeFolder();
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('save-current-file');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('save-current-file-as');
          },
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow?.webContents.send('print');
          },
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow?.webContents.send('close-current-tab');
          },
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow?.webContents.send('find');
          },
        },
        {
          label: 'Find and Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            mainWindow?.webContents.send('find-replace');
          },
        },
        { type: 'separator' },
        {
          label: 'Format Document',
          accelerator: 'Shift+Alt+F',
          click: () => {
            mainWindow?.webContents.send('format-document');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Preview Mode',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.send('set-view-mode', 'preview');
          },
        },
        {
          label: 'Edit Mode',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.send('set-view-mode', 'edit');
          },
        },
        {
          label: 'Split Mode',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow?.webContents.send('set-view-mode', 'split');
          },
        },
        { type: 'separator' },
        ...(process.env.NODE_ENV === 'development'
          ? [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const },
            ]
          : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              {
                label: 'Main Window',
                click: () => {
                  if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                  } else {
                    createWindow();
                  }
                },
              },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  // Add Help menu for Windows/Linux (macOS has About in app menu)
  if (process.platform !== 'darwin') {
    template.push({
      label: 'Help',
      submenu: [
        {
          label: 'About Markdown Workbench',
          click: showAboutDialog,
        },
      ],
    });
  }

  // Add app menu for macOS
  if (process.platform === 'darwin') {
    // Configure the native About panel
    app.setAboutPanelOptions({
      applicationName: 'Markdown Workbench',
      applicationVersion: APP_VERSION,
      copyright: APP_COPYRIGHT,
      version: '',
    });

    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('show-preferences');
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  } else {
    // For Windows/Linux, add Preferences to Edit menu
    const editMenuIndex = template.findIndex(
      (item) => item.label === 'Edit'
    );
    if (editMenuIndex !== -1) {
      const editMenu = template[editMenuIndex];
      if (Array.isArray(editMenu.submenu)) {
        editMenu.submenu.push(
          { type: 'separator' },
          {
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              mainWindow?.webContents.send('show-preferences');
            },
          }
        );
      }
    }
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setTheme(theme: 'light' | 'dark' | 'system'): void {
  store.set('theme', theme);
  // Also update preferences.theme to keep them in sync
  const preferences = store.get('preferences');
  if (preferences.theme !== theme) {
    preferences.theme = theme;
    store.set('preferences', preferences);
    // Notify renderer of preference change
    mainWindow?.webContents.send('preferences-changed', preferences);
  }
  const effectiveTheme = getTheme();
  mainWindow?.webContents.send('theme-changed', effectiveTheme);
  createMenu(); // Rebuild menu to update radio button states
}

async function openFileDialog(): Promise<void> {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Supported Files', extensions: SUPPORTED_EXTENSIONS },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    await openFile(filePath);
  }
}

async function openFile(
  filePath: string,
  replaceCurrentTab = false
): Promise<void> {
  if (!mainWindow) return;

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const fileTypeInfo = getFileTypeInfo(filePath);
    mainWindow.webContents.send('file-opened', {
      filePath,
      fileName,
      content,
      replaceCurrentTab,
      fileType: fileTypeInfo.type,
      highlightLanguage: fileTypeInfo.highlightLanguage,
      supportsRenderedView: fileTypeInfo.supportsRenderedView,
      supportsFormatting: fileTypeInfo.supportsFormatting,
    });
    // Start watching the file for changes
    startWatchingFile(filePath);
    // Add to recent files
    addToRecentFiles(filePath);
  } catch (error) {
    dialog.showErrorBox('Error', `Failed to open file: ${error}`);
  }
}

function saveWindowBounds(): void {
  if (!mainWindow) return;

  const bounds = mainWindow.getBounds();
  const isMaximized = mainWindow.isMaximized();

  store.set('windowBounds', {
    ...bounds,
    isMaximized,
  });
}

async function restoreOpenFiles(): Promise<void> {
  if (!mainWindow) return;

  const openFiles = store.get('openFiles');
  const activeFilePath = store.get('activeFilePath');

  // Send stored files to renderer to restore
  mainWindow.webContents.send('restore-session', {
    files: openFiles,
    activeFilePath,
  });
}

function createWindow(): void {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: 'Markdown Workbench',
    backgroundColor: '#1e1e1e', // Dark background to prevent white flash on startup
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Restore maximized state
  if (bounds.isMaximized) {
    mainWindow.maximize();
  }

  createMenu();

  // Set CSP to allow local-file: protocol for images
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp =
      process.env.NODE_ENV === 'development'
        ? '' // Disable CSP in development for webpack-dev-server hot reload
        : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: local-file:; font-src 'self' data:;";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // In development, load from webpack dev server
  // In production, load the built file
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Save window bounds on resize/move
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
  mainWindow.on('maximize', saveWindowBounds);
  mainWindow.on('unmaximize', saveWindowBounds);

  // Restore session when renderer is ready
  mainWindow.webContents.on('did-finish-load', async () => {
    // Mark renderer as ready to receive IPC messages
    webContentsReady = true;

    // Send initial theme
    mainWindow?.webContents.send('theme-changed', getTheme());

    // Always restore previous session first
    restoreOpenFiles();

    // Then open any files from command line/open-file event (these become active)
    if (filesToOpenOnReady.length > 0) {
      for (const filePath of filesToOpenOnReady) {
        await openFile(filePath);
      }
      filesToOpenOnReady = [];
      // Bring app to foreground since we opened files from external source
      if (mainWindow) {
        mainWindow.show();
        mainWindow.moveTop();
        mainWindow.focus();
        app.focus({ steal: true });
      }
    }

    // Mark initial startup as complete - now open-file events can be handled directly
    initialStartupComplete = true;
  });

  // Handle window close with unsaved changes check
  mainWindow.on('close', async (e) => {
    if (forceClose) {
      return; // Allow close
    }

    // Check with renderer for unsaved changes
    e.preventDefault();
    mainWindow?.webContents.send('check-unsaved-before-close');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    webContentsReady = false;
    initialStartupComplete = false;
  });
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
  await openFileDialog();
});

ipcMain.handle('browse-image-file', async (_, currentFilePath: string) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const imagePath = result.filePaths[0];
  const currentDir = path.dirname(currentFilePath);

  // Calculate relative path from current file's directory to the image
  const relativePath = path.relative(currentDir, imagePath);

  // Use forward slashes for markdown compatibility
  const markdownPath = relativePath.split(path.sep).join('/');

  return {
    canceled: false,
    absolutePath: imagePath,
    relativePath: markdownPath,
  };
});

ipcMain.handle(
  'print-document',
  (event) =>
    new Promise<{ success: boolean; error?: string }>((resolve) => {
      event.sender.print({ printBackground: true }, (success, failureReason) => {
        resolve(success ? { success } : { success, error: failureReason });
      });
    })
);

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const fileTypeInfo = getFileTypeInfo(filePath);
    // Start watching the file for changes
    startWatchingFile(filePath);
    return {
      filePath,
      fileName,
      content,
      fileType: fileTypeInfo.type,
      highlightLanguage: fileTypeInfo.highlightLanguage,
      supportsRenderedView: fileTypeInfo.supportsRenderedView,
      supportsFormatting: fileTypeInfo.supportsFormatting,
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error}`);
  }
});

ipcMain.handle('get-theme', () => {
  return getTheme();
});

ipcMain.handle('set-theme', (_, theme: 'light' | 'dark' | 'system') => {
  setTheme(theme);
});

ipcMain.handle(
  'save-session',
  (_, data: { files: OpenFile[]; activeFilePath: string | null }) => {
    store.set('openFiles', data.files);
    store.set('activeFilePath', data.activeFilePath);
  }
);

// Preferences handlers
ipcMain.handle('get-preferences', () => {
  return getPreferencesWithDefaults();
});

ipcMain.handle('set-preferences', (_, preferences: Preferences) => {
  // Always use store.get('theme') as source of truth - don't let renderer override it
  // Theme changes should go through set-theme handler instead
  const actualTheme = store.get('theme') as ThemeSetting;
  preferences.theme = actualTheme;
  store.set('preferences', preferences);
});

ipcMain.handle('show-preferences', () => {
  mainWindow?.webContents.send('show-preferences');
});

// App info
ipcMain.handle('get-is-packaged', () => {
  return app.isPackaged;
});

// File watcher handlers
ipcMain.handle('start-watching', (_, filePath: string) => {
  startWatchingFile(filePath);
});

ipcMain.handle('stop-watching', (_, filePath: string) => {
  stopWatchingFile(filePath);
});

// Folder watcher handlers
ipcMain.handle('start-watching-folder', (_, folderPath: string) => {
  startWatchingFolder(folderPath);
});

ipcMain.handle('stop-watching-folder', (_, folderPath: string) => {
  stopWatchingFolder(folderPath);
});

// Link handling
ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('open-local-file', async (_, filePath: string) => {
  const openInNewTab = getPreferencesWithDefaults().openLinksInNewTab;
  await openFile(filePath, !openInNewTab);
});

ipcMain.handle('get-open-links-in-new-tab', () => {
  return getPreferencesWithDefaults().openLinksInNewTab;
});

// Save file handlers
ipcMain.handle(
  'save-file',
  async (_, data: { filePath: string; content: string }) => {
    try {
      await fs.promises.writeFile(data.filePath, data.content, 'utf-8');
      return { success: true, filePath: data.filePath };
    } catch (error) {
      throw new Error(`Failed to save file: ${error}`);
    }
  }
);

ipcMain.handle(
  'save-file-as',
  async (_, data: { content: string; defaultPath?: string }) => {
    if (!mainWindow) throw new Error('No window');

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: data.defaultPath,
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      await fs.promises.writeFile(result.filePath, data.content, 'utf-8');
      const fileName = path.basename(result.filePath);
      // Start watching the new file
      startWatchingFile(result.filePath);
      // Add to recent files
      addToRecentFiles(result.filePath);
      return { success: true, filePath: result.filePath, fileName };
    } catch (error) {
      throw new Error(`Failed to save file: ${error}`);
    }
  }
);

// Show unsaved changes dialog
ipcMain.handle(
  'show-unsaved-dialog',
  async (_, data: { fileName: string }) => {
    if (!mainWindow) return { response: 1 }; // Don't save

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Unsaved Changes',
      message: `Do you want to save the changes to "${data.fileName}"?`,
      detail: "Your changes will be lost if you don't save them.",
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });

    return { response: result.response };
  }
);

// Handle close confirmation from renderer
ipcMain.handle('confirm-close', () => {
  forceClose = true;
  mainWindow?.close();
});

// Handle close cancellation from renderer
ipcMain.handle('cancel-close', () => {
  // Do nothing, just allow the renderer to continue
});

// Folder operations
ipcMain.handle('open-folder-dialog', async () => {
  await openFolderDialog();
});

ipcMain.handle('read-folder-contents', async (_, folderPath: string) => {
  return await readFolderContents(folderPath);
});

ipcMain.handle('close-folder', () => {
  closeFolder();
});

ipcMain.handle('get-current-folder', () => {
  const currentFolder = store.get('currentFolder');
  if (!currentFolder) return null;
  return {
    folderPath: currentFolder,
    folderName: path.basename(currentFolder),
  };
});

// File view mode storage
ipcMain.handle('get-file-view-mode', (_, filePath: string) => {
  const fileViewModes = store.get('fileViewModes') || {};
  return fileViewModes[filePath] || null;
});

ipcMain.handle('set-file-view-mode', (_, filePath: string, mode: MarkdownViewMode) => {
  const fileViewModes = store.get('fileViewModes') || {};
  fileViewModes[filePath] = mode;
  store.set('fileViewModes', fileViewModes);
});

// AI provider handlers
ipcMain.handle('test-ai-connection', async (_, provider: AIProvider, options: AIOptions) => {
  return await testConnection(provider, options);
});

ipcMain.handle('list-ai-models', async (_, provider: AIProvider, options: AIOptions) => {
  return await listModels(provider, options);
});

ipcMain.handle('get-ai-key-status', async (_, provider: AIProvider, keyFilePath: string) => {
  return await getKeyStatus(provider, keyFilePath);
});

ipcMain.handle('smart-match-ai-model', (_, provider: AIProvider, savedModelId: string | null, availableModels: Array<{ id: string; displayName: string; provider: AIProvider }>) => {
  return smartMatchModel(provider, savedModelId, availableModels);
});

ipcMain.handle('browse-key-file', async () => {
  if (!mainWindow) return { canceled: true };

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'showHiddenFiles'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
    ],
    // The key file is read again in later sessions, which the sandbox only
    // allows via a bookmark
    securityScopedBookmarks: process.mas,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  saveBookmark(result.filePaths[0], result.bookmarks?.[0]);

  return {
    canceled: false,
    filePath: result.filePaths[0],
  };
});

// Chat database handlers
ipcMain.handle('chat-get-conversation', (_, filePath: string) => {
  return getConversation(filePath);
});

ipcMain.handle('chat-save-message', (_, filePath: string, message: ChatMessage) => {
  return saveMessage(filePath, message);
});

ipcMain.handle('chat-clear-conversation', (_, filePath: string) => {
  clearConversation(filePath);
  return { success: true };
});

ipcMain.handle('chat-get-message-count', (_, filePath: string) => {
  return getMessageCount(filePath);
});

ipcMain.handle('chat-needs-compaction', (_, filePath: string, threshold: number) => {
  return needsCompaction(filePath, threshold);
});

// Chat streaming handlers
ipcMain.handle('chat-stream-start', async (
  _,
  request: ChatStreamRequest,
  tools: ToolDefinition[]
) => {
  const ai = getPreferencesWithDefaults().ai;
  const chat = getPreferencesWithDefaults().chat;

  // Build system prompt with formatting context
  const formatting = getPreferencesWithDefaults().formatting;
  const systemPromptWithContext = `${chat.systemPrompt}

Current file context:
- File: ${request.fileName}
- Formatting: indent=${formatting.indentSize}, maxLine=${formatting.maxLineLength}, sqlDialect=${formatting.sqlDialect}`;

  // Filter tools based on explicit allowEdits toggle
  // When false, don't provide find_and_replace - if the tool isn't available, it can't be called
  const availableTools = request.allowEdits
    ? tools
    : tools.filter(t => t.name !== 'find_and_replace');

  // Track conversation and file content for tool execution loop
  let conversationHistory = [...request.conversationHistory];
  let currentFileContent = request.fileContent;
  const pendingToolCalls: ToolCall[] = [];
  const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops
  let iterationCount = 0;
  let lastFailedToolCall: string | null = null; // Track consecutive failed calls
  let consecutiveFailures = 0;
  const successfulOperations = new Set<string>(); // Track successful tool calls to prevent duplicates
  let hadToolCalls = false; // Track if any tool calls have been made (to suppress streaming after first iteration)
  let alreadyCompletedCount = 0; // Track "already completed" responses to detect stuck loops

  // Tool context for executing tools
  const createToolContext = (): ToolContext => ({
    fileContent: currentFileContent,
    selection: request.selection,
    onContentUpdate: (newContent: string) => {
      currentFileContent = newContent;
      mainWindow?.webContents.send('chat-content-update', {
        requestId: request.requestId,
        newContent,
      });
    },
  });

  // Main chat loop - continues until no more tool calls
  const runChatLoop = async (): Promise<void> => {
    if (iterationCount >= MAX_TOOL_ITERATIONS) {
      mainWindow?.webContents.send('chat-error', {
        requestId: request.requestId,
        error: 'Maximum tool call iterations reached',
      });
      return;
    }
    iterationCount++;

    return new Promise((resolve, reject) => {
      streamChat(
        ai.provider,
        ai,
        conversationHistory,
        systemPromptWithContext,
        availableTools,
        {
          onToken: (token) => {
            // Only stream tokens if we haven't had any tool calls yet
            // This prevents "vanishing text" during tool-use iterations
            if (!hadToolCalls) {
              mainWindow?.webContents.send('chat-token', {
                requestId: request.requestId,
                token,
              });
            }
          },
          onToolCall: (toolCall) => {
            hadToolCalls = true; // Mark that we've had tool calls - suppress subsequent streaming
            pendingToolCalls.push(toolCall);
            mainWindow?.webContents.send('chat-tool-call', {
              requestId: request.requestId,
              toolCall,
            });
          },
          onToolResult: (result) => {
            mainWindow?.webContents.send('chat-tool-result', {
              requestId: request.requestId,
              result,
            });
          },
          onComplete: async (message) => {
            // Add assistant message to conversation
            conversationHistory.push(message);

            // Check if there are tool calls to execute
            if (message.toolCalls && message.toolCalls.length > 0) {
              // Send the assistant message with tool calls to renderer
              // so it's included in conversation history for future requests
              mainWindow?.webContents.send('chat-assistant-message', {
                requestId: request.requestId,
                message,
              });

              const toolContext = createToolContext();

              // Execute each tool call
              for (const toolCall of message.toolCalls) {
                // Create signature for this tool call
                const toolCallSignature = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;

                // For read operations, track by name only (not arguments) to catch models that vary args
                const isReadOperation = toolCall.name === 'read_file_content' || toolCall.name === 'read_selection';
                const dedupeKey = isReadOperation ? toolCall.name : toolCallSignature;

                // Check if this operation already succeeded
                if (successfulOperations.has(dedupeKey)) {
                  alreadyCompletedCount++;

                  // Don't re-execute, return a message indicating it's already done
                  const alreadyDoneResult: ToolResult = {
                    toolCallId: toolCall.id,
                    content: 'This operation was already completed successfully. STOP calling tools and answer the user directly.',
                    isError: false,
                  };

                  mainWindow?.webContents.send('chat-tool-result', {
                    requestId: request.requestId,
                    result: alreadyDoneResult,
                  });

                  const toolResultMessage: ChatMessage = {
                    role: 'tool',
                    content: alreadyDoneResult.content,
                    toolCallId: toolCall.id,
                    isError: false,
                    timestamp: Date.now(),
                  };
                  conversationHistory.push(toolResultMessage);

                  // Immediately bail out after 2 "already completed" responses - force complete NOW
                  if (alreadyCompletedCount >= 2) {
                    const forceCompleteMessage: ChatMessage = {
                      role: 'assistant',
                      content: 'I have read the document. Let me provide a summary based on its contents.',
                      timestamp: Date.now(),
                    };
                    mainWindow?.webContents.send('chat-complete', {
                      requestId: request.requestId,
                      message: forceCompleteMessage,
                    });
                    resolve();
                    return;
                  }
                  continue;
                }

                const result = executeTool(toolCall, toolContext);
                result.toolCallId = toolCall.id;
                if (result.isError) {
                  if (lastFailedToolCall === toolCallSignature) {
                    consecutiveFailures++;
                  } else {
                    lastFailedToolCall = toolCallSignature;
                    consecutiveFailures = 1;
                  }
                } else {
                  // Track successful operation to prevent re-execution
                  // Use dedupeKey for read ops (by name) so arg variations are caught
                  successfulOperations.add(dedupeKey);
                  // Reset failure tracking on success
                  lastFailedToolCall = null;
                  consecutiveFailures = 0;
                }

                // Send tool result to renderer
                mainWindow?.webContents.send('chat-tool-result', {
                  requestId: request.requestId,
                  result,
                });

                // Add tool result message to conversation
                const toolResultMessage: ChatMessage = {
                  role: 'tool',
                  content: result.content,
                  toolCallId: toolCall.id,
                  isError: result.isError,
                  timestamp: Date.now(),
                };
                conversationHistory.push(toolResultMessage);
              }

              // Clear pending tool calls
              pendingToolCalls.length = 0;

              // If the same tool call failed 2+ times, stop the loop
              if (consecutiveFailures >= 2) {
                mainWindow?.webContents.send('chat-error', {
                  requestId: request.requestId,
                  error: 'The AI keeps trying the same failed operation. Please rephrase your request.',
                });
                resolve();
                return;
              }

              // If the model keeps calling already-completed operations, stop and force a response
              if (alreadyCompletedCount >= 2) {
                // Force complete the conversation - model is stuck in a loop
                const forceCompleteMessage: ChatMessage = {
                  role: 'assistant',
                  content: 'I have all the information I need. Let me answer your question based on what I read.',
                  timestamp: Date.now(),
                };
                mainWindow?.webContents.send('chat-complete', {
                  requestId: request.requestId,
                  message: forceCompleteMessage,
                });
                resolve();
                return;
              }

              // Continue the conversation with tool results
              try {
                await runChatLoop();
                resolve();
              } catch (err) {
                reject(err);
              }
            } else {
              // No tool calls - we're done
              mainWindow?.webContents.send('chat-complete', {
                requestId: request.requestId,
                message,
              });
              resolve();
            }
          },
          onError: (error) => {
            mainWindow?.webContents.send('chat-error', {
              requestId: request.requestId,
              error: error.message,
            });
            reject(error);
          },
        },
        request.requestId,
        mainWindow
      ).catch(reject);
    });
  };

  // Start the chat loop
  try {
    await runChatLoop();
  } catch (error) {
    // Error already sent to renderer
  }
});

ipcMain.handle('chat-stream-stop', (_, requestId: string) => {
  return abortChat(requestId);
});

// Listen for OS theme changes
nativeTheme.on('updated', () => {
  if (store.get('theme') === 'system') {
    mainWindow?.webContents.send('theme-changed', getTheme());
  }
});

// Handle file open events on macOS (when file is double-clicked or dragged to app icon)
app.on('open-file', (event, filePath) => {
  event.preventDefault();

  if (!isSupportedFile(filePath)) {
    return;
  }

  // If no window exists (macOS: app can run without windows), create one
  if (!mainWindow) {
    filesToOpenOnReady.push(filePath);
    // Only create window if app is ready (otherwise whenReady will create it)
    if (app.isReady()) {
      createWindow();
    }
    return;
  }

  if (initialStartupComplete) {
    // App is fully initialized, open the file directly
    openFile(filePath);
    // Bring app and window to foreground on macOS
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
    app.focus({ steal: true });
  } else {
    // App window exists but still initializing, queue the file
    filesToOpenOnReady.push(filePath);
  }
});

// Request single instance lock for Windows/Linux
// This ensures only one instance runs and passes files to the existing instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running, quit this one
  // The other instance will receive our command line args via second-instance event
  app.quit();
} else {
  // Handle second instance (Windows/Linux)
  app.on('second-instance', (event, commandLine) => {
    // Someone tried to run a second instance, focus our window and open their files
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();

      // Open any files passed to the second instance
      const filePaths = getFilePathsFromArgs(commandLine);
      for (const filePath of filePaths) {
        openFile(filePath);
      }
    }
  });
}

// Get files from initial command line args
filesToOpenOnReady = getFilePathsFromArgs(process.argv);

app.whenReady().then(() => {
  // Initialize chat database
  try {
    initChatDatabase();
  } catch (err) {
    console.error('Failed to initialize chat database:', err);
    // Continue without chat - the app should still work
  }

  // Register protocol handler for local files
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopAllWatchers();
  closeChatDatabase();
});
