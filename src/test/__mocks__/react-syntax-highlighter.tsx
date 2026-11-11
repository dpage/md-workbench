//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Mock for react-syntax-highlighter
import React from 'react';

export const Prism: React.FC<{
  children: string;
  language?: string;
  style?: object;
  PreTag?: string;
  customStyle?: React.CSSProperties;
}> = ({ children, language, PreTag = 'pre' }) => {
  const Tag = PreTag as keyof React.JSX.IntrinsicElements;
  return (
    <Tag data-testid="syntax-highlighter" data-language={language}>
      <code>{children}</code>
    </Tag>
  );
};

export const Light = Prism;
export default Prism;
