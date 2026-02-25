import { Signal, SignalDetector } from '../types';

/**
 * Detect player signals from free text. Tries bracket syntax first,
 * then regex patterns, then keyword matching per detector.
 */
function detectSignals(
  message: string,
  detectors: SignalDetector[]
): Signal[] {
  const results: Signal[] = [];
  const matchedKeys = new Set<string>();

  // Bracket syntax: <action target> or <action:target>
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

  // Keyword / regex scanning for unmatched detectors
  const lowerMessage = message.toLowerCase();
  for (const detector of detectors) {
    if (matchedKeys.has(detector.key)) {
      continue;
    }

    if (detector.patterns && detector.patterns.length > 0) {
      let found = false;
      for (const pattern of detector.patterns) {
        const regexMatch = pattern.exec(message);
        if (regexMatch) {
          const record: Signal = { key: detector.key };
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

    if (detector.verbs && detector.verbs.length > 0 && detector.whatDict) {
      let found = false;
      for (const verb of detector.verbs) {
        if (lowerMessage.indexOf(verb.toLowerCase()) !== -1) {
          for (const [whatVal, aliases] of Object.entries(detector.whatDict)) {
            for (const alias of aliases) {
              if (lowerMessage.indexOf(alias.toLowerCase()) !== -1) {
                const record: Signal = { key: detector.key, what: whatVal, tags: { sourceKeyword: `${verb} ${alias}` } };
                results.push(record);
                matchedKeys.add(detector.key);
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        if (found) break;
      }
      if (found) continue;
    }

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
