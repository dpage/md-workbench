//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  ChatMessage,
  Conversation,
  SelectionInfo,
  ToolDefinition,
  ChatStreamRequest,
} from '../../shared/chatTypes';
import type { Preferences } from '../../shared/preferences';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';
import ChatTypingIndicator from './ChatTypingIndicator';

// Tool definitions for file editing
// Note: Descriptions include WHEN to use each tool to guide model behavior
const EDITING_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file_content',
    description: 'Read all or part of the current file content. Use ONLY when you need to see content not already provided. Do NOT use if you already have the file content.',
    parameters: {
      type: 'object',
      properties: {
        startLine: {
          type: 'number',
          description: 'Start line (1-indexed, optional - omit to read from beginning)',
        },
        endLine: {
          type: 'number',
          description: 'End line (1-indexed, optional - omit to read to end)',
        },
      },
    },
  },
  {
    name: 'read_selection',
    description: 'Read the currently selected text in the editor or preview. Use ONLY when user mentions "selected text" or "selection".',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'find_and_replace',
    description: 'ONLY use when user explicitly asks you to MAKE changes (edit, fix, change, update, replace, delete, add). Do NOT use for: summaries, suggestions, explanations, or questions. Find exact text and replace it.',
    parameters: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'The exact text to find and replace',
        },
        replaceWith: {
          type: 'string',
          description: 'The text to replace it with (use empty string to delete)',
        },
        replaceAll: {
          type: 'boolean',
          description: 'If true, replace all occurrences; if false or omitted, replace only the first occurrence',
        },
      },
      required: ['searchText', 'replaceWith'],
    },
  },
];

interface ChatPanelProps {
  filePath: string;
  fileName: string;
  content: string;
  selection: SelectionInfo | null;
  onContentChange: (newContent: string) => void;
  preferences: Preferences;
  onClose: () => void;
  width?: number;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  filePath,
  fileName,
  content,
  selection,
  onContentChange,
  preferences,
  onClose,
  width = 350,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allowEdits, setAllowEdits] = useState(false); // Explicit edit mode toggle

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);

  // Keep content ref updated
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Scroll to bottom when messages change or streaming state changes
  const scrollToBottom = useCallback(() => {
    // Use setTimeout to ensure DOM has updated before scrolling
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, isStreaming, scrollToBottom]);

  // Load conversation when filePath changes
  useEffect(() => {
    setMessages([]);
    setStreamingContent('');
    setIsStreaming(false);
    setError(null);

    const loadConversation = async () => {
      setIsLoading(true);
      try {
        const conversation = await window.electronAPI?.chatGetConversation(filePath);
        if (conversation) {
          setMessages(conversation.messages);
        }
      } catch (err) {
        console.error('Failed to load conversation:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversation();
  }, [filePath]);

  // Set up streaming event listeners
  useEffect(() => {
    const tokenCleanup = window.electronAPI?.onChatToken((event) => {
      if (event.requestId === currentRequestId) {
        setStreamingContent((prev) => prev + event.token);
      }
    });

    const completeCleanup = window.electronAPI?.onChatComplete((event) => {
      if (event.requestId === currentRequestId) {
        setMessages((prev) => [...prev, event.message]);
        setStreamingContent('');
        setIsStreaming(false);
        setCurrentRequestId(null);

        // Save message to database
        window.electronAPI?.chatSaveMessage(filePath, event.message);
      }
    });

    const errorCleanup = window.electronAPI?.onChatError((event) => {
      if (event.requestId === currentRequestId) {
        setError(event.error);
        setStreamingContent('');
        setIsStreaming(false);
        setCurrentRequestId(null);
      }
    });

    const contentUpdateCleanup = window.electronAPI?.onChatContentUpdate((event) => {
      if (event.requestId === currentRequestId) {
        onContentChange(event.newContent);
      }
    });

    // Clear streaming content when tool call is received - prevents "vanishing text"
    const toolCallCleanup = window.electronAPI?.onChatToolCall((event) => {
      if (event.requestId === currentRequestId) {
        setStreamingContent('');
      }
    });

    // Add tool results to message history so they're included in future requests
    const toolResultCleanup = window.electronAPI?.onChatToolResult((event) => {
      if (event.requestId === currentRequestId) {
        const toolResultMessage: ChatMessage = {
          role: 'tool',
          content: event.result.content,
          toolCallId: event.result.toolCallId,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, toolResultMessage]);
        // Save to database
        window.electronAPI?.chatSaveMessage(filePath, toolResultMessage);
      }
    });

    // Add intermediate assistant messages (those with tool calls) to history
    const assistantMessageCleanup = window.electronAPI?.onChatAssistantMessage((event) => {
      if (event.requestId === currentRequestId) {
        setMessages((prev) => [...prev, event.message]);
        // Save to database
        window.electronAPI?.chatSaveMessage(filePath, event.message);
      }
    });

    return () => {
      tokenCleanup?.();
      completeCleanup?.();
      errorCleanup?.();
      contentUpdateCleanup?.();
      toolCallCleanup?.();
      toolResultCleanup?.();
      assistantMessageCleanup?.();
    };
  }, [currentRequestId, filePath, onContentChange]);

  // Send message
  const handleSend = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    // Create user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    // Add to UI and save to database
    setMessages((prev) => [...prev, userMessage]);
    await window.electronAPI?.chatSaveMessage(filePath, userMessage);

    // Generate request ID
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentRequestId(requestId);
    setIsStreaming(true);
    setStreamingContent('');
    setError(null);

    // Build request
    const request: ChatStreamRequest = {
      requestId,
      filePath,
      fileName,
      message: messageText,
      fileContent: contentRef.current,
      selection,
      formattingOptions: preferences.formatting,
      conversationHistory: [...messages, userMessage],
      allowEdits,
    };

    // Start streaming
    try {
      await window.electronAPI?.chatStreamStart(request, EDITING_TOOLS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsStreaming(false);
      setCurrentRequestId(null);
    }
  }, [isStreaming, filePath, fileName, selection, preferences.formatting, messages, allowEdits]);

  // Stop streaming
  const handleStop = useCallback(async () => {
    if (currentRequestId) {
      await window.electronAPI?.chatStreamStop(currentRequestId);
      setIsStreaming(false);
      setCurrentRequestId(null);
      setStreamingContent('');
    }
  }, [currentRequestId]);

  // Clear conversation
  const handleClear = useCallback(async () => {
    await window.electronAPI?.chatClearConversation(filePath);
    setMessages([]);
    setError(null);
  }, [filePath]);

  // Extract user message history for input navigation
  const userMessageHistory = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.content),
    [messages]
  );

  return (
    <div className="chat-panel" style={{ width: `${width}px` }}>
      <div className="chat-header">
        <span className="chat-title">AI Chat</span>
        <div className="chat-header-buttons">
          <button
            className="chat-header-button"
            onClick={handleClear}
            title="Clear conversation"
            disabled={isStreaming || messages.length === 0}
          >
            Clear
          </button>
          <button
            className="chat-header-button chat-close-button"
            onClick={onClose}
            title="Close chat"
          >
            &times;
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef}>
        {isLoading ? (
          <div className="chat-loading">Loading conversation...</div>
        ) : messages.length === 0 && !streamingContent ? (
          <div className="chat-empty">
            <p>Start a conversation to get help with your document.</p>
            <p className="chat-empty-hint">
              The AI can read and edit your file using available tools.
            </p>
          </div>
        ) : (
          <>
            {messages
              .filter((msg) => {
                const showToolUsage = preferences.chat?.showToolUsage;
                // Hide tool messages when showToolUsage is off
                if (!showToolUsage && msg.role === 'tool') return false;
                // Hide assistant messages that only have tool calls (no text) when showToolUsage is off
                if (!showToolUsage && msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && !msg.content.trim()) return false;
                return true;
              })
              .map((msg, index) => (
                <ChatMessageComponent
                  key={index}
                  message={msg}
                  showToolUsage={preferences.chat?.showToolUsage ?? false}
                />
              ))}
            {streamingContent && (
              <ChatMessageComponent
                message={{
                  role: 'assistant',
                  content: streamingContent,
                  timestamp: Date.now(),
                }}
                isStreaming
                showToolUsage={preferences.chat?.showToolUsage ?? false}
              />
            )}
            <ChatTypingIndicator isVisible={isStreaming && !streamingContent} />
          </>
        )}
        {error && (
          <div className="chat-error">
            <span className="chat-error-icon">!</span>
            <span className="chat-error-text">{error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-footer">
        <label className="chat-edit-toggle" title="When enabled, AI can make changes to the document">
          <input
            type="checkbox"
            checked={allowEdits}
            onChange={(e) => setAllowEdits(e.target.checked)}
            disabled={isStreaming}
          />
          <span>Allow edits</span>
        </label>
      </div>

      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={isLoading}
        history={userMessageHistory}
      />
    </div>
  );
};

export default ChatPanel;
