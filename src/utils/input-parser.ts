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

import { ParsedAction } from '../types';
import { parseActionInput } from '../inputs/action-parser';

/**
 * Parse the player's message and extract the intended action.
 *
 * @param message       The raw player message.
 * @param knownActions  List of action keywords the player is allowed to use
 *                      in the current condition.
 * @returns A ParsedAction or null if no action could be extracted.
 */
function parsePlayerInput(message: string, knownActions: string[]): ParsedAction[] | null {
  return parseActionInput(message, knownActions);
}

export { parsePlayerInput };
