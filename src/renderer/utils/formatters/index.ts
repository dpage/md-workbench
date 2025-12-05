//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import { FileType } from '../../../shared/fileTypes';
import { FormattingOptions } from '../../../shared/preferences';
import { FormatResult, Formatter, isFormattableFileType } from './types';
import { JsonFormatter } from './jsonFormatter';
import { YamlFormatter } from './yamlFormatter';
import { SqlFormatter } from './sqlFormatter';
import { PrettierFormatter } from './prettierFormatter';

// Registry of formatters by file type
const formatters: Partial<Record<FileType, Formatter>> = {
  markdown: new PrettierFormatter('markdown'),
  json: new JsonFormatter(),
  yaml: new YamlFormatter(),
  sql: new SqlFormatter(),
  javascript: new PrettierFormatter('babel'),
  typescript: new PrettierFormatter('typescript'),
  css: new PrettierFormatter('css'),
  html: new PrettierFormatter('html'),
  xml: new PrettierFormatter('html'), // Prettier uses html parser for xml
};

/**
 * Check if a document can be formatted based on its file type
 */
export function canFormatDocument(fileType: FileType): boolean {
  return isFormattableFileType(fileType);
}

/**
 * Format a document's content based on its file type (async version)
 * Use this for all formatting - it handles both sync and async formatters.
 */
export async function formatDocument(
  content: string,
  fileType: FileType,
  options: FormattingOptions
): Promise<FormatResult> {
  if (!canFormatDocument(fileType)) {
    return {
      success: false,
      error: `Formatting is not supported for ${fileType} files`,
    };
  }

  const formatter = formatters[fileType];
  if (!formatter) {
    return {
      success: false,
      error: `No formatter available for ${fileType} files`,
    };
  }

  try {
    // Use async version if available (for Prettier)
    if (formatter.formatAsync) {
      return await formatter.formatAsync(content, options);
    }
    // Otherwise use sync version
    return formatter.format(content, options);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown formatting error',
    };
  }
}

export type { FormatResult, Formatter } from './types';
export { isFormattableFileType } from './types';
