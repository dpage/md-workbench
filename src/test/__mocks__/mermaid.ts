//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

export default {
  initialize: jest.fn(),
  render: jest.fn().mockResolvedValue({ svg: '<svg></svg>' }),
};
