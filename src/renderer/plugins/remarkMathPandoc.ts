//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Drop-in replacement for remark-math whose inline maths follows Pandoc's
// dollar rule (see mathTextPandoc.ts), so prices are not read as formulae.
// Block maths ($$ on its own lines) is unchanged.

import { math } from 'micromark-extension-math';
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math';
import type { Processor } from 'unified';
import { mathTextPandoc } from './mathTextPandoc';

// The extension lists remark-parse and remark-stringify read from the
// processor's data; their type augmentations aren't direct dependencies here.
interface ExtensionData {
  micromarkExtensions?: unknown[];
  fromMarkdownExtensions?: unknown[];
  toMarkdownExtensions?: unknown[];
}

export default function remarkMathPandoc(this: Processor): void {
  const data = this.data() as ExtensionData;

  const syntax = math();
  syntax.text = { [36]: mathTextPandoc() };

  (data.micromarkExtensions ||= []).push(syntax);
  (data.fromMarkdownExtensions ||= []).push(mathFromMarkdown());
  (data.toMarkdownExtensions ||= []).push(mathToMarkdown());
}
