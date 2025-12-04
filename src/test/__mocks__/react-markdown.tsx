//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React from 'react';

interface ReactMarkdownProps {
  children: string;
  remarkPlugins?: unknown[];
  components?: {
    img?: React.ComponentType<React.ImgHTMLAttributes<HTMLImageElement>>;
    code?: React.ComponentType<{ className?: string; children?: React.ReactNode }>;
    pre?: React.ComponentType<{ children?: React.ReactNode }>;
    [key: string]: unknown;
  };
}

const ReactMarkdown: React.FC<ReactMarkdownProps> = ({
  children,
  components,
}) => {
  // Simple mock that renders the markdown as basic HTML
  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];

  const ImgComponent = components?.img || 'img';

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('### ')) {
      elements.push(<h3 key={index}>{trimmedLine.slice(4)}</h3>);
    } else if (trimmedLine.startsWith('## ')) {
      elements.push(<h2 key={index}>{trimmedLine.slice(3)}</h2>);
    } else if (trimmedLine.startsWith('# ')) {
      elements.push(<h1 key={index}>{trimmedLine.slice(2)}</h1>);
    } else if (trimmedLine.startsWith('- ')) {
      elements.push(<li key={index}>{trimmedLine.slice(2)}</li>);
    } else if (trimmedLine.startsWith('`') && trimmedLine.endsWith('`')) {
      elements.push(<code key={index}>{trimmedLine.slice(1, -1)}</code>);
    } else if (trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)) {
      // Image syntax: ![alt](src)
      const match = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (match) {
        elements.push(
          <ImgComponent key={index} src={match[2]} alt={match[1]} />
        );
      }
    } else if (trimmedLine.match(/\[([^\]]+)\]\(([^)]+)\)/)) {
      // Link syntax: [text](url)
      const match = trimmedLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        elements.push(
          <a key={index} href={match[2]}>
            {match[1]}
          </a>
        );
      }
    } else if (trimmedLine) {
      elements.push(<p key={index}>{trimmedLine}</p>);
    }
  });

  return <div data-testid="markdown-content">{elements}</div>;
};

export default ReactMarkdown;
