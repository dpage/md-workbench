//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

// Inline maths ($...$) tokeniser for micromark that follows Pandoc's
// tex_math_dollars rule, so that prose such as "$20,000 and $30,000" is not
// rendered as a formula. For a single-dollar span:
//
// - the opening $ must be followed by a non-whitespace character;
// - the closing $ must be preceded by a non-whitespace character, and must
//   not be followed by a digit.
//
// A $ that fails the closing checks is treated as part of the formula and the
// scan continues, as Pandoc does. Spans opened with $$ are left alone.
//
// This is a copy of mathText from micromark-extension-math 3.1.0
// (lib/math-text.js, MIT licence) with those checks added; the upstream
// construct has no option for them. It deliberately has no runtime imports so
// that it can be loaded under Jest, which cannot load the ESM-only micromark
// packages.

import type {
  Code,
  Construct,
  Event,
  Previous,
  Resolver,
  State,
  Token,
  TokenizeContext,
  Tokenizer,
} from 'micromark-util-types';

const DOLLAR = 36;
const SPACE = 32;
const TAB = -2;
const VIRTUAL_SPACE = -1;

// micromark encodes line endings as negative codes below -2.
function isLineEnding(code: Code): boolean {
  return code !== null && code < -2;
}

function isWhitespace(code: Code): boolean {
  return code !== null && (code < 0 || code === SPACE);
}

function isDigit(code: Code): boolean {
  return code !== null && code >= 48 && code <= 57;
}

const tokenizeMathText: Tokenizer = function (
  this: TokenizeContext,
  effects,
  ok,
  nok,
) {
  let sizeOpen = 0;
  let size = 0;
  let token: Token;
  // Whether the last character inside the span was whitespace.
  let afterWhitespace = false;

  const start: State = function (code) {
    effects.enter('mathText');
    effects.enter('mathTextSequence');
    return sequenceOpen(code);
  };

  const sequenceOpen: State = function (code) {
    if (code === DOLLAR) {
      effects.consume(code);
      sizeOpen++;
      return sequenceOpen;
    }

    if (sizeOpen === 1 && (code === null || isWhitespace(code))) {
      return nok(code);
    }

    effects.exit('mathTextSequence');
    return between(code);
  };

  const between: State = function (code) {
    if (code === null) {
      return nok(code);
    }

    if (code === DOLLAR) {
      if (sizeOpen === 1 && afterWhitespace) {
        // Cannot close here: keep the $ as part of the formula.
        effects.enter('mathTextData');
        effects.consume(code);
        afterWhitespace = false;
        return data;
      }
      token = effects.enter('mathTextSequence');
      size = 0;
      return sequenceClose(code);
    }

    if (code === SPACE) {
      effects.enter('space');
      effects.consume(code);
      effects.exit('space');
      afterWhitespace = true;
      return between;
    }

    if (isLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      afterWhitespace = true;
      return between;
    }

    effects.enter('mathTextData');
    return data(code);
  };

  const data: State = function (code) {
    if (
      code === null ||
      code === SPACE ||
      code === DOLLAR ||
      isLineEnding(code)
    ) {
      effects.exit('mathTextData');
      return between(code);
    }
    effects.consume(code);
    afterWhitespace = code === TAB || code === VIRTUAL_SPACE;
    return data;
  };

  const sequenceClose: State = function (code) {
    if (code === DOLLAR) {
      effects.consume(code);
      size++;
      return sequenceClose;
    }

    if (size === sizeOpen && !(sizeOpen === 1 && isDigit(code))) {
      effects.exit('mathTextSequence');
      effects.exit('mathText');
      return ok(code);
    }

    // Wrong number of markers, or a single $ followed by a digit: the
    // sequence is part of the formula.
    token.type = 'mathTextData';
    afterWhitespace = false;
    return data(code);
  };

  return start;
};

// Unchanged from upstream: strips one space of padding either side and
// merges adjacent spaces and data.
const resolveMathText: Resolver = function (events: Event[]) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index: number;
  let enter: number | undefined;

  if (
    (events[headEnterIndex][1].type === 'lineEnding' ||
      events[headEnterIndex][1].type === 'space') &&
    (events[tailExitIndex][1].type === 'lineEnding' ||
      events[tailExitIndex][1].type === 'space')
  ) {
    index = headEnterIndex;
    while (++index < tailExitIndex) {
      if (events[index][1].type === 'mathTextData') {
        events[tailExitIndex][1].type = 'mathTextPadding';
        events[headEnterIndex][1].type = 'mathTextPadding';
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }

  index = headEnterIndex - 1;
  tailExitIndex++;
  while (++index <= tailExitIndex) {
    if (enter === undefined) {
      if (index !== tailExitIndex && events[index][1].type !== 'lineEnding') {
        enter = index;
      }
    } else if (
      index === tailExitIndex ||
      events[index][1].type === 'lineEnding'
    ) {
      events[enter][1].type = 'mathTextData';
      if (index !== enter + 2) {
        events[enter][1].end = events[index - 1][1].end;
        events.splice(enter + 2, index - enter - 2);
        tailExitIndex -= index - enter - 2;
        index = enter + 2;
      }
      enter = undefined;
    }
  }

  return events;
};

// Unchanged from upstream: a $ cannot open maths straight after another $
// unless that one was escaped.
const previous: Previous = function (this: TokenizeContext, code) {
  return (
    code !== DOLLAR ||
    this.events[this.events.length - 1][1].type === 'characterEscape'
  );
};

export function mathTextPandoc(): Construct {
  return {
    name: 'mathText',
    tokenize: tokenizeMathText,
    resolve: resolveMathText,
    previous,
  };
}
