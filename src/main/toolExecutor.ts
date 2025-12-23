//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import type { ToolCall, ToolResult, SelectionInfo } from '../shared/chatTypes';

// Context provided to tools for execution
export interface ToolContext {
  fileContent: string;
  selection: SelectionInfo | null;
  onContentUpdate: (newContent: string) => void;
}

// Execute a tool call and return the result
export function executeTool(
  toolCall: ToolCall,
  context: ToolContext
): ToolResult {
  const { name, arguments: args } = toolCall;

  // Debug: log tool invocation
  console.log(`[Tool] Executing: ${name}`);

  try {
    switch (name) {
      case 'read_file_content':
        return executeReadFileContent(args, context);
      case 'read_selection':
        return executeReadSelection(context);
      case 'insert_text':
        return executeInsertText(args, context);
      case 'replace_text':
        return executeReplaceText(args, context);
      case 'find_and_replace':
        return executeFindAndReplace(args, context);
      case 'delete_text':
        return executeDeleteText(args, context);
      default:
        console.log(`[Tool] Unknown tool called: "${name}" (type: ${typeof name})`);
        return {
          toolCallId: toolCall.id,
          content: `Unknown tool: ${name}`,
          isError: true,
        };
    }
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

// Read all or part of the file content
function executeReadFileContent(
  args: Record<string, unknown>,
  context: ToolContext
): ToolResult {
  const { fileContent } = context;
  const startLine = args.startLine as number | undefined;
  const endLine = args.endLine as number | undefined;

  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  // Validate line numbers (1-indexed)
  const start = startLine ? Math.max(1, startLine) : 1;
  const end = endLine ? Math.min(totalLines, endLine) : totalLines;

  if (start > end) {
    return {
      toolCallId: '',
      content: `Invalid line range: start (${start}) is greater than end (${end})`,
      isError: true,
    };
  }

  // Extract lines (converting from 1-indexed to 0-indexed)
  const selectedLines = lines.slice(start - 1, end);
  const content = selectedLines.map((line, i) => `${start + i}: ${line}`).join('\n');

  return {
    toolCallId: '',
    content: `Lines ${start}-${end} of ${totalLines}:\n\n${content}`,
    isError: false,
  };
}

// Read the currently selected text
function executeReadSelection(context: ToolContext): ToolResult {
  const { selection, fileContent } = context;

  if (!selection) {
    return {
      toolCallId: '',
      content: 'No text is currently selected.',
      isError: false,
    };
  }

  const selectedText = fileContent.substring(selection.start, selection.end);
  const charCount = selection.end - selection.start;

  return {
    toolCallId: '',
    content: `Selected text (${charCount} characters, positions ${selection.start}-${selection.end}):\n\n${selectedText}`,
    isError: false,
  };
}

// Insert text at a specific position
function executeInsertText(
  args: Record<string, unknown>,
  context: ToolContext
): ToolResult {
  const position = args.position as number;
  const text = args.text as string;

  if (typeof position !== 'number') {
    return {
      toolCallId: '',
      content: 'Missing or invalid position parameter',
      isError: true,
    };
  }

  if (typeof text !== 'string') {
    return {
      toolCallId: '',
      content: 'Missing or invalid text parameter',
      isError: true,
    };
  }

  const { fileContent, onContentUpdate } = context;

  // Clamp position to valid range
  const safePosition = Math.max(0, Math.min(fileContent.length, position));

  const newContent =
    fileContent.substring(0, safePosition) +
    text +
    fileContent.substring(safePosition);

  onContentUpdate(newContent);

  return {
    toolCallId: '',
    content: `SUCCESS: Inserted ${text.length} characters at position ${safePosition}. The file has been updated.`,
    isError: false,
  };
}

// Replace text in a range
function executeReplaceText(
  args: Record<string, unknown>,
  context: ToolContext
): ToolResult {
  const startPosition = args.startPosition as number;
  const endPosition = args.endPosition as number;
  const newText = args.newText as string;

  if (typeof startPosition !== 'number') {
    return {
      toolCallId: '',
      content: 'Missing or invalid startPosition parameter',
      isError: true,
    };
  }

  if (typeof endPosition !== 'number') {
    return {
      toolCallId: '',
      content: 'Missing or invalid endPosition parameter',
      isError: true,
    };
  }

  if (typeof newText !== 'string') {
    return {
      toolCallId: '',
      content: 'Missing or invalid newText parameter',
      isError: true,
    };
  }

  const { fileContent, onContentUpdate } = context;

  // Clamp positions to valid range
  const safeStart = Math.max(0, Math.min(fileContent.length, startPosition));
  const safeEnd = Math.max(safeStart, Math.min(fileContent.length, endPosition));

  const oldText = fileContent.substring(safeStart, safeEnd);
  const newContent =
    fileContent.substring(0, safeStart) +
    newText +
    fileContent.substring(safeEnd);

  onContentUpdate(newContent);

  return {
    toolCallId: '',
    content: `SUCCESS: Replaced ${oldText.length} characters (positions ${safeStart}-${safeEnd}) with ${newText.length} characters. The file has been updated.`,
    isError: false,
  };
}

// Find text and replace it (safer than position-based replacement)
function executeFindAndReplace(
  args: Record<string, unknown>,
  context: ToolContext
): ToolResult {
  const searchText = args.searchText as string;
  const replaceWith = args.replaceWith as string;
  const replaceAll = args.replaceAll as boolean | undefined;

  if (typeof searchText !== 'string' || searchText.length === 0) {
    return {
      toolCallId: '',
      content: 'Missing or invalid searchText parameter',
      isError: true,
    };
  }

  if (typeof replaceWith !== 'string') {
    return {
      toolCallId: '',
      content: 'Missing or invalid replaceWith parameter',
      isError: true,
    };
  }

  const { fileContent, onContentUpdate } = context;

  // Check if the search text exists
  const index = fileContent.indexOf(searchText);
  if (index === -1) {
    // Debug logging - concise single line
    const preview = searchText.substring(0, 40).replace(/\n/g, '\\n');
    console.log(`[Tool] find_and_replace: text not found (${searchText.length} chars): "${preview}..."`);
    return {
      toolCallId: '',
      content: `Text not found: "${searchText.substring(0, 50)}${searchText.length > 50 ? '...' : ''}"`,
      isError: true,
    };
  }

  let newContent: string;
  let replacementCount: number;

  if (replaceAll) {
    // Replace all occurrences
    const regex = new RegExp(escapeRegExp(searchText), 'g');
    const matches = fileContent.match(regex);
    replacementCount = matches ? matches.length : 0;
    newContent = fileContent.replace(regex, replaceWith);
  } else {
    // Replace first occurrence only
    replacementCount = 1;
    newContent = fileContent.replace(searchText, replaceWith);
  }

  onContentUpdate(newContent);

  const previewOld = searchText.substring(0, 30) + (searchText.length > 30 ? '...' : '');
  const previewNew = replaceWith.substring(0, 30) + (replaceWith.length > 30 ? '...' : '');

  return {
    toolCallId: '',
    content: `SUCCESS: Replaced ${replacementCount} occurrence(s) of "${previewOld}" with "${previewNew}". The file has been updated.`,
    isError: false,
  };
}

// Helper to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Delete text in a range
function executeDeleteText(
  args: Record<string, unknown>,
  context: ToolContext
): ToolResult {
  const startPosition = args.startPosition as number;
  const endPosition = args.endPosition as number;

  if (typeof startPosition !== 'number') {
    return {
      toolCallId: '',
      content: 'Missing or invalid startPosition parameter',
      isError: true,
    };
  }

  if (typeof endPosition !== 'number') {
    return {
      toolCallId: '',
      content: 'Missing or invalid endPosition parameter',
      isError: true,
    };
  }

  const { fileContent, onContentUpdate } = context;

  // Clamp positions to valid range
  const safeStart = Math.max(0, Math.min(fileContent.length, startPosition));
  const safeEnd = Math.max(safeStart, Math.min(fileContent.length, endPosition));

  const deletedText = fileContent.substring(safeStart, safeEnd);
  const newContent =
    fileContent.substring(0, safeStart) +
    fileContent.substring(safeEnd);

  onContentUpdate(newContent);

  return {
    toolCallId: '',
    content: `SUCCESS: Deleted ${deletedText.length} characters (positions ${safeStart}-${safeEnd}). The file has been updated.`,
    isError: false,
  };
}
