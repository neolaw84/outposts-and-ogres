import { ParsedAction } from '../types';

function parseActionInput(message: string, knownActions: string[]): ParsedAction[] | null {
  const actions: ParsedAction[] = [];

  // Extract all <action target> patterns
  const regex = /<([^>]+)>/g;
  let match;
  while ((match = regex.exec(message)) !== null) {
    const inner = match[1].trim();
    const colonIndex = inner.indexOf(':');
    if (colonIndex !== -1) {
      const action = inner.substring(0, colonIndex).trim().toLowerCase();
      const target = inner.substring(colonIndex + 1).trim();
      actions.push({ effect: { key: action, what: target }, raw: message });
      continue;
    }
    const spaceIndex = inner.indexOf(' ');
    if (spaceIndex !== -1) {
      const action = inner.substring(0, spaceIndex).trim().toLowerCase();
      const target = inner.substring(spaceIndex + 1).trim();
      actions.push({ effect: { key: action, what: target }, raw: message });
      continue;
    }
    actions.push({ effect: { key: inner.toLowerCase() }, raw: message });
  }

  if (actions.length > 0) {
    return actions;
  }

  // Fallback keyword scanning
  const lowerMessage = message.toLowerCase();
  for (let i = 0; i < knownActions.length; i++) {
    const keyword = knownActions[i].toLowerCase();
    if (lowerMessage.indexOf(keyword) !== -1) {
      actions.push({ effect: { key: keyword }, raw: message });
      // Only extract the first plain-text keyword match to avoid over-parsing
      break;
    }
  }

  return actions.length > 0 ? actions : null;
}

export { parseActionInput };
