//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import yaml from 'js-yaml';
import { FormattingOptions } from '../../../shared/preferences';
import { FormatResult, Formatter } from './types';

export class YamlFormatter implements Formatter {
  format(content: string, options: FormattingOptions): FormatResult {
    try {
      // Parse the YAML
      const parsed = yaml.load(content);

      // Format with js-yaml
      const formatted = yaml.dump(parsed, {
        indent: options.indentSize,
        lineWidth: options.maxLineLength,
        noRefs: true,
        sortKeys: options.sortJsonKeys, // Use same setting for YAML key sorting
      });

      // Handle end of line
      let result = formatted;
      if (options.endOfLine === 'crlf') {
        result = result.replace(/\n/g, '\r\n');
      } else if (options.endOfLine === 'lf') {
        result = result.replace(/\r\n/g, '\n');
      }
      // 'auto' leaves as-is

      return {
        success: true,
        content: result,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to format YAML',
      };
    }
  }
}
