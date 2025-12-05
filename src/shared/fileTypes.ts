//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

export type FileType =
  | 'markdown'
  | 'json'
  | 'yaml'
  | 'xml'
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'html'
  | 'python'
  | 'sql'
  | 'shell'
  | 'plaintext';

export interface FileTypeInfo {
  type: FileType;
  label: string;
  highlightLanguage: string; // For highlight.js
  supportsRenderedView: boolean;
  supportsFormatting: boolean;
}

const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
  // Markdown files
  '.md': { type: 'markdown', label: 'Markdown', highlightLanguage: 'markdown', supportsRenderedView: true, supportsFormatting: true },
  '.markdown': { type: 'markdown', label: 'Markdown', highlightLanguage: 'markdown', supportsRenderedView: true, supportsFormatting: true },
  '.mdx': { type: 'markdown', label: 'MDX', highlightLanguage: 'markdown', supportsRenderedView: true, supportsFormatting: true },

  // JSON
  '.json': { type: 'json', label: 'JSON', highlightLanguage: 'json', supportsRenderedView: false, supportsFormatting: true },
  '.jsonc': { type: 'json', label: 'JSON with Comments', highlightLanguage: 'json', supportsRenderedView: false, supportsFormatting: true },
  '.json5': { type: 'json', label: 'JSON5', highlightLanguage: 'json', supportsRenderedView: false, supportsFormatting: true },

  // YAML
  '.yaml': { type: 'yaml', label: 'YAML', highlightLanguage: 'yaml', supportsRenderedView: false, supportsFormatting: true },
  '.yml': { type: 'yaml', label: 'YAML', highlightLanguage: 'yaml', supportsRenderedView: false, supportsFormatting: true },

  // XML
  '.xml': { type: 'xml', label: 'XML', highlightLanguage: 'xml', supportsRenderedView: false, supportsFormatting: true },
  '.svg': { type: 'xml', label: 'SVG', highlightLanguage: 'xml', supportsRenderedView: false, supportsFormatting: true },
  '.xsd': { type: 'xml', label: 'XSD', highlightLanguage: 'xml', supportsRenderedView: false, supportsFormatting: true },
  '.xsl': { type: 'xml', label: 'XSL', highlightLanguage: 'xml', supportsRenderedView: false, supportsFormatting: true },
  '.xslt': { type: 'xml', label: 'XSLT', highlightLanguage: 'xml', supportsRenderedView: false, supportsFormatting: true },
  '.plist': { type: 'xml', label: 'Property List', highlightLanguage: 'xml', supportsRenderedView: false, supportsFormatting: true },

  // JavaScript/TypeScript
  '.js': { type: 'javascript', label: 'JavaScript', highlightLanguage: 'javascript', supportsRenderedView: false, supportsFormatting: true },
  '.mjs': { type: 'javascript', label: 'JavaScript Module', highlightLanguage: 'javascript', supportsRenderedView: false, supportsFormatting: true },
  '.cjs': { type: 'javascript', label: 'CommonJS', highlightLanguage: 'javascript', supportsRenderedView: false, supportsFormatting: true },
  '.jsx': { type: 'javascript', label: 'JSX', highlightLanguage: 'javascript', supportsRenderedView: false, supportsFormatting: true },
  '.ts': { type: 'typescript', label: 'TypeScript', highlightLanguage: 'typescript', supportsRenderedView: false, supportsFormatting: true },
  '.tsx': { type: 'typescript', label: 'TSX', highlightLanguage: 'typescript', supportsRenderedView: false, supportsFormatting: true },
  '.d.ts': { type: 'typescript', label: 'TypeScript Declaration', highlightLanguage: 'typescript', supportsRenderedView: false, supportsFormatting: true },

  // CSS
  '.css': { type: 'css', label: 'CSS', highlightLanguage: 'css', supportsRenderedView: false, supportsFormatting: true },
  '.scss': { type: 'css', label: 'SCSS', highlightLanguage: 'scss', supportsRenderedView: false, supportsFormatting: true },
  '.sass': { type: 'css', label: 'Sass', highlightLanguage: 'scss', supportsRenderedView: false, supportsFormatting: true },
  '.less': { type: 'css', label: 'Less', highlightLanguage: 'less', supportsRenderedView: false, supportsFormatting: true },

  // HTML
  '.html': { type: 'html', label: 'HTML', highlightLanguage: 'html', supportsRenderedView: false, supportsFormatting: true },
  '.htm': { type: 'html', label: 'HTML', highlightLanguage: 'html', supportsRenderedView: false, supportsFormatting: true },
  '.xhtml': { type: 'html', label: 'XHTML', highlightLanguage: 'html', supportsRenderedView: false, supportsFormatting: true },

  // Python
  '.py': { type: 'python', label: 'Python', highlightLanguage: 'python', supportsRenderedView: false, supportsFormatting: false },
  '.pyw': { type: 'python', label: 'Python', highlightLanguage: 'python', supportsRenderedView: false, supportsFormatting: false },
  '.pyi': { type: 'python', label: 'Python Stub', highlightLanguage: 'python', supportsRenderedView: false, supportsFormatting: false },

  // SQL
  '.sql': { type: 'sql', label: 'SQL', highlightLanguage: 'sql', supportsRenderedView: false, supportsFormatting: true },

  // Shell
  '.sh': { type: 'shell', label: 'Shell Script', highlightLanguage: 'bash', supportsRenderedView: false, supportsFormatting: false },
  '.bash': { type: 'shell', label: 'Bash Script', highlightLanguage: 'bash', supportsRenderedView: false, supportsFormatting: false },
  '.zsh': { type: 'shell', label: 'Zsh Script', highlightLanguage: 'bash', supportsRenderedView: false, supportsFormatting: false },
  '.fish': { type: 'shell', label: 'Fish Script', highlightLanguage: 'bash', supportsRenderedView: false, supportsFormatting: false },
  '.ps1': { type: 'shell', label: 'PowerShell', highlightLanguage: 'powershell', supportsRenderedView: false, supportsFormatting: false },
  '.bat': { type: 'shell', label: 'Batch File', highlightLanguage: 'dos', supportsRenderedView: false, supportsFormatting: false },
  '.cmd': { type: 'shell', label: 'Command File', highlightLanguage: 'dos', supportsRenderedView: false, supportsFormatting: false },

  // Config files (plain text with some structure)
  '.txt': { type: 'plaintext', label: 'Plain Text', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.log': { type: 'plaintext', label: 'Log File', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.ini': { type: 'plaintext', label: 'INI File', highlightLanguage: 'ini', supportsRenderedView: false, supportsFormatting: false },
  '.conf': { type: 'plaintext', label: 'Config File', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.cfg': { type: 'plaintext', label: 'Config File', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.env': { type: 'plaintext', label: 'Environment File', highlightLanguage: 'bash', supportsRenderedView: false, supportsFormatting: false },
  '.gitignore': { type: 'plaintext', label: 'Git Ignore', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.dockerignore': { type: 'plaintext', label: 'Docker Ignore', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.editorconfig': { type: 'plaintext', label: 'Editor Config', highlightLanguage: 'ini', supportsRenderedView: false, supportsFormatting: false },
  '.prettierrc': { type: 'json', label: 'Prettier Config', highlightLanguage: 'json', supportsRenderedView: false, supportsFormatting: true },
  '.eslintrc': { type: 'json', label: 'ESLint Config', highlightLanguage: 'json', supportsRenderedView: false, supportsFormatting: true },

  // Docker
  'dockerfile': { type: 'plaintext', label: 'Dockerfile', highlightLanguage: 'dockerfile', supportsRenderedView: false, supportsFormatting: false },

  // Other
  '.toml': { type: 'plaintext', label: 'TOML', highlightLanguage: 'ini', supportsRenderedView: false, supportsFormatting: false },
  '.csv': { type: 'plaintext', label: 'CSV', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
  '.tsv': { type: 'plaintext', label: 'TSV', highlightLanguage: 'plaintext', supportsRenderedView: false, supportsFormatting: false },
};

// Default for unknown file types
const DEFAULT_FILE_TYPE_INFO: FileTypeInfo = {
  type: 'plaintext',
  label: 'Plain Text',
  highlightLanguage: 'plaintext',
  supportsRenderedView: false,
  supportsFormatting: false,
};

/**
 * Get file type information from a file path or name
 */
export function getFileTypeInfo(filePath: string): FileTypeInfo {
  const fileName = filePath.toLowerCase().split('/').pop() || filePath.toLowerCase();

  // Check for exact filename matches first (e.g., Dockerfile)
  if (FILE_TYPE_MAP[fileName]) {
    return FILE_TYPE_MAP[fileName];
  }

  // Check for extension matches
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex !== -1) {
    const extension = fileName.slice(lastDotIndex);
    if (FILE_TYPE_MAP[extension]) {
      return FILE_TYPE_MAP[extension];
    }
  }

  return DEFAULT_FILE_TYPE_INFO;
}

/**
 * Check if a file type supports the rendered markdown view
 */
export function supportsRenderedView(filePath: string): boolean {
  return getFileTypeInfo(filePath).supportsRenderedView;
}

/**
 * Check if a file type supports markdown formatting controls
 */
export function supportsFormatting(filePath: string): boolean {
  return getFileTypeInfo(filePath).supportsFormatting;
}

/**
 * Get the highlight.js language for syntax highlighting
 */
export function getHighlightLanguage(filePath: string): string {
  return getFileTypeInfo(filePath).highlightLanguage;
}

/**
 * List of supported file extensions for the open dialog
 */
export const SUPPORTED_EXTENSIONS = [
  // Markdown
  'md', 'markdown', 'mdx',
  // Data formats
  'json', 'jsonc', 'json5', 'yaml', 'yml', 'xml', 'svg', 'csv', 'tsv', 'toml',
  // Web
  'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
  // JavaScript/TypeScript
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  // Python
  'py', 'pyw', 'pyi',
  // SQL
  'sql',
  // Shell
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  // Config/Text
  'txt', 'log', 'ini', 'conf', 'cfg', 'env',
];
