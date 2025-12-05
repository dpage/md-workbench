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

export interface FormatResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface Formatter {
  /**
   * Format the given content according to the formatting options.
   * @param content The source code to format
   * @param options The formatting options from preferences
   * @returns FormatResult with either the formatted content or an error message
   */
  format(content: string, options: FormattingOptions): FormatResult;

  /**
   * Format the given content asynchronously.
   * Some formatters (like Prettier) require async operations.
   * @param content The source code to format
   * @param options The formatting options from preferences
   * @returns Promise<FormatResult> with either the formatted content or an error message
   */
  formatAsync?(
    content: string,
    options: FormattingOptions
  ): Promise<FormatResult>;
}

/**
 * File types that support formatting
 */
export const FORMATTABLE_FILE_TYPES: FileType[] = [
  'markdown',
  'json',
  'yaml',
  'sql',
  'javascript',
  'typescript',
  'css',
  'html',
  'xml',
];

/**
 * Check if a file type supports formatting
 */
export function isFormattableFileType(fileType: FileType): boolean {
  return FORMATTABLE_FILE_TYPES.includes(fileType);
}
