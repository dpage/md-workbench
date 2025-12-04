//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useLayoutEffect,
  useCallback,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkAdmonitions, {
  AdmonitionType,
  preprocessAdmonitions,
} from '../plugins/remarkAdmonitions';

interface ScrollPosition {
  top: number;
  left: number;
}

export interface SearchHighlightOptions {
  query: string;
  caseSensitive: boolean;
  useRegex: boolean;
}

interface MarkdownViewerProps {
  content: string;
  fileName: string;
  filePath: string;
  initialScrollPosition?: ScrollPosition;
  onScrollChange?: (position: ScrollPosition) => void;
  searchHighlight?: SearchHighlightOptions;
  currentMatchIndex?: number;
}

// Initialize mermaid with theme detection
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

// Preprocess indented code fences (4+ spaces) to be recognized by the parser
// CommonMark only allows 0-3 spaces of indentation for code fences
// We reduce the fence indentation but add a marker class for CSS styling
function preprocessIndentedCodeFences(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let inIndentedCodeBlock = false;
  let codeBlockIndent = 0;

  for (const line of lines) {
    // Check for opening code fence with 4+ spaces indentation
    const openMatch = line.match(/^(\s{4,})(```|~~~)(\w*)\s*$/);
    if (!inCodeBlock && openMatch) {
      inCodeBlock = true;
      inIndentedCodeBlock = true;
      codeBlockIndent = openMatch[1].length;
      // Add marker div for CSS, then the code fence with reduced indentation
      result.push('<div class="indented-code-block">');
      result.push('');
      result.push(openMatch[2] + openMatch[3]);
      continue;
    }

    // Check for opening code fence with 0-3 spaces (normal)
    const normalOpenMatch = line.match(/^(\s{0,3})(```|~~~)(\w*)\s*$/);
    if (!inCodeBlock && normalOpenMatch) {
      inCodeBlock = true;
      inIndentedCodeBlock = false;
      result.push(line);
      continue;
    }

    // Check for closing code fence
    if (inCodeBlock) {
      const closeMatch = line.match(/^(\s*)(```|~~~)\s*$/);
      if (closeMatch) {
        inCodeBlock = false;
        if (inIndentedCodeBlock) {
          result.push(closeMatch[2]);
          result.push('');
          result.push('</div>');
          inIndentedCodeBlock = false;
        } else {
          result.push(line);
        }
        codeBlockIndent = 0;
        continue;
      }
      // For indented code blocks, remove the extra indentation
      if (inIndentedCodeBlock && line.startsWith(' '.repeat(codeBlockIndent))) {
        result.push(line.slice(codeBlockIndent));
      } else {
        result.push(line);
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

// Helper to resolve image paths relative to the markdown file
function resolveImagePath(src: string, filePath: string): string {
  // Keep absolute URLs and data URLs as-is
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:')
  ) {
    return src;
  }

  // Get the directory of the markdown file
  const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));

  let absolutePath: string;

  // Handle absolute paths
  if (src.startsWith('/')) {
    absolutePath = src;
  } else {
    // Resolve relative path
    absolutePath = `${fileDir}/${src}`;
  }

  // Use custom protocol for local files (Electron blocks file://)
  return `local-file://${encodeURIComponent(absolutePath)}`;
}

// Helper to resolve link paths relative to the markdown file
function resolveLinkPath(href: string, filePath: string): string {
  // Keep absolute URLs as-is
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  // Handle anchor links
  if (href.startsWith('#')) {
    return href;
  }

  // Get the directory of the markdown file
  const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));

  // Handle absolute paths
  if (href.startsWith('/')) {
    return href;
  }

  // Resolve relative path
  return `${fileDir}/${href}`;
}

// Check if a path is a markdown file
function isMarkdownFile(path: string): boolean {
  const lower = path.toLowerCase();
  // Remove any hash or query string for file extension check
  const pathWithoutHash = lower.split('#')[0].split('?')[0];
  return (
    pathWithoutHash.endsWith('.md') ||
    pathWithoutHash.endsWith('.markdown') ||
    pathWithoutHash.endsWith('.txt')
  );
}

// Mermaid diagram component
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        // Update theme based on current data-theme attribute
        const theme =
          document.documentElement.getAttribute('data-theme') === 'light'
            ? 'default'
            : 'dark';
        mermaid.initialize({
          startOnLoad: false,
          theme,
          securityLevel: 'loose',
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className="mermaid-error">
        <pre>{chart}</pre>
        <div className="error-message">Mermaid error: {error}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// Custom code block component with syntax highlighting
const CodeBlock: React.FC<{
  className?: string;
  children?: React.ReactNode;
  node?: { position?: { start?: { line?: number } } };
}> = ({ className, children, node }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  // Check if this is inline code (no language class and single line without newlines)
  const isInline = !className && !String(children).includes('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Render inline code simply
  if (isInline) {
    return <code className="inline-code">{children}</code>;
  }

  if (language === 'mermaid') {
    return <MermaidDiagram chart={code} />;
  }

  // Detect theme from DOM
  const isDarkTheme =
    document.documentElement.getAttribute('data-theme') !== 'light';
  const style = isDarkTheme ? oneDark : oneLight;

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {language && <span className="code-block-language">{language}</span>}
        <button
          className="code-block-copy"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
            </svg>
          )}
        </button>
      </div>
      <div className="syntax-highlighted">
        <SyntaxHighlighter
          style={style}
          language={language || undefined}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1em',
            borderRadius: '0 0 6px 6px',
            fontSize: '0.875rem',
            background: 'transparent',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

// Admonition icons - using simple SVG icons
const admonitionIcons: Record<AdmonitionType, React.ReactNode> = {
  note: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  ),
  tip: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ),
  important: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  ),
  caution: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  ),
  abstract: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0Z" />
    </svg>
  ),
  question: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67c.169-.339.436-.701.849-.977C6.845 4.16 7.369 4 8 4a2.756 2.756 0 0 1 1.637.525c.503.377.863.965.863 1.725 0 .448-.115.83-.329 1.15-.205.307-.47.513-.692.662-.109.072-.22.138-.313.195l-.006.004a6.24 6.24 0 0 0-.26.16.952.952 0 0 0-.276.245.75.75 0 0 1-1.248-.832c.184-.264.42-.489.692-.661.103-.067.207-.132.313-.195l.007-.004c.1-.061.182-.11.258-.161a.969.969 0 0 0 .277-.245C8.96 6.514 9 6.427 9 6.25a.612.612 0 0 0-.262-.525A1.27 1.27 0 0 0 8 5.5c-.369 0-.595.09-.74.187a1.01 1.01 0 0 0-.34.398ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  ),
  example: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v12.5A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25ZM4.75 4h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5ZM4 7.75A.75.75 0 0 1 4.75 7h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 4 7.75Zm0 3a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M1.75 2.5h10.5a.25.25 0 0 1 .25.25v10.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25V2.75a.25.25 0 0 1 .25-.25Zm10.5-1.5H1.75A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h10.5A1.75 1.75 0 0 0 14 13.25V2.75A1.75 1.75 0 0 0 12.25 1ZM3.5 4a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5Zm.5 2.5a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1ZM3.5 10a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5Z" />
    </svg>
  ),
  bug: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M4.72.22a.75.75 0 0 1 1.06 0l1 .999a3.488 3.488 0 0 1 2.441 0l.999-1a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.775.776c.616.63.995 1.493.995 2.444v.327c0 .1-.009.197-.025.292.408.14.764.392 1.029.722l1.968-.787a.75.75 0 0 1 .556 1.392L13 7.258V9h2.25a.75.75 0 0 1 0 1.5H13v.5c0 .409-.049.806-.141 1.186l2.17.868a.75.75 0 0 1-.557 1.392l-2.184-.873A4.997 4.997 0 0 1 8 16a4.997 4.997 0 0 1-4.288-2.427l-2.183.873a.75.75 0 0 1-.558-1.392l2.17-.868A5.036 5.036 0 0 1 3 11v-.5H.75a.75.75 0 0 1 0-1.5H3V7.258L.971 6.446a.75.75 0 0 1 .558-1.392l1.967.787c.265-.33.62-.583 1.03-.722a1.677 1.677 0 0 1-.026-.292V4.5c0-.951.38-1.814.995-2.444L4.72 1.28a.75.75 0 0 1 0-1.06Zm.53 6.28a.75.75 0 0 0-.75.75V11a3.5 3.5 0 1 0 7 0V7.25a.75.75 0 0 0-.75-.75ZM6.173 5h3.654A.172.172 0 0 0 10 4.827V4.5a2 2 0 1 0-4 0v.327c0 .096.077.173.173.173Z" />
    </svg>
  ),
  failure: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z" />
    </svg>
  ),
};

// Default admonition titles
const admonitionTitles: Record<AdmonitionType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
  danger: 'Danger',
  info: 'Info',
  abstract: 'Abstract',
  success: 'Success',
  question: 'Question',
  example: 'Example',
  quote: 'Quote',
  bug: 'Bug',
  failure: 'Failure',
};

// Admonition component
const Admonition: React.FC<{
  type: AdmonitionType;
  title?: string;
  children?: React.ReactNode;
}> = ({ type, title, children }) => {
  // Use custom title if provided, otherwise use default
  const displayTitle = title || admonitionTitles[type] || 'Note';
  const icon = admonitionIcons[type] || admonitionIcons.note;

  return (
    <div className={`admonition admonition-${type}`}>
      <div className="admonition-title">
        <span className="admonition-icon">{icon}</span>
        <span>{displayTitle}</span>
      </div>
      <div className="admonition-content">{children}</div>
    </div>
  );
};

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  filePath,
  initialScrollPosition,
  onScrollChange,
  searchHighlight,
  currentMatchIndex = 0,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<ScrollPosition>(
    initialScrollPosition || { top: 0, left: 0 }
  );

  // Set initial scroll position on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && initialScrollPosition) {
      container.scrollTop = initialScrollPosition.top;
      container.scrollLeft = initialScrollPosition.left;
    }
  }, []); // Only on mount

  // Track scroll changes and report to parent
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onScrollChange) return;

    const handleScroll = () => {
      const position = {
        top: container.scrollTop,
        left: container.scrollLeft,
      };
      scrollPositionRef.current = position;
      onScrollChange(position);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onScrollChange]);

  // Handle link clicks
  const handleLinkClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();

      // Handle anchor links (scroll within page)
      if (href.startsWith('#')) {
        const element = document.getElementById(href.slice(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      // Resolve the link path
      const resolvedPath = resolveLinkPath(href, filePath);

      // External URLs - open in default browser
      if (
        resolvedPath.startsWith('http://') ||
        resolvedPath.startsWith('https://')
      ) {
        await window.electronAPI?.openExternal(resolvedPath);
        return;
      }

      // Local markdown file - open in app
      if (isMarkdownFile(resolvedPath)) {
        await window.electronAPI?.openLocalFile(resolvedPath);
        return;
      }

      // Other local files - open with system default app
      await window.electronAPI?.openExternal(`file://${resolvedPath}`);
    },
    [filePath]
  );

  // Save scroll position before content updates
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      scrollPositionRef.current = {
        top: container.scrollTop,
        left: container.scrollLeft,
      };
    }
  }, [content]);

  // Restore scroll position after content updates
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        container.scrollTop = scrollPositionRef.current.top;
        container.scrollLeft = scrollPositionRef.current.left;
      });
    }
  }, [content]);

  // Search highlighting effect
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    // Remove existing highlights
    const existingHighlights = contentEl.querySelectorAll('mark.search-highlight');
    existingHighlights.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    // Remove existing URL match indicators from links
    const existingUrlMatches = contentEl.querySelectorAll('a.search-url-match, a.search-url-match-current');
    existingUrlMatches.forEach((link) => {
      link.classList.remove('search-url-match', 'search-url-match-current');
    });

    if (!searchHighlight?.query) return;

    // Build regex for search
    let searchRegex: RegExp;
    try {
      if (searchHighlight.useRegex) {
        searchRegex = new RegExp(
          searchHighlight.query,
          searchHighlight.caseSensitive ? 'g' : 'gi'
        );
      } else {
        const escapedQuery = searchHighlight.query.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );
        searchRegex = new RegExp(
          escapedQuery,
          searchHighlight.caseSensitive ? 'g' : 'gi'
        );
      }
    } catch {
      return; // Invalid regex
    }

    // We need to collect matches in DOM order (interleaving text matches and URL matches)
    // to stay in sync with the source panel which searches raw markdown linearly

    // First, find all links with URL matches and store their positions
    const linksWithUrlMatches: Array<{ element: Element; position: number }> = [];
    const links = contentEl.querySelectorAll('a[href]');
    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      searchRegex.lastIndex = 0;
      // Count how many matches are in this URL
      let urlMatch;
      while ((urlMatch = searchRegex.exec(href)) !== null) {
        // Get approximate document position for ordering
        const rect = link.getBoundingClientRect();
        linksWithUrlMatches.push({
          element: link,
          position: rect.top * 10000 + rect.left
        });
        if (urlMatch[0].length === 0) searchRegex.lastIndex++;
      }
    });

    // Find and highlight text nodes, collecting match info
    const walker = document.createTreeWalker(
      contentEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (
            parent &&
            (parent.tagName === 'SCRIPT' ||
              parent.tagName === 'STYLE' ||
              parent.tagName === 'CODE' ||
              parent.tagName === 'PRE' ||
              parent.classList.contains('search-highlight'))
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    // Collect text nodes and their matches
    interface TextMatch {
      textNode: Text;
      start: number;
      end: number;
      text: string;
      position: number;
    }
    const textMatches: TextMatch[] = [];

    let node;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const text = textNode.textContent || '';
      let match;

      searchRegex.lastIndex = 0;
      while ((match = searchRegex.exec(text)) !== null) {
        // Get position for ordering - use parent element's position
        const parent = textNode.parentElement;
        const rect = parent?.getBoundingClientRect() || { top: 0, left: 0 };
        textMatches.push({
          textNode,
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          position: rect.top * 10000 + rect.left + match.index,
        });
        if (match[0].length === 0) searchRegex.lastIndex++;
      }
    }

    // Combine and sort all matches by position
    // In markdown [text](url), text comes before URL, so we need to preserve that order
    type MatchInfo =
      | { type: 'text'; data: TextMatch }
      | { type: 'url'; data: { element: Element; position: number } };

    const allMatches: MatchInfo[] = [
      ...textMatches.map((m) => ({ type: 'text' as const, data: m })),
      ...linksWithUrlMatches.map((m) => ({ type: 'url' as const, data: m })),
    ].sort((a, b) => {
      const posA = a.type === 'text' ? a.data.position : a.data.position;
      const posB = b.type === 'text' ? b.data.position : b.data.position;
      // Primary sort by position
      if (Math.abs(posA - posB) > 100) {
        return posA - posB;
      }
      // For matches at similar positions (same element), text matches come before URL matches
      // This preserves markdown source order: [text](url)
      if (a.type === 'text' && b.type === 'url') return -1;
      if (a.type === 'url' && b.type === 'text') return 1;
      return posA - posB;
    });

    // Now apply highlights with correct indices
    // Group text matches by text node for efficient DOM manipulation
    const textNodeMatches = new Map<Text, Array<{ start: number; end: number; text: string; globalIndex: number }>>();

    allMatches.forEach((match, globalIndex) => {
      if (match.type === 'text') {
        const existing = textNodeMatches.get(match.data.textNode) || [];
        existing.push({
          start: match.data.start,
          end: match.data.end,
          text: match.data.text,
          globalIndex,
        });
        textNodeMatches.set(match.data.textNode, existing);
      } else {
        // URL match - add class to link
        const className = globalIndex === currentMatchIndex
          ? 'search-url-match search-url-match-current'
          : 'search-url-match';
        match.data.element.classList.add(...className.split(' '));
      }
    });

    // Apply text highlights
    textNodeMatches.forEach((matches, textNode) => {
      // Sort matches within this text node by start position
      matches.sort((a, b) => a.start - b.start);

      const text = textNode.textContent || '';
      const fragment = document.createDocumentFragment();
      let lastEnd = 0;

      matches.forEach((m) => {
        if (m.start > lastEnd) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastEnd, m.start))
          );
        }

        const mark = document.createElement('mark');
        mark.className =
          m.globalIndex === currentMatchIndex
            ? 'search-highlight search-highlight-current'
            : 'search-highlight';
        mark.textContent = m.text;
        fragment.appendChild(mark);

        lastEnd = m.end;
      });

      if (lastEnd < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    // Scroll to current match (either text highlight or URL match link)
    const currentTextHighlight = contentEl.querySelector(
      'mark.search-highlight-current'
    );
    const currentUrlHighlight = contentEl.querySelector(
      'a.search-url-match-current'
    );
    const currentHighlight = currentTextHighlight || currentUrlHighlight;
    if (currentHighlight) {
      currentHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchHighlight, currentMatchIndex, content]);

  // Create components with access to filePath
  const components = useMemo(
    () => ({
      code: ({
        className,
        children,
        ...props
      }: {
        className?: string;
        children?: React.ReactNode;
      }) => {
        const isInline = !className;
        if (isInline) {
          return <code {...props}>{children}</code>;
        }
        return <CodeBlock className={className}>{children}</CodeBlock>;
      },
      pre: ({ children }: { children?: React.ReactNode }) => <pre>{children}</pre>,
      img: ({
        src,
        alt,
        ...props
      }: React.ImgHTMLAttributes<HTMLImageElement>) => {
        const resolvedSrc = src ? resolveImagePath(src, filePath) : '';
        return <img src={resolvedSrc} alt={alt || ''} {...props} />;
      },
      a: ({
        href,
        children,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
        const resolvedHref = href ? resolveLinkPath(href, filePath) : '';
        return (
          <a
            href={href || '#'}
            title={resolvedHref}
            onClick={(e) => handleLinkClick(e, href || '')}
            {...props}
          >
            {children}
          </a>
        );
      },
      // Custom admonition component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admonition: (props: any) => {
        const admonitionType = (props.admonitionType ||
          props.admonitiontype ||
          'note') as AdmonitionType;
        const title = props.title as string | undefined;
        return (
          <Admonition type={admonitionType} title={title}>
            {props.children}
          </Admonition>
        );
      },
    }),
    [filePath, handleLinkClick]
  );

  return (
    <div className="markdown-viewer" ref={scrollContainerRef}>
      <div className="markdown-content" ref={contentRef}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkAdmonitions]}
          rehypePlugins={[rehypeRaw]}
          remarkRehypeOptions={{
            handlers: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              admonition: (state: any, node: any) => {
                const result = {
                  type: 'element' as const,
                  tagName: 'admonition',
                  properties: {
                    admonitionType: node.admonitionType,
                    title: node.title || '',
                  },
                  children: state.all(node),
                };
                state.patch(node, result);
                return result;
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
          }}
          components={components}
        >
          {preprocessAdmonitions(preprocessIndentedCodeFences(content))}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownViewer;
