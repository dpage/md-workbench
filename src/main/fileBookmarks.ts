//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Security-scoped bookmarks for files and folders. In the Mac App Store build
// the sandbox only grants access to a file the user opened (from a dialog,
// Finder or a drag) until the app quits; a bookmark saved while access is
// granted restores it in later sessions, for reopened tabs, Recent Files and
// Recent Folders. A folder's bookmark also covers everything inside it.

import { app } from 'electron';
import Store from 'electron-store';
import * as path from 'path';
import { createSecurityScopedBookmark } from 'mdworkbench-bookmarks';

interface BookmarkSchema {
  bookmarks: Record<string, string>;
}

// Bookmarks are kept least recently used first and trimmed to this many
const MAX_BOOKMARKS = 200;

const bookmarkStore = new Store<BookmarkSchema>({
  name: 'bookmarks',
  defaults: { bookmarks: {} },
});

// Paths whose bookmark access has been started, or that have no usable
// bookmark and couldn't be bookmarked, this session
const accessStarted = new Set<string>();
const notBookmarkable = new Set<string>();

function storeBookmark(filePath: string, bookmark: string): void {
  const bookmarks = { ...bookmarkStore.get('bookmarks') };
  delete bookmarks[filePath];
  bookmarks[filePath] = bookmark;

  const paths = Object.keys(bookmarks);
  for (const oldPath of paths.slice(0, Math.max(0, paths.length - MAX_BOOKMARKS))) {
    delete bookmarks[oldPath];
  }
  bookmarkStore.set('bookmarks', bookmarks);
}

function removeBookmark(filePath: string): void {
  const bookmarks = { ...bookmarkStore.get('bookmarks') };
  delete bookmarks[filePath];
  bookmarkStore.set('bookmarks', bookmarks);
}

// Remember the bookmark Electron returned from an Open or Save dialog
export function saveBookmark(filePath: string, bookmark: string | undefined): void {
  if (!process.mas || !bookmark) return;
  storeBookmark(filePath, bookmark);
  accessStarted.delete(filePath);
  notBookmarkable.delete(filePath);
}

// The nearest bookmarked path covering filePath: itself or a parent folder
function findBookmarkedPath(filePath: string, bookmarks: Record<string, string>): string | undefined {
  let current = path.resolve(filePath);
  for (;;) {
    if (bookmarks[current]) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

// Make sure the sandbox lets the app access filePath. Starts access from a
// saved bookmark covering it, held until the app quits, or if there is none,
// bookmarks filePath in case this session already has access (for example a
// file opened from Finder). Does nothing outside the App Store build.
export function ensureFileAccess(filePath: string): void {
  if (!process.mas) return;

  const bookmarks = bookmarkStore.get('bookmarks');
  const bookmarkedPath = findBookmarkedPath(filePath, bookmarks);

  if (bookmarkedPath) {
    if (accessStarted.has(bookmarkedPath)) return;
    try {
      app.startAccessingSecurityScopedResource(bookmarks[bookmarkedPath]);
      accessStarted.add(bookmarkedPath);
      storeBookmark(bookmarkedPath, bookmarks[bookmarkedPath]);
      return;
    } catch (error) {
      // Stale (the file moved) or unresolvable; try to bookmark it afresh
      console.warn(`Could not use bookmark for ${bookmarkedPath}: ${error}`);
      removeBookmark(bookmarkedPath);
    }
  }

  const resolvedPath = path.resolve(filePath);
  if (notBookmarkable.has(resolvedPath)) return;

  const bookmark = createSecurityScopedBookmark(resolvedPath);
  if (bookmark) {
    storeBookmark(resolvedPath, bookmark);
  } else {
    notBookmarkable.add(resolvedPath);
  }
}
