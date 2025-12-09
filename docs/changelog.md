# Changelog

All notable changes to Markdown Workbench will be documented in this file.

## [1.0.0-alpha.3] - 2025-12-09

### Changed
- **New color scheme**: Replaced amber accents with a terminal-inspired muted green (#5f9e72) for a distinctive, eye-friendly aesthetic
- **Welcome screen redesign**: Editorial design with warm, professional styling
- **Improved split divider**: Larger 16px hit area for easier grabbing, with subtle glow effect on hover
- **Toolbar visual hierarchy**: Grouped related buttons with recessed background wells for clearer organization
- **Dark mode contrast**: Improved visibility of toolbar groups and UI element separation

### Added
- **Line numbers gutter**: Optional line numbers display in the editor with current line highlighting (configurable in Preferences → Editor)
- **Folder panel resize**: Drag the panel edge to resize between 150-500px
- **Tab file type indicators**: Colored dots on tabs indicating file type (Markdown, JSON, YAML, etc.)
- **Status bar interactions**: Click cursor position or line count to go to line, click encoding/EOL to change settings
- Build script now cleans release directory before packaging for improved reliability

## [1.0.0-alpha.2] - 2025-12-08

### Changed
- **Simplified view mode UI**: Removed source view entirely. Non-markdown files now display in a read-only source viewer.
- **New view modes for Markdown files**: Preview, Edit, and Split modes replace the previous source/edit toggle.
- **Preferences redesign**: Removed "File Types" tab. Added new "Markdown" preferences tab with:
  - Default view mode selection (Preview/Edit/Split)
  - Option to remember view mode per file

### Added
- View menu items for switching modes with keyboard shortcuts (Cmd/Ctrl+1/2/3)
- Per-file view mode memory that persists across sessions
- Toolbar segmented control for view mode switching (Markdown files only)

### Removed
- Source view mode
- Per-file-type default view mode preferences

## [1.0.0-alpha.1] - 2025-12-07

### Added
- Initial alpha release
- Markdown preview with syntax highlighting
- Split editor with side-by-side editing and preview
- Code formatting support for Markdown, JSON, YAML, XML, SQL, JavaScript, TypeScript, CSS, and HTML
- Preferences panel with customizable settings:
  - Auto-reload on external file changes
  - Auto-save functionality
  - Theme selection (Light/Dark/System)
  - Editor options (column ruler, line highlighting, status bar)
  - Formatting options (indentation, line length, etc.)
- Tab-based file management with context menu
- Folder browser panel
- File search with regex support
- Find and replace in edit mode
- Navigation history (back/forward)
- Keyboard shortcuts throughout
- Status bar showing file info, cursor position, and encoding
- Mac App Store provisioning configuration
- Welcome screen with Open File and Open Folder buttons
