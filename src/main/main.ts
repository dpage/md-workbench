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
const APP_VERSION = '1.0.0-alpha.1';
const APP_COPYRIGHT = 'Copyright \u00A9 2025 Dave Page';

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

interface Preferences {
  autoReload: boolean;
  openLinksInNewTab: boolean;
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
  theme: 'light' | 'dark' | 'system';
  preferences: Preferences;
  recentFiles: string[];
  recentFolders: string[];
  currentFolder: string | null;
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
    preferences: {
      autoReload: true,
      openLinksInNewTab: false,
    },
    recentFiles: [],
    recentFolders: [],
    currentFolder: null,
  },
});

let mainWindow: BrowserWindow | null = null;

// Files to open when app is ready (from command line or open-file event)
let filesToOpenOnReady: string[] = [];

// File watchers map
const fileWatchers = new Map<string, fs.FSWatcher>();

// Track if we're force closing (bypass unsaved check)
let forceClose = false;

// Check if a file path is a supported markdown file
function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.md', '.markdown', '.txt'].includes(ext);
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
      if (eventType === 'change' && store.get('preferences').autoReload) {
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
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Theme',
          submenu: [
            {
              label: 'System Default',
              type: 'radio',
              checked: store.get('theme') === 'system',
              click: () => setTheme('system'),
            },
            {
              label: 'Light',
              type: 'radio',
              checked: store.get('theme') === 'light',
              click: () => setTheme('light'),
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: store.get('theme') === 'dark',
              click: () => setTheme('dark'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Auto-Reload Files',
          type: 'checkbox',
          checked: store.get('preferences').autoReload,
          click: (menuItem) => {
            const preferences = store.get('preferences');
            preferences.autoReload = menuItem.checked;
            store.set('preferences', preferences);
            mainWindow?.webContents.send('preferences-changed', preferences);
          },
        },
        {
          label: 'Open Links in New Tab',
          type: 'checkbox',
          checked: store.get('preferences').openLinksInNewTab,
          click: (menuItem) => {
            const preferences = store.get('preferences');
            preferences.openLinksInNewTab = menuItem.checked;
            store.set('preferences', preferences);
            mainWindow?.webContents.send('preferences-changed', preferences);
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
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
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setTheme(theme: 'light' | 'dark' | 'system'): void {
  store.set('theme', theme);
  const effectiveTheme = getTheme();
  mainWindow?.webContents.send('theme-changed', effectiveTheme);
  createMenu(); // Rebuild menu to update radio button states
}

async function openFileDialog(): Promise<void> {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] },
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
    mainWindow.webContents.send('file-opened', {
      filePath,
      fileName,
      content,
      replaceCurrentTab,
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
    }
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
  });
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
  await openFileDialog();
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    // Start watching the file for changes
    startWatchingFile(filePath);
    return { filePath, fileName, content };
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
  return store.get('preferences');
});

ipcMain.handle('set-preferences', (_, preferences: Preferences) => {
  store.set('preferences', preferences);
});

// File watcher handlers
ipcMain.handle('start-watching', (_, filePath: string) => {
  startWatchingFile(filePath);
});

ipcMain.handle('stop-watching', (_, filePath: string) => {
  stopWatchingFile(filePath);
});

// Link handling
ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('open-local-file', async (_, filePath: string) => {
  const openInNewTab = store.get('preferences').openLinksInNewTab;
  await openFile(filePath, !openInNewTab);
});

ipcMain.handle('get-open-links-in-new-tab', () => {
  return store.get('preferences').openLinksInNewTab;
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

  if (mainWindow) {
    // App is already running, open the file
    openFile(filePath);
    // Focus the window
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  } else {
    // App is starting up, queue the file to open when ready
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
});
