//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

/**
 * @jest-environment node
 */

const mockStartAccessing = jest.fn();
const mockCreateBookmark = jest.fn();
let mockStored: Record<string, unknown> = {};

jest.mock('electron', () => ({
  app: { startAccessingSecurityScopedResource: mockStartAccessing },
}));

jest.mock('electron-store', () =>
  jest.fn().mockImplementation(({ defaults }) => {
    mockStored = { ...defaults };
    return {
      get: (key: string) => mockStored[key],
      set: (key: string, value: unknown) => {
        mockStored[key] = value;
      },
    };
  })
);

jest.mock('mdworkbench-bookmarks', () => ({
  createSecurityScopedBookmark: mockCreateBookmark,
}));

type FileBookmarks = typeof import('../fileBookmarks');

function loadModule(mas: boolean): FileBookmarks {
  Object.defineProperty(process, 'mas', { value: mas, configurable: true });
  let mod: FileBookmarks | undefined;
  jest.isolateModules(() => {
    mod = require('../fileBookmarks');
  });
  return mod as FileBookmarks;
}

function storedBookmarks(): Record<string, string> {
  return mockStored.bookmarks as Record<string, string>;
}

describe('fileBookmarks', () => {
  beforeEach(() => {
    mockStartAccessing.mockReset();
    mockCreateBookmark.mockReset();
  });

  afterAll(() => {
    delete (process as { mas?: boolean }).mas;
  });

  it('does nothing outside the App Store build', () => {
    const { saveBookmark, ensureFileAccess } = loadModule(false);
    saveBookmark('/docs/a.md', 'bm-a');
    ensureFileAccess('/docs/a.md');

    expect(storedBookmarks()).toEqual({});
    expect(mockStartAccessing).not.toHaveBeenCalled();
    expect(mockCreateBookmark).not.toHaveBeenCalled();
  });

  it('starts access from a saved bookmark once per session', () => {
    const { saveBookmark, ensureFileAccess } = loadModule(true);
    saveBookmark('/docs/a.md', 'bm-a');

    ensureFileAccess('/docs/a.md');
    ensureFileAccess('/docs/a.md');

    expect(mockStartAccessing).toHaveBeenCalledTimes(1);
    expect(mockStartAccessing).toHaveBeenCalledWith('bm-a');
    expect(mockCreateBookmark).not.toHaveBeenCalled();
  });

  it('uses a parent folder bookmark for files inside it', () => {
    const { saveBookmark, ensureFileAccess } = loadModule(true);
    saveBookmark('/docs', 'bm-docs');

    ensureFileAccess('/docs/notes/a.md');
    ensureFileAccess('/docs/b.md');

    expect(mockStartAccessing).toHaveBeenCalledTimes(1);
    expect(mockStartAccessing).toHaveBeenCalledWith('bm-docs');
  });

  it('bookmarks a file with no saved bookmark, such as one opened from Finder', () => {
    const { ensureFileAccess } = loadModule(true);
    mockCreateBookmark.mockReturnValue('bm-new');

    ensureFileAccess('/docs/a.md');

    expect(mockCreateBookmark).toHaveBeenCalledWith('/docs/a.md');
    expect(storedBookmarks()).toEqual({ '/docs/a.md': 'bm-new' });
  });

  it('only tries once to bookmark a path the app cannot access', () => {
    const { ensureFileAccess } = loadModule(true);
    mockCreateBookmark.mockReturnValue(null);

    ensureFileAccess('/docs/a.md');
    ensureFileAccess('/docs/a.md');

    expect(mockCreateBookmark).toHaveBeenCalledTimes(1);
    expect(storedBookmarks()).toEqual({});
  });

  it('replaces a bookmark Electron rejects as stale', () => {
    const { saveBookmark, ensureFileAccess } = loadModule(true);
    saveBookmark('/docs/a.md', 'bm-stale');
    mockStartAccessing.mockImplementation(() => {
      throw new Error('bookmarkDataIsStale - try recreating the bookmark');
    });
    mockCreateBookmark.mockReturnValue('bm-fresh');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    ensureFileAccess('/docs/a.md');

    expect(storedBookmarks()).toEqual({ '/docs/a.md': 'bm-fresh' });
  });

  it('keeps the most recently used bookmarks', () => {
    const { saveBookmark, ensureFileAccess } = loadModule(true);
    for (let i = 0; i < 200; i++) {
      saveBookmark(`/docs/${i}.md`, `bm-${i}`);
    }

    // Using the oldest bookmark makes it the newest
    ensureFileAccess('/docs/0.md');
    saveBookmark('/docs/new.md', 'bm-new');

    const paths = Object.keys(storedBookmarks());
    expect(paths).toHaveLength(200);
    expect(paths).not.toContain('/docs/1.md');
    expect(paths).toContain('/docs/0.md');
    expect(paths[paths.length - 1]).toBe('/docs/new.md');
  });
});
