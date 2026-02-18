/**
 * Input parser for extracting player actions from free-text messages.
 *
 * The special syntax uses angle brackets which are easy to type on both
 * physical keyboards and mobile on-screen keyboards:
 *
 *   <action>           – e.g. <attack>
 *   <action target>    – e.g. <attack goblin>
 *   <action:target>    – e.g. <cast:fireball>
 *
 * If no special syntax is found the parser tries to match known action
 * keywords from the cartridge's available actions.
 */

import { ParsedAction } from './types';

/**
 * Parse the player's message and extract the intended action.
 *
 * @param message       The raw player message.
 * @param knownActions  List of action keywords the player is allowed to use
 *                      in the current condition.
 * @returns A ParsedAction or null if no action could be extracted.
 */
function parsePlayerInput(message: string, knownActions: string[]): ParsedAction | null {
  // 1. Try the explicit bracket syntax: <action> or <action target> or <action:target>
  var bracketMatch = message.match(/<([^>]+)>/);
  if (bracketMatch) {
    var inner = bracketMatch[1].trim();
    // Support colon separator: <action:target>
    var colonIndex = inner.indexOf(':');
    if (colonIndex !== -1) {
      var action = inner.substring(0, colonIndex).trim().toLowerCase();
      var target = inner.substring(colonIndex + 1).trim();
      return { action: action, target: target, raw: message };
    }
    // Support space separator: <action target>
    var spaceIndex = inner.indexOf(' ');
    if (spaceIndex !== -1) {
      var action = inner.substring(0, spaceIndex).trim().toLowerCase();
      var target = inner.substring(spaceIndex + 1).trim();
      return { action: action, target: target, raw: message };
    }
    // Just the action keyword
    return { action: inner.toLowerCase(), target: '', raw: message };
  }

  // 2. Fallback: scan the message for known action keywords
  var lowerMessage = message.toLowerCase();
  for (var i = 0; i < knownActions.length; i++) {
    var keyword = knownActions[i].toLowerCase();
    if (lowerMessage.indexOf(keyword) !== -1) {
      return { action: keyword, target: '', raw: message };
    }
  }

  return null;
}

export { parsePlayerInput };
