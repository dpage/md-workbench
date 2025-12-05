//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleCode,
  insertCodeBlock,
  insertLink,
  insertImage,
  setHeadingLevel,
  getCurrentHeadingLevel,
  toggleBlockquote,
  toggleUnorderedList,
  toggleOrderedList,
  insertHorizontalRule,
  insertTable,
  CODE_LANGUAGES,
  FormattingResult,
  findExistingLink,
  looksLikeUrl,
  ExistingLinkData,
} from '../utils/markdownFormatting';

interface FormattingToolbarProps {
  contentRef: React.RefObject<string>;
  onFormat: (result: FormattingResult) => void;
  onRequestSelection: () => { start: number; end: number; text: string };
  filePath?: string;
}

interface DropdownState {
  style: boolean;
  code: boolean;
}

interface DialogState {
  link: boolean;
  image: boolean;
  table: boolean;
}

const FormattingToolbar: React.FC<FormattingToolbarProps> = React.memo(({
  contentRef,
  onFormat,
  onRequestSelection,
  filePath,
}) => {
  const [dropdowns, setDropdowns] = useState<DropdownState>({
    style: false,
    code: false,
  });
  const [dialogs, setDialogs] = useState<DialogState>({
    link: false,
    image: false,
    table: false,
  });

  // Dialog form states
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkText, setLinkText] = useState('');
  const [editingLink, setEditingLink] = useState<ExistingLinkData | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdowns({ style: false, code: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSelection = useCallback(() => {
    return onRequestSelection();
  }, [onRequestSelection]);

  const getContent = useCallback(() => {
    return contentRef.current ?? '';
  }, [contentRef]);

  const closeAllDropdowns = useCallback(() => {
    setDropdowns({ style: false, code: false });
  }, []);

  const handleBold = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleBold(getContent(), sel.start, sel.end));
  }, [getContent, getSelection, onFormat]);

  const handleItalic = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleItalic(getContent(), sel.start, sel.end));
  }, [getContent, getSelection, onFormat]);

  const handleStrikethrough = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleStrikethrough(getContent(), sel.start, sel.end));
  }, [getContent, getSelection, onFormat]);

  const handleInlineCode = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleCode(getContent(), sel.start, sel.end, ''));
    closeAllDropdowns();
  }, [getContent, getSelection, onFormat, closeAllDropdowns]);

  const handleCodeBlock = useCallback(
    (language: string) => {
      const sel = getSelection();
      onFormat(insertCodeBlock(getContent(), sel.start, sel.end, language));
      closeAllDropdowns();
    },
    [getContent, getSelection, onFormat, closeAllDropdowns]
  );

  const handleHeading = useCallback(
    (level: number) => {
      const sel = getSelection();
      onFormat(setHeadingLevel(getContent(), sel.start, sel.end, level));
      closeAllDropdowns();
    },
    [getContent, getSelection, onFormat, closeAllDropdowns]
  );

  const handleBlockquote = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleBlockquote(getContent(), sel.start, sel.end));
  }, [getContent, getSelection, onFormat]);

  const handleUnorderedList = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleUnorderedList(getContent(), sel.start, sel.end));
  }, [getContent, getSelection, onFormat]);

  const handleOrderedList = useCallback(() => {
    const sel = getSelection();
    onFormat(toggleOrderedList(getContent(), sel.start, sel.end));
  }, [getContent, getSelection, onFormat]);

  const handleHorizontalRule = useCallback(() => {
    const sel = getSelection();
    onFormat(insertHorizontalRule(getContent(), sel.start));
  }, [getContent, getSelection, onFormat]);

  // Open link dialog with smart pre-population
  const handleOpenLinkDialog = useCallback(() => {
    const sel = getSelection();
    const content = getContent();
    const selectedText = sel.text;

    // Check if cursor/selection is within an existing link
    const existingLink = findExistingLink(content, sel.start, sel.end);

    if (existingLink) {
      // Editing an existing link
      setEditingLink(existingLink);
      setLinkText(existingLink.text);
      setLinkUrl(existingLink.url);
      setLinkTitle(existingLink.title || '');
    } else if (selectedText) {
      // New link with selected text
      setEditingLink(null);
      if (looksLikeUrl(selectedText)) {
        // Selected text looks like a URL, use it as the URL
        setLinkUrl(selectedText);
        setLinkText('');
        setLinkTitle('');
      } else {
        // Use selected text as the link text/title
        setLinkText(selectedText);
        setLinkUrl('');
        setLinkTitle(selectedText);
      }
    } else {
      // No selection, empty dialog
      setEditingLink(null);
      setLinkText('');
      setLinkUrl('');
      setLinkTitle('');
    }

    setDialogs((prev) => ({ ...prev, link: true }));
  }, [getContent, getSelection]);

  const handleLinkSubmit = useCallback(() => {
    if (!linkUrl) return;
    const content = getContent();

    if (editingLink) {
      // Replace the existing link
      const newLink = linkTitle
        ? `[${linkText || editingLink.text}](${linkUrl} "${linkTitle}")`
        : `[${linkText || editingLink.text}](${linkUrl})`;
      const newContent =
        content.substring(0, editingLink.start) +
        newLink +
        content.substring(editingLink.end);
      onFormat({
        newContent,
        newSelectionStart: editingLink.start,
        newSelectionEnd: editingLink.start + newLink.length,
      });
    } else {
      // Insert new link
      const sel = getSelection();
      onFormat(insertLink(content, sel.start, sel.end, linkUrl, linkTitle || undefined));
    }

    setDialogs((prev) => ({ ...prev, link: false }));
    setEditingLink(null);
    setLinkText('');
    setLinkUrl('');
    setLinkTitle('');
  }, [getContent, getSelection, onFormat, linkUrl, linkTitle, linkText, editingLink]);

  const handleImageSubmit = useCallback(() => {
    if (!imageUrl) return;
    const sel = getSelection();
    onFormat(insertImage(getContent(), sel.start, sel.end, imageUrl, imageAlt || 'image'));
    setDialogs((prev) => ({ ...prev, image: false }));
    setImageUrl('');
    setImageAlt('');
  }, [getContent, getSelection, onFormat, imageUrl, imageAlt]);

  const handleBrowseImage = useCallback(async () => {
    if (!filePath) return;
    const result = await window.electronAPI.browseImageFile(filePath);
    if (!result.canceled && result.relativePath) {
      setImageUrl(result.relativePath);
    }
  }, [filePath]);

  const handleTableSubmit = useCallback(() => {
    const sel = getSelection();
    onFormat(insertTable(getContent(), sel.start, tableRows, tableCols));
    setDialogs((prev) => ({ ...prev, table: false }));
    setTableRows(3);
    setTableCols(3);
  }, [getContent, getSelection, onFormat, tableRows, tableCols]);

  // Track current heading level for display - only update when style dropdown opens
  const [currentHeading, setCurrentHeading] = useState(0);

  const handleOpenStyleDropdown = useCallback(() => {
    const sel = getSelection();
    const level = getCurrentHeadingLevel(getContent(), sel.start);
    setCurrentHeading(level);
    setDropdowns((prev) => ({ ...prev, style: !prev.style, code: false }));
  }, [getContent, getSelection]);

  const headingLabels: Record<number, string> = {
    0: 'Paragraph',
    1: 'Heading 1',
    2: 'Heading 2',
    3: 'Heading 3',
    4: 'Heading 4',
    5: 'Heading 5',
    6: 'Heading 6',
  };

  return (
    <div className="formatting-toolbar" ref={dropdownRef}>
      {/* Style Dropdown */}
      <div className="formatting-dropdown">
        <button
          className="formatting-button formatting-dropdown-trigger"
          onClick={handleOpenStyleDropdown}
          title="Text Style"
        >
          <span className="formatting-button-text">{headingLabels[currentHeading]}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {dropdowns.style && (
          <div className="formatting-dropdown-menu">
            <button className="formatting-dropdown-item" onClick={() => handleHeading(0)}>
              Paragraph
            </button>
            <button className="formatting-dropdown-item formatting-h1" onClick={() => handleHeading(1)}>
              Heading 1
            </button>
            <button className="formatting-dropdown-item formatting-h2" onClick={() => handleHeading(2)}>
              Heading 2
            </button>
            <button className="formatting-dropdown-item formatting-h3" onClick={() => handleHeading(3)}>
              Heading 3
            </button>
            <button className="formatting-dropdown-item formatting-h4" onClick={() => handleHeading(4)}>
              Heading 4
            </button>
            <button className="formatting-dropdown-item formatting-h5" onClick={() => handleHeading(5)}>
              Heading 5
            </button>
            <button className="formatting-dropdown-item formatting-h6" onClick={() => handleHeading(6)}>
              Heading 6
            </button>
          </div>
        )}
      </div>

      <div className="formatting-separator" />

      {/* Bold */}
      <button className="formatting-button" onClick={handleBold} title="Bold (Cmd+B)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 2.5H8.5C10.433 2.5 12 4.067 12 6C12 7.933 10.433 9.5 8.5 9.5H4V2.5Z" stroke="currentColor" strokeWidth="2" />
          <path d="M4 9.5H9.5C11.433 9.5 13 11.067 13 13C13 13.5 12 13.5 12 13.5H4V9.5Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {/* Italic */}
      <button className="formatting-button" onClick={handleItalic} title="Italic (Cmd+I)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 2.5H6M10 13.5H6M9.5 2.5L6.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Strikethrough */}
      <button className="formatting-button" onClick={handleStrikethrough} title="Strikethrough">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 4C5 3 6.5 2 8 2C9.5 2 11 3 11 4.5C11 5.5 10 6.5 8 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11 12C11 13 9.5 14 8 14C6.5 14 5 13 5 11.5C5 10.5 6 9.5 8 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="formatting-separator" />

      {/* Code Dropdown */}
      <div className="formatting-dropdown">
        <button
          className="formatting-button formatting-dropdown-trigger"
          onClick={() => setDropdowns((prev) => ({ ...prev, code: !prev.code, style: false }))}
          title="Code"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5.5 4L2 8L5.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10.5 4L14 8L10.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="dropdown-chevron">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {dropdowns.code && (
          <div className="formatting-dropdown-menu formatting-code-menu">
            <button className="formatting-dropdown-item" onClick={handleInlineCode}>
              Inline Code
            </button>
            <div className="formatting-dropdown-separator" />
            <div className="formatting-dropdown-label">Code Block</div>
            {CODE_LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                className="formatting-dropdown-item"
                onClick={() => handleCodeBlock(lang.value)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="formatting-separator" />

      {/* Link */}
      <button
        className="formatting-button"
        onClick={handleOpenLinkDialog}
        title="Insert Link"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6.5 9.5L9.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9.17 10.83L10.83 9.17C12.39 7.61 12.39 5.07 10.83 3.51V3.51C9.27 1.95 6.73 1.95 5.17 3.51L3.51 5.17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6.83 5.17L5.17 6.83C3.61 8.39 3.61 10.93 5.17 12.49V12.49C6.73 14.05 9.27 14.05 10.83 12.49L12.49 10.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Image */}
      <button
        className="formatting-button"
        onClick={() => setDialogs((prev) => ({ ...prev, image: true }))}
        title="Insert Image"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" />
          <path d="M2 11L5 8L8 11L11 7L14 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="formatting-separator" />

      {/* Blockquote */}
      <button className="formatting-button" onClick={handleBlockquote} title="Blockquote">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 3V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 5H13M6 8H13M6 11H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Unordered List */}
      <button className="formatting-button" onClick={handleUnorderedList} title="Bullet List">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="3" cy="4" r="1.5" fill="currentColor" />
          <circle cx="3" cy="8" r="1.5" fill="currentColor" />
          <circle cx="3" cy="12" r="1.5" fill="currentColor" />
          <path d="M6.5 4H14M6.5 8H14M6.5 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Ordered List */}
      <button className="formatting-button" onClick={handleOrderedList} title="Numbered List">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <text x="1.5" y="5.5" fill="currentColor" fontSize="5" fontWeight="bold">1.</text>
          <text x="1.5" y="9.5" fill="currentColor" fontSize="5" fontWeight="bold">2.</text>
          <text x="1.5" y="13.5" fill="currentColor" fontSize="5" fontWeight="bold">3.</text>
          <path d="M6.5 4H14M6.5 8H14M6.5 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="formatting-separator" />

      {/* Horizontal Rule */}
      <button className="formatting-button" onClick={handleHorizontalRule} title="Horizontal Rule">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Table */}
      <button
        className="formatting-button"
        onClick={() => setDialogs((prev) => ({ ...prev, table: true }))}
        title="Insert Table"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 6H14M2 10H14M6 2V14M10 2V14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {/* Link Dialog */}
      {dialogs.link && (
        <div className="formatting-dialog-overlay" onClick={() => setDialogs((prev) => ({ ...prev, link: false }))}>
          <div className="formatting-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="formatting-dialog-header">
              <h3>{editingLink ? 'Edit Link' : 'Insert Link'}</h3>
              <button
                className="formatting-dialog-close"
                onClick={() => setDialogs((prev) => ({ ...prev, link: false }))}
              >
                &times;
              </button>
            </div>
            <div className="formatting-dialog-body">
              {editingLink && (
                <label>
                  Link Text
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Link text"
                  />
                </label>
              )}
              <label>
                URL
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  autoFocus={!editingLink}
                />
              </label>
              <label>
                Title (optional)
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Link title"
                />
              </label>
            </div>
            <div className="formatting-dialog-footer">
              <button className="formatting-dialog-btn secondary" onClick={() => setDialogs((prev) => ({ ...prev, link: false }))}>
                Cancel
              </button>
              <button className="formatting-dialog-btn primary" onClick={handleLinkSubmit} disabled={!linkUrl}>
                {editingLink ? 'Update' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Dialog */}
      {dialogs.image && (
        <div className="formatting-dialog-overlay" onClick={() => setDialogs((prev) => ({ ...prev, image: false }))}>
          <div className="formatting-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="formatting-dialog-header">
              <h3>Insert Image</h3>
              <button
                className="formatting-dialog-close"
                onClick={() => setDialogs((prev) => ({ ...prev, image: false }))}
              >
                &times;
              </button>
            </div>
            <div className="formatting-dialog-body">
              <label>
                Image URL or Path
                <div className="formatting-input-with-button">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.png or ./image.png"
                    autoFocus
                  />
                  {filePath && (
                    <button
                      type="button"
                      className="formatting-dialog-btn secondary"
                      onClick={handleBrowseImage}
                    >
                      Browse...
                    </button>
                  )}
                </div>
              </label>
              <label>
                Alt Text
                <input
                  type="text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Image description"
                />
              </label>
            </div>
            <div className="formatting-dialog-footer">
              <button className="formatting-dialog-btn secondary" onClick={() => setDialogs((prev) => ({ ...prev, image: false }))}>
                Cancel
              </button>
              <button className="formatting-dialog-btn primary" onClick={handleImageSubmit} disabled={!imageUrl}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Dialog */}
      {dialogs.table && (
        <div className="formatting-dialog-overlay" onClick={() => setDialogs((prev) => ({ ...prev, table: false }))}>
          <div className="formatting-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="formatting-dialog-header">
              <h3>Insert Table</h3>
              <button
                className="formatting-dialog-close"
                onClick={() => setDialogs((prev) => ({ ...prev, table: false }))}
              >
                &times;
              </button>
            </div>
            <div className="formatting-dialog-body">
              <div className="formatting-dialog-row">
                <label>
                  Rows
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.max(2, parseInt(e.target.value) || 2))}
                  />
                </label>
                <label>
                  Columns
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </label>
              </div>
            </div>
            <div className="formatting-dialog-footer">
              <button className="formatting-dialog-btn secondary" onClick={() => setDialogs((prev) => ({ ...prev, table: false }))}>
                Cancel
              </button>
              <button className="formatting-dialog-btn primary" onClick={handleTableSubmit}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FormattingToolbar.displayName = 'FormattingToolbar';

export default FormattingToolbar;
