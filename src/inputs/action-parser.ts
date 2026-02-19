import { ParsedAction } from '../types';

function parseActionInput(message: string, knownActions: string[]): ParsedAction | null {
  const bracketMatch = message.match(/<([^>]+)>/);
  if (bracketMatch) {
    const inner = bracketMatch[1].trim();
    const colonIndex = inner.indexOf(':');
    if (colonIndex !== -1) {
      const action = inner.substring(0, colonIndex).trim().toLowerCase();
      const target = inner.substring(colonIndex + 1).trim();
      return { action: action, target: target, raw: message };
    }
    const spaceIndex = inner.indexOf(' ');
    if (spaceIndex !== -1) {
      const action = inner.substring(0, spaceIndex).trim().toLowerCase();
      const target = inner.substring(spaceIndex + 1).trim();
      return { action: action, target: target, raw: message };
    }
    return { action: inner.toLowerCase(), target: '', raw: message };
  }

  const lowerMessage = message.toLowerCase();
  for (let i = 0; i < knownActions.length; i++) {
    const keyword = knownActions[i].toLowerCase();
    if (lowerMessage.indexOf(keyword) !== -1) {
      return { action: keyword, target: '', raw: message };
    }
  }

  return null;
}

export { parseActionInput };
