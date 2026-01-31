//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState } from 'react';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'help' | 'markdown'>('help');

  return (
    <>
      {/* Overlay */}
      <div
        className={`help-panel-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`help-panel ${isOpen ? 'open' : ''}`}>
        <div className="help-panel-header">
          <div className="help-panel-tabs">
            <button
              className={`help-panel-tab ${activeTab === 'help' ? 'active' : ''}`}
              onClick={() => setActiveTab('help')}
            >
              Help
            </button>
            <button
              className={`help-panel-tab ${activeTab === 'markdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('markdown')}
            >
              Markdown Primer
            </button>
          </div>
          <button
            className="help-panel-close"
            onClick={onClose}
            title="Close"
            aria-label="Close help panel"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="help-panel-content">
          {activeTab === 'help' ? <HelpContent /> : <MarkdownPrimer />}
        </div>
      </div>
    </>
  );
};

const HelpContent: React.FC = () => (
  <div className="help-content">
    <h1>Markdown Workbench</h1>
    <p className="help-intro">
      A modern, feature-rich file viewer and editor with excellent Markdown support.
    </p>

    <section>
      <h2>Supported File Types</h2>
      <p>View and edit many common file types with syntax highlighting:</p>
      <ul>
        <li><strong>Markdown</strong> — .md, .markdown, .mdx (with rendered preview)</li>
        <li><strong>Data formats</strong> — JSON, YAML, XML, CSV, TOML</li>
        <li><strong>Web</strong> — HTML, CSS, SCSS, Less</li>
        <li><strong>Code</strong> — JavaScript, TypeScript, Python, SQL</li>
        <li><strong>Shell</strong> — Bash, PowerShell, Batch files</li>
        <li><strong>Config</strong> — INI, ENV, log files, plain text</li>
      </ul>
    </section>

    <section>
      <h2>Opening Files</h2>
      <ul>
        <li>Click the <strong>Open</strong> button in the toolbar</li>
        <li>Use <kbd>Cmd+O</kbd> (macOS) or <kbd>Ctrl+O</kbd> (Windows/Linux)</li>
        <li>Open a folder to browse files in the sidebar</li>
        <li>Drag and drop files onto the window</li>
        <li>Click links to other files within Markdown documents</li>
      </ul>
    </section>

    <section>
      <h2>Folder Browser</h2>
      <ul>
        <li>Use <strong>File → Open Folder</strong> to open a folder</li>
        <li>Browse and open files from the sidebar</li>
        <li>Expand/collapse directories by clicking</li>
        <li>Use <strong>File → Close Folder</strong> to close the sidebar</li>
      </ul>
    </section>

    <section>
      <h2>Viewing Modes</h2>
      <p>Switch between viewing modes using the toolbar buttons:</p>
      <ul>
        <li>
          <strong>Preview</strong> (Markdown only) — Rendered content with full styling,
          syntax highlighting, and diagram support
        </li>
        <li>
          <strong>Source</strong> — View the source with syntax highlighting
        </li>
        <li>
          <strong>Edit</strong> — Split view with an editor on the left and live
          preview on the right (for Markdown), or full-width editor (for other files)
        </li>
      </ul>
    </section>

    <section>
      <h2>Search &amp; Replace</h2>
      <ul>
        <li>Press <kbd>Cmd+F</kbd> / <kbd>Ctrl+F</kbd> to open search</li>
        <li>Press <kbd>Cmd+H</kbd> / <kbd>Ctrl+H</kbd> for find and replace (Edit mode only)</li>
        <li>Use <kbd>Enter</kbd> or the arrow buttons to navigate between matches</li>
        <li>Toggle <strong>Aa</strong> for case-sensitive search</li>
        <li>Toggle <strong>.*</strong> for regular expression search</li>
      </ul>
      <p>Search state is preserved when switching between viewing modes.</p>
    </section>

    <section>
      <h2>Navigation</h2>
      <ul>
        <li>Use tabs to switch between open documents</li>
        <li>Use <kbd>Cmd+[</kbd> / <kbd>Alt+Left</kbd> to go back</li>
        <li>Use <kbd>Cmd+]</kbd> / <kbd>Alt+Right</kbd> to go forward</li>
        <li>Click links to navigate to other markdown files</li>
        <li>External links open in your default browser</li>
      </ul>
    </section>

    <section>
      <h2>Editing</h2>
      <ul>
        <li>Press <kbd>Cmd+N</kbd> / <kbd>Ctrl+N</kbd> to create a new file</li>
        <li>Press <kbd>Cmd+S</kbd> / <kbd>Ctrl+S</kbd> to save</li>
        <li>Press <kbd>Cmd+Shift+S</kbd> / <kbd>Ctrl+Shift+S</kbd> to save as</li>
        <li>New files prompt for a save location on first save</li>
        <li>Unsaved changes are indicated with a dot on the tab</li>
        <li>You'll be prompted to save when closing a tab with unsaved changes</li>
        <li>Enable auto-save in Preferences to save automatically after typing</li>
      </ul>
    </section>

    <section>
      <h2>Formatting Shortcuts</h2>
      <p>When text is selected, typing formatting characters wraps the selection instead of replacing it:</p>
      <table className="help-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Result</th>
            <th>Markdown</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><kbd>*</kbd></td>
            <td>Italic</td>
            <td><code>*text*</code></td>
          </tr>
          <tr>
            <td><kbd>*</kbd><kbd>*</kbd></td>
            <td>Bold</td>
            <td><code>**text**</code></td>
          </tr>
          <tr>
            <td><kbd>_</kbd></td>
            <td>Italic (alt)</td>
            <td><code>_text_</code></td>
          </tr>
          <tr>
            <td><kbd>~</kbd><kbd>~</kbd></td>
            <td>Strikethrough</td>
            <td><code>~~text~~</code></td>
          </tr>
          <tr>
            <td><kbd>`</kbd></td>
            <td>Inline code</td>
            <td><code>`text`</code></td>
          </tr>
          <tr>
            <td><kbd>`</kbd><kbd>`</kbd><kbd>`</kbd></td>
            <td>Code block</td>
            <td><code>```text```</code></td>
          </tr>
        </tbody>
      </table>
      <p>Multi-character shortcuts (**, ~~, ```) must be typed within 500ms. This feature can be disabled in Preferences → Editor.</p>
    </section>

    <section>
      <h2>Code Formatting</h2>
      <p>Format your code automatically:</p>
      <ul>
        <li>Press <kbd>Shift+Alt+F</kbd> to format the document</li>
        <li>Click the <strong>Format</strong> button in the editor toolbar</li>
        <li>Enable <strong>Format on save</strong> in Preferences → Formatting</li>
      </ul>
      <p>Supported file types:</p>
      <ul>
        <li><strong>JSON</strong> — Pretty-print with optional key sorting</li>
        <li><strong>YAML</strong> — Consistent formatting with proper indentation</li>
        <li><strong>SQL</strong> — Format with dialect-specific rules</li>
        <li><strong>JavaScript/TypeScript</strong> — Prettier-based formatting</li>
        <li><strong>CSS/SCSS/Less</strong> — Prettier-based formatting</li>
        <li><strong>HTML/XML</strong> — Prettier-based formatting</li>
        <li><strong>Markdown</strong> — Prettier-based with prose wrapping</li>
      </ul>
    </section>

    <section>
      <h2>Keyboard Shortcuts</h2>
      <table className="help-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>macOS</th>
            <th>Windows/Linux</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>New File</td>
            <td><kbd>Cmd+N</kbd></td>
            <td><kbd>Ctrl+N</kbd></td>
          </tr>
          <tr>
            <td>Open File</td>
            <td><kbd>Cmd+O</kbd></td>
            <td><kbd>Ctrl+O</kbd></td>
          </tr>
          <tr>
            <td>Save</td>
            <td><kbd>Cmd+S</kbd></td>
            <td><kbd>Ctrl+S</kbd></td>
          </tr>
          <tr>
            <td>Save As</td>
            <td><kbd>Cmd+Shift+S</kbd></td>
            <td><kbd>Ctrl+Shift+S</kbd></td>
          </tr>
          <tr>
            <td>Find</td>
            <td><kbd>Cmd+F</kbd></td>
            <td><kbd>Ctrl+F</kbd></td>
          </tr>
          <tr>
            <td>Find &amp; Replace</td>
            <td><kbd>Cmd+H</kbd></td>
            <td><kbd>Ctrl+H</kbd></td>
          </tr>
          <tr>
            <td>Format Document</td>
            <td><kbd>Shift+Alt+F</kbd></td>
            <td><kbd>Shift+Alt+F</kbd></td>
          </tr>
          <tr>
            <td>Close Tab</td>
            <td><kbd>Cmd+W</kbd></td>
            <td><kbd>Ctrl+W</kbd></td>
          </tr>
          <tr>
            <td>Navigate Back</td>
            <td><kbd>Cmd+[</kbd></td>
            <td><kbd>Alt+Left</kbd></td>
          </tr>
          <tr>
            <td>Navigate Forward</td>
            <td><kbd>Cmd+]</kbd></td>
            <td><kbd>Alt+Right</kbd></td>
          </tr>
          <tr>
            <td>Preferences</td>
            <td><kbd>Cmd+,</kbd></td>
            <td><kbd>Ctrl+,</kbd></td>
          </tr>
          <tr>
            <td>Open Folder</td>
            <td><kbd>Cmd+Shift+O</kbd></td>
            <td><kbd>Ctrl+Shift+O</kbd></td>
          </tr>
          <tr>
            <td>Preview Mode</td>
            <td><kbd>Cmd+1</kbd></td>
            <td><kbd>Ctrl+1</kbd></td>
          </tr>
          <tr>
            <td>Edit Mode</td>
            <td><kbd>Cmd+2</kbd></td>
            <td><kbd>Ctrl+2</kbd></td>
          </tr>
          <tr>
            <td>Split Mode</td>
            <td><kbd>Cmd+3</kbd></td>
            <td><kbd>Ctrl+3</kbd></td>
          </tr>
          <tr>
            <td>Zoom In</td>
            <td><kbd>Cmd+=</kbd></td>
            <td><kbd>Ctrl+=</kbd></td>
          </tr>
          <tr>
            <td>Zoom Out</td>
            <td><kbd>Cmd+-</kbd></td>
            <td><kbd>Ctrl+-</kbd></td>
          </tr>
          <tr>
            <td>Reset Zoom</td>
            <td><kbd>Cmd+0</kbd></td>
            <td><kbd>Ctrl+0</kbd></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>AI Chat Assistant</h2>
      <p>
        Markdown Workbench includes a built-in AI chat assistant that can read, analyse,
        and optionally edit your documents. Click the chat button in the bottom-right corner
        to open the chat panel.
      </p>
      <ul>
        <li><strong>Context-aware</strong> — The AI can read the current file content and any selected text</li>
        <li><strong>Per-file conversations</strong> — Chat history is saved separately for each file</li>
        <li><strong>Allow edits</strong> — Enable the &quot;Allow edits&quot; toggle in the chat panel to let the AI make changes to your document via find-and-replace</li>
        <li><strong>Clear conversation</strong> — Use the clear button in the chat header to reset the conversation for the current file</li>
      </ul>
      <h3>Supported AI Providers</h3>
      <p>Configure your preferred provider in <strong>Preferences → AI</strong>:</p>
      <ul>
        <li><strong>Anthropic (Claude)</strong> — Requires an API key file</li>
        <li><strong>OpenAI</strong> — Requires an API key file</li>
        <li><strong>Google Gemini</strong> — Requires an API key file</li>
        <li><strong>Ollama</strong> — Connect to a local Ollama instance</li>
        <li><strong>Docker Model Runner</strong> — Connect to Docker Model Runner</li>
      </ul>
      <p>Use the <strong>Test Connection</strong> button in AI preferences to verify your setup.</p>
    </section>

    <section>
      <h2>Status Bar</h2>
      <p>The status bar at the bottom of the window shows information about the current file. Some elements are interactive:</p>
      <ul>
        <li><strong>File path</strong> — Full path of the current file</li>
        <li><strong>Cursor position</strong> — Shows &quot;Ln X, Col Y&quot;; click to go to a specific line</li>
        <li><strong>Line count</strong> — Total number of lines; click to go to a specific line</li>
        <li><strong>Line endings</strong> — Shows LF or CRLF; click to change</li>
        <li><strong>File type</strong> — The detected file type</li>
      </ul>
      <p>The status bar can be toggled in <strong>Preferences → Editor</strong>.</p>
    </section>

    <section>
      <h2>Preferences</h2>
      <p>Open preferences with <kbd>Cmd+,</kbd> (macOS) or <kbd>Ctrl+,</kbd> (Windows/Linux):</p>
      <ul>
        <li><strong>General</strong> — Auto-reload files, auto-save, link behavior</li>
        <li><strong>Appearance</strong> — Light, dark, or system theme</li>
        <li><strong>Editor</strong> — Line numbers, column ruler, current line highlight, status bar, soft wrap, formatting shortcuts</li>
        <li><strong>Markdown</strong> — Default view mode, remember view mode per file</li>
        <li><strong>File Types</strong> — Set default viewing mode (View or Edit) per file type</li>
        <li><strong>Formatting</strong> — Indent size, tabs/spaces, max line length, format on save, SQL dialect</li>
        <li><strong>AI</strong> — Provider selection, API key paths, model selection, tool usage visibility</li>
      </ul>
    </section>

    <section>
      <h2>Markdown Features</h2>
      <ul>
        <li><strong>GitHub Flavored Markdown</strong> — Tables, task lists, strikethrough, footnotes, and more</li>
        <li><strong>Syntax Highlighting</strong> — Code blocks with language-specific highlighting</li>
        <li><strong>Mermaid Diagrams</strong> — Flowcharts, sequence diagrams, and more</li>
        <li><strong>Admonitions</strong> — Note, warning, tip, and other callout blocks</li>
        <li><strong>Math/LaTeX</strong> — Inline and block math equations with KaTeX</li>
        <li><strong>Emoji Shortcodes</strong> — Use :emoji_name: syntax for emoji</li>
        <li><strong>Table of Contents</strong> — Auto-generated TOC with [TOC] marker</li>
        <li><strong>Subscript/Superscript</strong> — Use ~sub~ and ^sup^ syntax</li>
        <li><strong>Auto-reload</strong> — Files automatically refresh when changed externally</li>
        <li><strong>Dark/Light Theme</strong> — Follows your system preference or manual selection</li>
      </ul>
    </section>
  </div>
);

const MarkdownPrimer: React.FC = () => (
  <div className="help-content markdown-primer">
    <h1>Markdown Primer</h1>
    <p className="help-intro">
      A quick reference for Markdown syntax supported in this application.
    </p>

    <section>
      <h2>Headings</h2>
      <pre className="help-code">{`# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`}</pre>
    </section>

    <section>
      <h2>Text Formatting</h2>
      <pre className="help-code">{`**bold text**
*italic text*
***bold and italic***
~~strikethrough~~
\`inline code\``}</pre>
    </section>

    <section>
      <h2>Links &amp; Images</h2>
      <pre className="help-code">{`[Link text](https://example.com)
[Link with title](https://example.com "Title")

![Alt text](image.png)
![Alt text](image.png "Image title")`}</pre>
    </section>

    <section>
      <h2>Lists</h2>
      <pre className="help-code">{`Unordered list:
- Item 1
- Item 2
  - Nested item
  - Another nested item
- Item 3

Ordered list:
1. First item
2. Second item
3. Third item

Task list:
- [x] Completed task
- [ ] Incomplete task`}</pre>
    </section>

    <section>
      <h2>Blockquotes</h2>
      <pre className="help-code">{`> This is a blockquote.
> It can span multiple lines.
>
> > Nested blockquotes are supported.`}</pre>
    </section>

    <section>
      <h2>Code Blocks</h2>
      <pre className="help-code">{`Inline code: \`const x = 42;\`

Fenced code block with syntax highlighting:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\``}</pre>
    </section>

    <section>
      <h2>Tables</h2>
      <pre className="help-code">{`| Header 1 | Header 2 | Header 3 |
|----------|:--------:|---------:|
| Left     | Center   | Right    |
| aligned  | aligned  | aligned  |

Alignment:
- :--- Left aligned
- :---: Center aligned
- ---: Right aligned`}</pre>
    </section>

    <section>
      <h2>Horizontal Rule</h2>
      <pre className="help-code">{`---

or

***

or

___`}</pre>
    </section>

    <section>
      <h2>Admonitions</h2>
      <p>Special callout blocks for notes, warnings, etc:</p>
      <pre className="help-code">{`> [!NOTE]
> This is a note admonition.

> [!TIP]
> This is a helpful tip.

> [!IMPORTANT]
> Important information here.

> [!WARNING]
> Be careful about this.

> [!CAUTION]
> Proceed with caution.`}</pre>
      <p>Supported types: note, tip, important, warning, caution, danger, info, abstract, todo, success, question, failure, bug, example, quote</p>
    </section>

    <section>
      <h2>Mermaid Diagrams</h2>
      <p>Create diagrams using Mermaid syntax:</p>
      <pre className="help-code">{`\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
\`\`\`

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello Bob!
    Bob-->>Alice: Hi Alice!
\`\`\`

\`\`\`mermaid
pie title Pets
    "Dogs" : 386
    "Cats" : 85
    "Birds" : 15
\`\`\``}</pre>
    </section>

    <section>
      <h2>Math/LaTeX</h2>
      <p>Write mathematical equations using LaTeX syntax:</p>
      <pre className="help-code">{`Inline math: $E = mc^2$

Block math (display mode):
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$`}</pre>
    </section>

    <section>
      <h2>Footnotes</h2>
      <pre className="help-code">{`Here is a sentence with a footnote.[^1]

Another reference to a footnote.[^note]

[^1]: This is the footnote content.
[^note]: Footnotes can have any identifier.`}</pre>
    </section>

    <section>
      <h2>Emoji Shortcodes</h2>
      <pre className="help-code">{`Use emoji shortcodes:
:smile: :heart: :thumbsup: :rocket:
:warning: :bulb: :memo: :star:

Common shortcodes:
- :+1: or :thumbsup: — 👍
- :-1: or :thumbsdown: — 👎
- :heart: — ❤️
- :star: — ⭐
- :fire: — 🔥
- :bug: — 🐛`}</pre>
    </section>

    <section>
      <h2>Table of Contents</h2>
      <p>Auto-generate a table of contents from headings:</p>
      <pre className="help-code">{`Add one of these markers where you want the TOC:

[TOC]

or

[[toc]]

or

<!-- toc -->

The TOC will be generated from all headings (h1-h6).`}</pre>
    </section>

    <section>
      <h2>Subscript &amp; Superscript</h2>
      <pre className="help-code">{`Subscript: H~2~O (water)
Superscript: E = mc^2^

Examples:
- CO~2~ — Carbon dioxide
- x^2^ + y^2^ = z^2^
- H~2~SO~4~ — Sulfuric acid`}</pre>
    </section>

    <section>
      <h2>Escaping Characters</h2>
      <pre className="help-code">{`Use backslash to escape special characters:
\\* Not italic \\*
\\# Not a heading
\\[Not a link\\](url)`}</pre>
    </section>

    <section>
      <h2>HTML</h2>
      <p>Raw HTML is supported:</p>
      <pre className="help-code">{`<details>
<summary>Click to expand</summary>

Hidden content here.

</details>

<kbd>Ctrl</kbd> + <kbd>C</kbd>

<mark>Highlighted text</mark>`}</pre>
    </section>
  </div>
);

export default HelpPanel;
