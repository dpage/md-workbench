# Markdown Workbench

A modern, feature-rich Markdown viewer and editor built with Electron and React.

## Features

- **Three Viewing Modes**
  - **Preview Mode**: Rendered markdown with full styling
  - **Source Mode**: Raw markdown with syntax highlighting
  - **Edit Mode**: Split view with live preview and synchronized scrolling

- **Search & Replace**
  - Find text across all viewing modes
  - Case-sensitive and regex search options
  - Replace functionality in edit mode
  - Search state preserved when switching between modes

- **Rich Markdown Support**
  - GitHub Flavored Markdown (GFM)
  - Syntax-highlighted code blocks
  - Mermaid diagrams
  - Tables, task lists, and more
  - Admonition blocks (note, warning, tip, etc.)

- **Navigation**
  - Tabbed interface for multiple documents
  - Back/forward navigation history
  - Click links to open local markdown files
  - External links open in default browser

- **File Management**
  - Auto-reload on external file changes
  - Unsaved changes detection
  - Save and Save As functionality

- **Appearance**
  - Dark and light theme support
  - Clean, modern interface

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
- Drag and drop markdown files onto the window
- Click links to other markdown files within documents

### Viewing Modes

- **Source**: View raw markdown source code
- **Edit**: Split view with editor on left, preview on right

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
│   │   └── styles/     # CSS styles
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
