//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Mock for json-stringify-pretty-compact
const stringify = (obj: unknown, options?: { indent?: number }) => {
  return JSON.stringify(obj, null, options?.indent ?? 2);
};
export default stringify;
