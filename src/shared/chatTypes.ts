//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import type { AIProvider } from './aiProviders';
import type { FormattingOptions } from './preferences';

// Chat message roles
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

// Tool call structure (from AI response)
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Tool result structure (after execution)
export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// Chat message structure
export interface ChatMessage {
  id?: number; // Database ID
  role: ChatRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string; // For tool result messages
  isError?: boolean; // For tool result messages - indicates tool execution failed
  timestamp: number;
  isCompacted?: boolean;
}

// Conversation structure (from database)
export interface Conversation {
  id: number;
  filePath: string;
  createdAt: number;
  updatedAt: number;
  compactedSummary?: string;
  messages: ChatMessage[];
}

// Tool definition for providers
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// Tool context passed to tool executor
export interface ToolContext {
  filePath: string;
  fileContent: string;
  selection: SelectionInfo | null;
  onContentChange: (newContent: string) => void;
}

// Selection info from the editor or preview. A preview selection is expanded
// to the whole source lines it was rendered from.
export interface SelectionInfo {
  start: number;
  end: number;
  text: string;
  source?: 'editor' | 'preview';
}

// Chat stream request parameters
export interface ChatStreamRequest {
  requestId: string;
  filePath: string;
  fileName: string;
  message: string;
  fileContent: string;
  selection: SelectionInfo | null;
  formattingOptions: FormattingOptions;
  conversationHistory: ChatMessage[];
  allowEdits: boolean; // Explicit toggle - when true, find_and_replace tool is available
}

// Chat stream callbacks (used internally in main process)
export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  onComplete: (message: ChatMessage) => void;
  onError: (error: Error) => void;
}

// IPC event payloads
export interface ChatTokenEvent {
  requestId: string;
  token: string;
}

export interface ChatToolCallEvent {
  requestId: string;
  toolCall: ToolCall;
}

export interface ChatToolResultEvent {
  requestId: string;
  result: ToolResult;
}

export interface ChatCompleteEvent {
  requestId: string;
  message: ChatMessage;
}

export interface ChatErrorEvent {
  requestId: string;
  error: string;
}

export interface ChatContentUpdateEvent {
  requestId: string;
  newContent: string;
}

// Provider-specific message formats
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}

// Chat options for preferences
export interface ChatOptions {
  systemPrompt: string;
  contextCompactionThreshold: number;
  maxContextTokens: number;
  showChatPanel: boolean;
  showToolUsage: boolean;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a document assistant in Markdown Workbench.

Use available tools when appropriate:
- read_file_content: Read file content when you need to see it
- read_selection: Read selected text when user mentions a selection
- find_and_replace: Make edits to the document (only available when user has enabled editing)

If find_and_replace is not available, the user wants suggestions only - describe your recommended changes in text without editing.

After a successful tool call, confirm briefly. If a tool returns an error, explain it to the user and stop.

Be concise.`;

export const DEFAULT_CHAT_OPTIONS: ChatOptions = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  contextCompactionThreshold: 50,
  maxContextTokens: 8000,
  showChatPanel: false,
  showToolUsage: false,
};

// Provider capabilities for tool use
export const PROVIDER_SUPPORTS_TOOLS: Record<AIProvider, boolean> = {
  anthropic: true,
  openai: true,
  gemini: true,
  ollama: true, // Depends on model, but API supports it
  dmr: true, // OpenAI-compatible
};
