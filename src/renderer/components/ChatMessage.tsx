//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import type { ChatMessage, ToolCall } from '../../shared/chatTypes';

interface ChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  showToolUsage?: boolean;
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  isStreaming,
  showToolUsage = false,
}) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  // Format tool call for display
  const formatToolCall = (toolCall: ToolCall) => {
    return (
      <div key={toolCall.id} className="chat-tool-call">
        <div className="chat-tool-call-header">
          <span className="chat-tool-call-icon">&#9881;</span>
          <span className="chat-tool-call-name">{toolCall.name}</span>
        </div>
        <pre className="chat-tool-call-args">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </div>
    );
  };

  // Custom components for ReactMarkdown - use shared CodeBlock
  const components = {
    code: CodeBlock,
  };

  return (
    <div
      className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-assistant'} ${isTool ? 'chat-message-tool' : ''} ${isStreaming ? 'chat-message-streaming' : ''}`}
    >
      <div className="chat-message-header">
        <span className="chat-message-role">
          {isUser ? 'You' : isTool ? 'Tool Result' : 'Assistant'}
        </span>
        {!isStreaming && (
          <span className="chat-message-time">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
      <div className="chat-message-content">
        {isUser ? (
          <p>{message.content}</p>
        ) : isTool ? (
          <div className="chat-tool-result">
            <pre className="chat-tool-result-content">{message.content}</pre>
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {showToolUsage && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="chat-tool-calls">
            {message.toolCalls.map(formatToolCall)}
          </div>
        )}
      </div>
      {isStreaming && <span className="chat-cursor">|</span>}
    </div>
  );
};

export default ChatMessageComponent;
