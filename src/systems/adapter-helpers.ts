/**
 * Shared helpers for system adapters.
 *
 * Centralises the logic for formatting GamePlayEvents
 * into text lines that any adapter can consume.
 */

import { GamePlayEvent } from '../types';

/**
 * Flatten GamePlayEvents into prefixed text lines.
 *
 * Each mustHappen entry becomes "MUST: …",
 * each mustNotHappen becomes "MUST NOT: …", and
 * each mayHappen becomes "MAY: …".
 */
function formatGamePlayEventLines(events: GamePlayEvent[]): string[] {
  const lines: string[] = [];
  for (const gpe of events) {
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
 * Collect GamePlayEvent entries into three separate arrays.
 */
function collectGamePlayEventArrays(events: GamePlayEvent[]): {
  mustLines: string[];
  mustNotLines: string[];
  mayLines: string[];
} {
  const mustLines: string[] = [];
  const mustNotLines: string[] = [];
  const mayLines: string[] = [];
  for (const gpe of events) {
    for (const m of gpe.mustHappen) { mustLines.push(m); }
    for (const m of gpe.mustNotHappen) { mustNotLines.push(m); }
    for (const m of gpe.mayHappen) { mayLines.push(m); }
  }
  return { mustLines, mustNotLines, mayLines };
}

export {
  formatGamePlayEventLines,
  collectGamePlayEventArrays
};
