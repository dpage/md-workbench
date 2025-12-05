//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import stringify from 'json-stringify-pretty-compact';
import { FormattingOptions } from '../../../shared/preferences';
import { FormatResult, Formatter } from './types';

/**
 * Sort object keys recursively
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export class JsonFormatter implements Formatter {
  format(content: string, options: FormattingOptions): FormatResult {
    try {
      // Parse the JSON
      let parsed = JSON.parse(content);

      // Sort keys if enabled
      if (options.sortJsonKeys) {
        parsed = sortObjectKeys(parsed);
      }

      // Format with json-stringify-pretty-compact
      const indent = options.useTabs ? '\t' : ' '.repeat(options.indentSize);
      const formatted = stringify(parsed, {
        indent,
        maxLength: options.maxLineLength,
      });

      // Handle end of line
      let result = formatted;
      if (options.endOfLine === 'crlf') {
        result = result.replace(/\n/g, '\r\n');
      } else if (options.endOfLine === 'lf') {
        result = result.replace(/\r\n/g, '\n');
      }
      // 'auto' leaves as-is

      // Ensure trailing newline
      if (!result.endsWith('\n') && !result.endsWith('\r\n')) {
        result += options.endOfLine === 'crlf' ? '\r\n' : '\n';
      }

      return {
        success: true,
        content: result,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to format JSON',
      };
    }
  }
}
