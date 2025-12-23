//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  history?: string[]; // Previous user messages for up/down navigation
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  disabled,
  history = [],
}) => {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means not navigating history
  const [savedInput, setSavedInput] = useState(''); // Save current input when navigating
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasStreamingRef = useRef(isStreaming);

  // Reset history navigation when history changes (new message sent)
  useEffect(() => {
    setHistoryIndex(-1);
    setSavedInput('');
  }, [history.length]);

  // Re-focus input when streaming completes
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && !disabled) {
      // Streaming just finished - focus the input
      textareaRef.current?.focus();
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, disabled]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 150; // Max height before scrolling
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Handle send
  const handleSend = useCallback(() => {
    if (value.trim() && !isStreaming && !disabled) {
      onSend(value.trim());
      setValue('');
      setHistoryIndex(-1);
      setSavedInput('');
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [value, isStreaming, disabled, onSend]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }

      // Up arrow - navigate to older messages
      if (e.key === 'ArrowUp' && history.length > 0) {
        const textarea = textareaRef.current;
        // Only navigate if cursor is at the start or input is empty
        if (textarea && (textarea.selectionStart === 0 || value === '')) {
          e.preventDefault();

          if (historyIndex === -1) {
            // Starting to navigate - save current input
            setSavedInput(value);
            setHistoryIndex(history.length - 1);
            setValue(history[history.length - 1]);
          } else if (historyIndex > 0) {
            // Move to older message
            setHistoryIndex(historyIndex - 1);
            setValue(history[historyIndex - 1]);
          }

          // Move cursor to end after a short delay
          setTimeout(() => {
            if (textarea) {
              textarea.selectionStart = textarea.value.length;
              textarea.selectionEnd = textarea.value.length;
            }
          }, 0);
        }
      }

      // Down arrow - navigate to newer messages
      if (e.key === 'ArrowDown' && historyIndex !== -1) {
        const textarea = textareaRef.current;
        // Only navigate if cursor is at the end or input matches history
        if (textarea && (textarea.selectionEnd === value.length || value === history[historyIndex])) {
          e.preventDefault();

          if (historyIndex < history.length - 1) {
            // Move to newer message
            setHistoryIndex(historyIndex + 1);
            setValue(history[historyIndex + 1]);
          } else {
            // Back to current input
            setHistoryIndex(-1);
            setValue(savedInput);
          }

          // Move cursor to end after a short delay
          setTimeout(() => {
            if (textarea) {
              textarea.selectionStart = textarea.value.length;
              textarea.selectionEnd = textarea.value.length;
            }
          }, 0);
        }
      }
    },
    [handleSend, history, historyIndex, value, savedInput]
  );

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            // If user edits while navigating history, stay at current index but allow editing
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Loading...'
              : isStreaming
              ? 'AI is responding...'
              : 'Type a message... (↑↓ for history)'
          }
          disabled={disabled || isStreaming}
          rows={1}
        />
        {isStreaming ? (
          <button
            className="chat-stop-button"
            onClick={onStop}
            title="Stop generating"
          >
            <span className="chat-stop-icon">&#9632;</span>
          </button>
        ) : (
          <button
            className="chat-send-button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            title="Send message"
          >
            <span className="chat-send-icon">&#10148;</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
