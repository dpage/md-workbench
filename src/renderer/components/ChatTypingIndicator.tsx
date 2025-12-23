//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useEffect } from 'react';

// Fun editor-related terms that rotate while the AI is working
const THINKING_PHRASES = [
  'Thinking...',
  'Editing...',
  'Formatting...',
  'Pondering...',
  'Composing...',
  'Refining...',
  'Polishing...',
  'Crafting...',
  'Revising...',
  'Analyzing...',
  'Considering...',
  'Wordsmithing...',
  'Proofreading...',
  'Structuring...',
  'Organizing...',
];

interface ChatTypingIndicatorProps {
  isVisible: boolean;
}

const ChatTypingIndicator: React.FC<ChatTypingIndicatorProps> = ({ isVisible }) => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setPhraseIndex(0);
      return;
    }

    // Start with a random phrase
    setPhraseIndex(Math.floor(Math.random() * THINKING_PHRASES.length));

    // Rotate through phrases every 2 seconds
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="chat-typing-indicator">
      <div className="chat-typing-dots">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
      <span className="chat-typing-text">{THINKING_PHRASES[phraseIndex]}</span>
    </div>
  );
};

export default ChatTypingIndicator;
