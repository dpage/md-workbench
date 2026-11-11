//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import hljs from 'highlight.js/lib/core';
import MarkdownViewer from './MarkdownViewer';

interface PrintViewProps {
  content: string;
  fileName: string;
  filePath: string;
  isMarkdown: boolean;
  highlightLanguage?: string;
  onReady: () => void;
}

// Maximum time to wait for asynchronous rendering (e.g. Mermaid) before printing
const RENDER_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 50;

// Renders a light-themed copy of the document outside the app root, which
// the print stylesheet shows in place of the application UI.
const PrintView: React.FC<PrintViewProps> = ({
  content,
  fileName,
  filePath,
  isMarkdown,
  highlightLanguage,
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const highlightedSource = useMemo(() => {
    if (isMarkdown) return '';
    try {
      const lang =
        highlightLanguage && hljs.getLanguage(highlightLanguage)
          ? highlightLanguage
          : 'plaintext';
      return hljs.highlight(content, { language: lang }).value;
    } catch {
      return null;
    }
  }, [content, isMarkdown, highlightLanguage]);

  // Wait until every Mermaid diagram has rendered (or failed), then report ready
  useEffect(() => {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    const check = () => {
      const container = containerRef.current;
      const pending = container
        ? Array.from(container.querySelectorAll('.mermaid-diagram')).some(
            (el) => el.childElementCount === 0
          )
        : false;

      if (pending && Date.now() - started < RENDER_TIMEOUT_MS) {
        timer = setTimeout(check, POLL_INTERVAL_MS);
        return;
      }
      // Let layout settle before printing
      requestAnimationFrame(() => requestAnimationFrame(onReady));
    };

    timer = setTimeout(check, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [onReady]);

  return createPortal(
    <div className="print-container" data-theme="light" ref={containerRef}>
      {isMarkdown ? (
        <MarkdownViewer content={content} fileName={fileName} filePath={filePath} />
      ) : highlightedSource === null ? (
        <pre className="print-source">{content}</pre>
      ) : (
        <pre
          className="print-source source-viewer-highlight syntax-highlighted"
          dangerouslySetInnerHTML={{ __html: highlightedSource }}
        />
      )}
    </div>,
    document.body
  );
};

export default PrintView;
