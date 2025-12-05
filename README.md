# Markdown Workbench

A modern, feature-rich file viewer and editor built with Electron and React, with excellent Markdown support.

## Features

- **Multiple File Type Support**
  - Markdown (.md, .markdown, .mdx) with rendered preview
  - Data formats (JSON, YAML, XML, CSV, TOML)
  - Web files (HTML, CSS, SCSS, Less)
  - Code (JavaScript, TypeScript, Python, SQL)
  - Shell scripts (Bash, PowerShell, Batch)
  - Config files (INI, ENV, log files, plain text)
  - All file types include syntax highlighting

- **Viewing Modes**
  - **Preview Mode**: Rendered content (Markdown only)
  - **Source Mode**: Syntax-highlighted source code
  - **Edit Mode**: Split view with live preview (Markdown) or full-width editor

- **Folder Browser**
  - Open folders and browse files in a sidebar
  - Navigate directory structures
  - Quick access to project files

- **Search & Replace**
  - Find text across all viewing modes
  - Case-sensitive and regex search options
  - Replace functionality in edit mode
  - Search state preserved when switching between modes

- **Rich Markdown Support**
  - GitHub Flavored Markdown (GFM)
  - Syntax-highlighted code blocks
  - Mermaid diagrams
  - Tables, task lists, footnotes, and more
  - Admonition blocks (note, warning, tip, etc.)
  - Math/LaTeX equations with KaTeX
  - Emoji shortcodes (:smile:, :rocket:, etc.)
  - Auto-generated Table of Contents
  - Subscript (~sub~) and superscript (^sup^)

- **Navigation**
  - Tabbed interface for multiple documents
  - Back/forward navigation history
  - Click links to open local files
  - External links open in default browser

- **Preferences**
  - General settings (auto-reload, link behavior)
  - Appearance (light, dark, or system theme)
  - File type defaults (choose View or Edit mode per file type)

- **File Management**
  - Auto-reload on external file changes
  - Unsaved changes detection
  - Save and Save As functionality

## Installation

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dpage/md-workbench.git
cd md-workbench

# Install dependencies
npm install

# Start in development mode
npm start
```

### Building

```bash
# Build for production
npm run build

# Package the application
npm run package
```

## Usage

### Opening Files

- Click the **Open** button in the toolbar
- Use **Cmd/Ctrl+O** keyboard shortcut
- Open a folder to browse files in the sidebar
- Drag and drop files onto the window
- Click links to other files within Markdown documents

### Folder Browser

- Use **File → Open Folder** to open a folder
- Browse and open files from the sidebar
- Click directories to expand/collapse them
- Use **File → Close Folder** to close the sidebar

### Viewing Modes

- **Preview**: Rendered view for Markdown files
- **Source**: Syntax-highlighted source code view
- **Edit**: Split view with editor on left, preview on right (Markdown), or full-width editor (other file types)

### Preferences

Open preferences with **Cmd+,** (macOS) or **Ctrl+,** (Windows/Linux) to configure:

- **General**: Auto-reload files, link behavior
- **Appearance**: Light, dark, or system theme
- **File Types**: Default viewing mode (View or Edit) for each file type

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Open File | Cmd+O | Ctrl+O |
| Save | Cmd+S | Ctrl+S |
| Save As | Cmd+Shift+S | Ctrl+Shift+S |
| Find | Cmd+F | Ctrl+F |
| Find & Replace | Cmd+H | Ctrl+H |
| Close Tab | Cmd+W | Ctrl+W |
| Navigate Back | Cmd+[ | Alt+Left |
| Navigate Forward | Cmd+] | Alt+Right |
| Preferences | Cmd+, | Ctrl+, |

### Search

1. Press **Cmd/Ctrl+F** to open the search bar
2. Type your search query
3. Use **Enter** or the navigation buttons to move between matches
4. Toggle **Aa** for case-sensitive search
5. Toggle **.\*** for regular expression search

In edit mode, press **Cmd/Ctrl+H** to enable find and replace.

## Development

### Project Structure

```
md-workbench/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Main entry point
│   │   └── preload.ts  # Preload script for IPC
│   ├── renderer/       # React renderer process
│   │   ├── App.tsx     # Main application component
│   │   ├── components/ # React components
│   │   ├── plugins/    # Markdown plugins
│   │   ├── utils/      # Utility functions
│   │   └── styles/     # CSS styles
│   ├── shared/         # Shared types and constants
│   │   ├── fileTypes.ts    # File type definitions
│   │   └── preferences.ts  # Preferences types
│   └── test/           # Test files
├── dist/               # Build output
└── package.json
```

### Scripts

- `npm start` - Start in development mode
- `npm run build` - Build for production
- `npm run build:main` - Build main process only
- `npm run build:renderer` - Build renderer process only
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run package` - Package the application

## License

This project is licensed under the PostgreSQL License. See the [LICENSE.md](LICENSE.md) file for details.

## Author

Dave Page
