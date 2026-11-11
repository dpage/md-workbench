//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

'use strict';

let binding = null;
if (process.platform === 'darwin') {
  try {
    binding = require('./build/Release/bookmarks.node');
  } catch {
    binding = null;
  }
}

// Returns a base64 security-scoped bookmark for filePath, in the format
// Electron's dialogs return and app.startAccessingSecurityScopedResource()
// accepts, or null if the bookmark can't be created
exports.createSecurityScopedBookmark = (filePath) =>
  binding ? binding.createSecurityScopedBookmark(filePath) : null;
