//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import { format, SqlLanguage } from 'sql-formatter';
import { FormattingOptions, SqlDialect } from '../../../shared/preferences';
import { FormatResult, Formatter } from './types';

// Map our dialect names to sql-formatter language names
const dialectMap: Record<SqlDialect, SqlLanguage> = {
  postgresql: 'postgresql',
  sqlite: 'sqlite',
  sql: 'sql',
};

export class SqlFormatter implements Formatter {
  format(content: string, options: FormattingOptions): FormatResult {
    try {
      const language = dialectMap[options.sqlDialect] || 'sql';

      const formatted = format(content, {
        language,
        tabWidth: options.indentSize,
        useTabs: options.useTabs,
        keywordCase: options.sqlUppercaseKeywords ? 'upper' : 'preserve',
        linesBetweenQueries: 2,
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
        error: err instanceof Error ? err.message : 'Failed to format SQL',
      };
    }
  }
}
