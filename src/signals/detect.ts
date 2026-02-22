import { Signal, SignalDetector } from '../types';

/**
 * Detect the player's signals from their free-text message.
 *
 * Detection strategy:
 * 1. First, try bracket syntax `<action:target>` or `<action target>` — if
 *    the action part matches any detector's `key`, emit a Signal.
 * 2. For each SignalDetector, check `patterns` (regex) first, then `keywords`
 *    (case-insensitive substring). Emit a Signal for each match.
 *
 * @param message   The raw player message.
 * @param detectors Array of SignalDetector definitions from the cartridge.
 * @returns Array of detected Signals (empty if nothing matched).
 */
function detectSignals(
  message: string,
  detectors: SignalDetector[]
): Signal[] {
  const results: Signal[] = [];
  const matchedKeys = new Set<string>();

  // Phase 1: Bracket syntax  <action target> or <action:target>
  const bracketRegex = /<([^>]+)>/g;
  let match;
  while ((match = bracketRegex.exec(message)) !== null) {
    const inner = match[1].trim();
    let actionKey: string;
    let target: string | undefined;

    const colonIndex = inner.indexOf(':');
    if (colonIndex !== -1) {
      actionKey = inner.substring(0, colonIndex).trim().toLowerCase();
      target = inner.substring(colonIndex + 1).trim();
    } else {
      const spaceIndex = inner.indexOf(' ');
      if (spaceIndex !== -1) {
        actionKey = inner.substring(0, spaceIndex).trim().toLowerCase();
        target = inner.substring(spaceIndex + 1).trim();
      } else {
        actionKey = inner.toLowerCase();
      }
    }

    // Only accept bracket actions whose key matches a known detector
    const detectorExists = detectors.some(m => m.key === actionKey);
    if (detectorExists) {
      const record: Signal = { key: actionKey };
      if (target) {
        record.what = target;
      }
      results.push(record);
      matchedKeys.add(actionKey);
    }
  }

  // Phase 2: keyword / regex scanning for detectors not already matched
  const lowerMessage = message.toLowerCase();
  for (const detector of detectors) {
    if (matchedKeys.has(detector.key)) {
      continue;
    }

    // Try regex patterns first
    if (detector.patterns && detector.patterns.length > 0) {
      let found = false;
      for (const pattern of detector.patterns) {
        const regexMatch = pattern.exec(message);
        if (regexMatch) {
          const record: Signal = { key: detector.key };
          // Use first capture group as `what` if present (e.g. /cast\s+(\w+)/i → "fireball")
          if (regexMatch[1]) {
            record.what = regexMatch[1].trim();
          }
          record.tags = { sourceKeyword: regexMatch[0] };
          results.push(record);
          matchedKeys.add(detector.key);
          found = true;
          break;
        }
      }
      if (found) continue;
    }

    // Try keywords
    for (const keyword of detector.keywords) {
      if (lowerMessage.indexOf(keyword.toLowerCase()) !== -1) {
        results.push({ key: detector.key, tags: { sourceKeyword: keyword } });
        matchedKeys.add(detector.key);
        break;
      }
    }
  }

  return results;
}

export { detectSignals };
