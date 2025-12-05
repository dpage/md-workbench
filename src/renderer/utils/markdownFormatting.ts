//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

export interface FormattingResult {
  newContent: string;
  newSelectionStart: number;
  newSelectionEnd: number;
}

// Get the current line range for a position
function getLineRange(
  content: string,
  position: number
): { start: number; end: number } {
  let start = position;
  let end = position;

  // Find start of line
  while (start > 0 && content[start - 1] !== '\n') {
    start--;
  }

  // Find end of line
  while (end < content.length && content[end] !== '\n') {
    end++;
  }

  return { start, end };
}

// Get all lines that are fully or partially selected
function getSelectedLines(
  content: string,
  selectionStart: number,
  selectionEnd: number
): { start: number; end: number } {
  const firstLine = getLineRange(content, selectionStart);
  const lastLine = getLineRange(content, selectionEnd);
  return { start: firstLine.start, end: lastLine.end };
}

// Wrap selected text with markers (e.g., ** for bold)
export function wrapSelection(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  wrapper: string,
  endWrapper?: string
): FormattingResult {
  const end = endWrapper ?? wrapper;
  const selectedText = content.substring(selectionStart, selectionEnd);

  // Check if already wrapped - if so, unwrap
  const beforeStart = selectionStart - wrapper.length;
  const afterEnd = selectionEnd + end.length;

  if (
    beforeStart >= 0 &&
    afterEnd <= content.length &&
    content.substring(beforeStart, selectionStart) === wrapper &&
    content.substring(selectionEnd, afterEnd) === end
  ) {
    // Unwrap
    const newContent =
      content.substring(0, beforeStart) +
      selectedText +
      content.substring(afterEnd);
    return {
      newContent,
      newSelectionStart: beforeStart,
      newSelectionEnd: beforeStart + selectedText.length,
    };
  }

  // Wrap
  const newContent =
    content.substring(0, selectionStart) +
    wrapper +
    selectedText +
    end +
    content.substring(selectionEnd);

  return {
    newContent,
    newSelectionStart: selectionStart + wrapper.length,
    newSelectionEnd: selectionEnd + wrapper.length,
  };
}

// Apply bold formatting
export function toggleBold(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  return wrapSelection(content, selectionStart, selectionEnd, '**');
}

// Apply italic formatting
export function toggleItalic(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  return wrapSelection(content, selectionStart, selectionEnd, '*');
}

// Apply strikethrough formatting
export function toggleStrikethrough(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  return wrapSelection(content, selectionStart, selectionEnd, '~~');
}

// Apply inline code formatting
export function toggleInlineCode(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  return wrapSelection(content, selectionStart, selectionEnd, '`');
}

// Apply code block formatting
export function insertCodeBlock(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  language: string = ''
): FormattingResult {
  const selectedText = content.substring(selectionStart, selectionEnd);

  // Check if we need line feeds before/after to separate from surrounding text
  const charBefore = selectionStart > 0 ? content[selectionStart - 1] : '\n';
  const charAfter = selectionEnd < content.length ? content[selectionEnd] : '\n';

  // Add newline before if not at start of line
  const needsNewlineBefore = charBefore !== '\n' && selectionStart > 0;
  // Add newline after if not at end of line or end of content
  const needsNewlineAfter = charAfter !== '\n' && selectionEnd < content.length;

  const prefix = needsNewlineBefore ? '\n' : '';
  const suffix = needsNewlineAfter ? '\n' : '';
  const codeBlock = `${prefix}\`\`\`${language}\n${selectedText}\n\`\`\`${suffix}`;

  const newContent =
    content.substring(0, selectionStart) + codeBlock + content.substring(selectionEnd);

  // Position cursor after the language identifier (accounting for prefix)
  const cursorPos = selectionStart + prefix.length + 3 + language.length + 1;

  return {
    newContent,
    newSelectionStart: cursorPos,
    newSelectionEnd: cursorPos + selectedText.length,
  };
}

// Smart code formatting - inline for single line, block for multiple lines
export function toggleCode(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  language: string = ''
): FormattingResult {
  const selectedText = content.substring(selectionStart, selectionEnd);
  const hasNewlines = selectedText.includes('\n');

  if (hasNewlines || selectedText.length === 0) {
    return insertCodeBlock(content, selectionStart, selectionEnd, language);
  } else {
    return toggleInlineCode(content, selectionStart, selectionEnd);
  }
}

// Detect if text looks like a URL or file path
export function looksLikeUrl(text: string): boolean {
  const urlPattern = /^(https?:\/\/|ftp:\/\/|mailto:|www\.|\/|\.\/|\.\.\/|[a-zA-Z]:\\)/i;
  return urlPattern.test(text.trim());
}

// Interface for existing link data
export interface ExistingLinkData {
  fullMatch: string;
  text: string;
  url: string;
  title?: string;
  start: number;
  end: number;
}

// Find if cursor/selection is within or at an existing markdown link
export function findExistingLink(
  content: string,
  selectionStart: number,
  selectionEnd: number
): ExistingLinkData | null {
  // Pattern to match markdown links: [text](url) or [text](url "title")
  const linkPattern = /\[([^\]]*)\]\(([^)"]+)(?:\s+"([^"]*)")?\)/g;

  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Check if selection overlaps with this link
    if (
      (selectionStart >= matchStart && selectionStart <= matchEnd) ||
      (selectionEnd >= matchStart && selectionEnd <= matchEnd) ||
      (selectionStart <= matchStart && selectionEnd >= matchEnd)
    ) {
      return {
        fullMatch: match[0],
        text: match[1],
        url: match[2],
        title: match[3],
        start: matchStart,
        end: matchEnd,
      };
    }
  }

  return null;
}

// Insert link
export function insertLink(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  url: string,
  title?: string
): FormattingResult {
  const selectedText = content.substring(selectionStart, selectionEnd);
  const linkText = selectedText || 'link text';
  const titlePart = title ? ` "${title}"` : '';
  const link = `[${linkText}](${url}${titlePart})`;

  const newContent =
    content.substring(0, selectionStart) + link + content.substring(selectionEnd);

  return {
    newContent,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionStart + link.length,
  };
}

// Insert image
export function insertImage(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  url: string,
  altText: string = 'image'
): FormattingResult {
  const image = `![${altText}](${url})`;
  const before = content.substring(0, selectionStart);
  const after = content.substring(selectionEnd);

  // Determine what prefix we need (ensure blank line before for block rendering)
  let prefix = '';
  if (before.length > 0) {
    const lastTwoChars = before.slice(-2);
    if (lastTwoChars === '\n\n') {
      // Already has blank line
      prefix = '';
    } else if (before.endsWith('\n')) {
      // Has one newline, add another for blank line
      prefix = '\n';
    } else {
      // No newline, add two for blank line
      prefix = '\n\n';
    }
  }

  // Determine what suffix we need (ensure blank line after for block rendering)
  let suffix = '';
  if (after.length > 0) {
    const firstTwoChars = after.slice(0, 2);
    if (firstTwoChars === '\n\n') {
      // Already has blank line
      suffix = '';
    } else if (after.startsWith('\n')) {
      // Has one newline, add another for blank line
      suffix = '\n';
    } else {
      // No newline, add two for blank line
      suffix = '\n\n';
    }
  }

  const insertion = prefix + image + suffix;
  const newContent = before + insertion + after;
  const imageStart = selectionStart + prefix.length;
  const imageEnd = imageStart + image.length;

  return {
    newContent,
    newSelectionStart: imageStart,
    newSelectionEnd: imageEnd,
  };
}

// Set heading level (0 = paragraph, 1-6 = heading levels)
export function setHeadingLevel(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  level: number
): FormattingResult {
  const lineRange = getLineRange(content, selectionStart);
  const line = content.substring(lineRange.start, lineRange.end);

  // Remove existing heading prefix
  const cleanLine = line.replace(/^#{1,6}\s*/, '');

  // Add new heading prefix
  const prefix = level > 0 ? '#'.repeat(level) + ' ' : '';
  const newLine = prefix + cleanLine;

  const newContent =
    content.substring(0, lineRange.start) + newLine + content.substring(lineRange.end);

  const lengthDiff = newLine.length - line.length;

  return {
    newContent,
    newSelectionStart: selectionStart + lengthDiff,
    newSelectionEnd: selectionEnd + lengthDiff,
  };
}

// Get current heading level of the line at cursor position
export function getCurrentHeadingLevel(content: string, position: number): number {
  const lineRange = getLineRange(content, position);
  const line = content.substring(lineRange.start, lineRange.end);

  const match = line.match(/^(#{1,6})\s/);
  return match ? match[1].length : 0;
}

// Toggle blockquote on selected lines
export function toggleBlockquote(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  const linesRange = getSelectedLines(content, selectionStart, selectionEnd);
  const linesText = content.substring(linesRange.start, linesRange.end);
  const lines = linesText.split('\n');

  // Check if all lines are already quoted
  const allQuoted = lines.every((line) => line.startsWith('> ') || line.startsWith('>'));

  let newLines: string[];
  if (allQuoted) {
    // Remove quotes
    newLines = lines.map((line) => {
      if (line.startsWith('> ')) return line.substring(2);
      if (line.startsWith('>')) return line.substring(1);
      return line;
    });
  } else {
    // Add quotes
    newLines = lines.map((line) => '> ' + line);
  }

  const newLinesText = newLines.join('\n');
  const newContent =
    content.substring(0, linesRange.start) + newLinesText + content.substring(linesRange.end);

  const lengthDiff = newLinesText.length - linesText.length;

  return {
    newContent,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionEnd + lengthDiff,
  };
}

// Toggle unordered list on selected lines
export function toggleUnorderedList(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  const linesRange = getSelectedLines(content, selectionStart, selectionEnd);
  const linesText = content.substring(linesRange.start, linesRange.end);
  const lines = linesText.split('\n');

  // Check if all lines are already list items
  const allListed = lines.every(
    (line) => line.match(/^[-*+]\s/) || line.trim() === ''
  );

  let newLines: string[];
  if (allListed) {
    // Remove list markers
    newLines = lines.map((line) => {
      const match = line.match(/^[-*+]\s(.*)$/);
      return match ? match[1] : line;
    });
  } else {
    // Add list markers
    newLines = lines.map((line) => {
      if (line.trim() === '') return line;
      // Remove any existing list/number prefix
      const cleanLine = line.replace(/^(\d+\.\s|[-*+]\s)/, '');
      return '- ' + cleanLine;
    });
  }

  const newLinesText = newLines.join('\n');
  const newContent =
    content.substring(0, linesRange.start) + newLinesText + content.substring(linesRange.end);

  const lengthDiff = newLinesText.length - linesText.length;

  return {
    newContent,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionEnd + lengthDiff,
  };
}

// Toggle ordered list on selected lines
export function toggleOrderedList(
  content: string,
  selectionStart: number,
  selectionEnd: number
): FormattingResult {
  const linesRange = getSelectedLines(content, selectionStart, selectionEnd);
  const linesText = content.substring(linesRange.start, linesRange.end);
  const lines = linesText.split('\n');

  // Check if all lines are already numbered
  const allNumbered = lines.every(
    (line) => line.match(/^\d+\.\s/) || line.trim() === ''
  );

  let newLines: string[];
  if (allNumbered) {
    // Remove numbers
    newLines = lines.map((line) => {
      const match = line.match(/^\d+\.\s(.*)$/);
      return match ? match[1] : line;
    });
  } else {
    // Add numbers
    let num = 1;
    newLines = lines.map((line) => {
      if (line.trim() === '') return line;
      // Remove any existing list/number prefix
      const cleanLine = line.replace(/^(\d+\.\s|[-*+]\s)/, '');
      return `${num++}. ${cleanLine}`;
    });
  }

  const newLinesText = newLines.join('\n');
  const newContent =
    content.substring(0, linesRange.start) + newLinesText + content.substring(linesRange.end);

  const lengthDiff = newLinesText.length - linesText.length;

  return {
    newContent,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionEnd + lengthDiff,
  };
}

// Insert horizontal rule
export function insertHorizontalRule(
  content: string,
  selectionStart: number
): FormattingResult {
  const lineRange = getLineRange(content, selectionStart);
  const hr = '\n---\n';

  const newContent =
    content.substring(0, lineRange.end) + hr + content.substring(lineRange.end);

  const newCursor = lineRange.end + hr.length;

  return {
    newContent,
    newSelectionStart: newCursor,
    newSelectionEnd: newCursor,
  };
}

// Insert table
export function insertTable(
  content: string,
  selectionStart: number,
  rows: number = 3,
  cols: number = 3
): FormattingResult {
  const header = '| ' + Array(cols).fill('Header').join(' | ') + ' |';
  const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
  const dataRow = '| ' + Array(cols).fill('Cell').join(' | ') + ' |';
  const dataRows = Array(rows - 1)
    .fill(dataRow)
    .join('\n');

  const table = `\n${header}\n${separator}\n${dataRows}\n`;

  const lineRange = getLineRange(content, selectionStart);
  const newContent =
    content.substring(0, lineRange.end) + table + content.substring(lineRange.end);

  return {
    newContent,
    newSelectionStart: lineRange.end + 3,
    newSelectionEnd: lineRange.end + 3 + 'Header'.length,
  };
}

// Common programming languages for code blocks
export const CODE_LANGUAGES = [
  { value: '', label: 'Plain text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'dockerfile', label: 'Dockerfile' },
];
