import { Signal, SignalDetector } from '../types';

/**
 * Parse the player's free-text message into an array of detected intents.
 *
 * Detection strategy:
 * 1. First, try bracket syntax `<action:target>` or `<action target>` — if
 *    the action part matches any matcher's `key`, emit a Signal.
 * 2. For each SignalDetector, check `patterns` (regex) first, then `keywords`
 *    (case-insensitive substring). Emit a Signal for each match.
 *
 * @param message  The raw player message.
 * @param matchers Array of SignalDetector definitions from the cartridge.
 * @returns Array of detected Signals (empty if nothing matched).
 */
function parsePlayerInput(
  message: string,
  matchers: SignalDetector[]
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

    // Only accept bracket actions whose key matches a known matcher
    const matcherExists = matchers.some(m => m.key === actionKey);
    if (matcherExists) {
      const record: Signal = { key: actionKey };
      if (target) {
        record.what = target;
      }
      results.push(record);
      matchedKeys.add(actionKey);
    }
  }

  // Phase 2: keyword / regex scanning for matchers not already matched
  const lowerMessage = message.toLowerCase();
  for (const matcher of matchers) {
    if (matchedKeys.has(matcher.key)) {
      continue;
    }

    // Try regex patterns first
    if (matcher.patterns && matcher.patterns.length > 0) {
      let found = false;
      for (const pattern of matcher.patterns) {
        const regexMatch = pattern.exec(message);
        if (regexMatch) {
          const record: Signal = { key: matcher.key };
          // Use first capture group as `what` if present (e.g. /cast\s+(\w+)/i → "fireball")
          if (regexMatch[1]) {
            record.what = regexMatch[1].trim();
          }
          record.tags = { sourceKeyword: regexMatch[0] };
          results.push(record);
          matchedKeys.add(matcher.key);
          found = true;
          break;
        }
      }
      if (found) continue;
    }

    // Try keywords
    for (const keyword of matcher.keywords) {
      if (lowerMessage.indexOf(keyword.toLowerCase()) !== -1) {
        results.push({ key: matcher.key, tags: { sourceKeyword: keyword } });
        matchedKeys.add(matcher.key);
        break;
      }
    }
  }

  return results;
}

export { parsePlayerInput };
