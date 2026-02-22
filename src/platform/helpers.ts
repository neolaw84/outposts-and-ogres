/**
 * Shared helpers for platform adapters.
 *
 * Centralises the logic for formatting NarrationDirectives
 * into text lines that any adapter can consume.
 */

import { NarrationDirective } from '../types';

/**
 * Flatten NarrationDirectives into prefixed text lines.
 *
 * Each mustHappen entry becomes "MUST: …",
 * each mustNotHappen becomes "MUST NOT: …", and
 * each mayHappen becomes "MAY: …".
 */
function formatDirectiveLines(directives: NarrationDirective[]): string[] {
  const lines: string[] = [];
  for (const gpe of directives) {
    for (const m of gpe.mustHappen) {
      lines.push('MUST: ' + m);
    }
    for (const m of gpe.mustNotHappen) {
      lines.push('MUST NOT: ' + m);
    }
    for (const m of gpe.mayHappen) {
      lines.push('MAY: ' + m);
    }
  }
  return lines;
}

/**
 * Collect NarrationDirective entries into three separate arrays.
 */
function collectDirectiveArrays(directives: NarrationDirective[]): {
  mustLines: string[];
  mustNotLines: string[];
  mayLines: string[];
} {
  const mustLines: string[] = [];
  const mustNotLines: string[] = [];
  const mayLines: string[] = [];
  for (const gpe of directives) {
    for (const m of gpe.mustHappen) { mustLines.push(m); }
    for (const m of gpe.mustNotHappen) { mustNotLines.push(m); }
    for (const m of gpe.mayHappen) { mayLines.push(m); }
  }
  return { mustLines, mustNotLines, mayLines };
}

export {
  formatDirectiveLines,
  collectDirectiveArrays
};
