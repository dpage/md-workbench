//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import * as prettier from 'prettier/standalone';
import * as parserBabel from 'prettier/plugins/babel';
import * as parserEstree from 'prettier/plugins/estree';
import * as parserTypescript from 'prettier/plugins/typescript';
import * as parserHtml from 'prettier/plugins/html';
import * as parserCss from 'prettier/plugins/postcss';
import * as parserMarkdown from 'prettier/plugins/markdown';
import { FormattingOptions } from '../../../shared/preferences';
import { FormatResult, Formatter } from './types';

type PrettierParser = 'babel' | 'typescript' | 'css' | 'html' | 'markdown';

export class PrettierFormatter implements Formatter {
  private parser: PrettierParser;

  constructor(parser: PrettierParser) {
    this.parser = parser;
  }

  format(content: string, options: FormattingOptions): FormatResult {
    try {
      // Get the appropriate plugins for the parser
      const plugins = this.getPlugins();

      // Map end of line setting
      let endOfLine: 'lf' | 'crlf' | 'auto' = 'lf';
      if (options.endOfLine === 'crlf') {
        endOfLine = 'crlf';
      } else if (options.endOfLine === 'auto') {
        endOfLine = 'auto';
      }

      // Format synchronously using formatSync (available in standalone)
      // Note: We need to use the async version and handle it properly
      prettier.format(content, {
        parser: this.parser,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plugins: plugins as any[],
        printWidth: options.maxLineLength,
        tabWidth: options.indentSize,
        useTabs: options.useTabs,
        endOfLine,
        singleQuote: true,
        trailingComma: 'es5',
        bracketSpacing: true,
        htmlWhitespaceSensitivity: 'css',
      });

      // Since prettier.format returns a Promise in standalone mode,
      // we need to handle this differently. For now, return a marker
      // and the actual formatting will be done async in the caller.
      // However, this is a sync interface, so we'll use a workaround.

      // Actually, prettier standalone only provides async format.
      // We need to change our interface or use a different approach.
      // For now, let's indicate this needs async handling.
      return {
        success: false,
        error:
          'Prettier requires async formatting - use formatDocumentAsync instead',
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to format document',
      };
    }
  }

  private getPlugins(): unknown[] {
    switch (this.parser) {
      case 'babel':
        return [parserBabel, parserEstree];
      case 'typescript':
        return [parserTypescript, parserEstree];
      case 'css':
        return [parserCss];
      case 'html':
        return [parserHtml];
      case 'markdown':
        return [parserMarkdown];
      default:
        return [];
    }
  }

  async formatAsync(
    content: string,
    options: FormattingOptions
  ): Promise<FormatResult> {
    try {
      const plugins = this.getPlugins();

      let endOfLine: 'lf' | 'crlf' | 'auto' = 'lf';
      if (options.endOfLine === 'crlf') {
        endOfLine = 'crlf';
      } else if (options.endOfLine === 'auto') {
        endOfLine = 'auto';
      }

      const formatted = await prettier.format(content, {
        parser: this.parser,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plugins: plugins as any[],
        printWidth: options.maxLineLength,
        tabWidth: options.indentSize,
        useTabs: options.useTabs,
        endOfLine,
        singleQuote: true,
        trailingComma: 'es5',
        bracketSpacing: true,
        htmlWhitespaceSensitivity: 'css',
        // Enable prose wrapping for markdown files if configured
        proseWrap:
          this.parser === 'markdown' && options.wrapProse ? 'always' : 'preserve',
      });

      return {
        success: true,
        content: formatted,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to format document',
      };
    }
  }
}
