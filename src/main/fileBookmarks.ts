//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Security-scoped bookmarks for files chosen in an Open dialog. In the Mac
// App Store build the sandbox only grants access to a chosen file until the
// app quits; a bookmark saved at selection time restores that access later.

import { app } from 'electron';
import Store from 'electron-store';

interface BookmarkSchema {
  bookmarks: Record<string, string>;
}

const bookmarkStore = new Store<BookmarkSchema>({
  name: 'bookmarks',
  defaults: { bookmarks: {} },
});

// Remember the bookmark for a file chosen in an Open dialog
export function saveBookmark(filePath: string, bookmark: string | undefined): void {
  if (!process.mas || !bookmark) return;
  bookmarkStore.set('bookmarks', { ...bookmarkStore.get('bookmarks'), [filePath]: bookmark });
}

// Run fn with sandbox access to filePath, if a bookmark was saved for it
export async function withFileAccess<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const bookmark = process.mas ? bookmarkStore.get('bookmarks')[filePath] : undefined;
  if (!bookmark) return fn();

  const stopAccessing = app.startAccessingSecurityScopedResource(bookmark) as () => void;
  try {
    return await fn();
  } finally {
    stopAccessing();
  }
}
