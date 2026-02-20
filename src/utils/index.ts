/**
 * Utility module – exports all common utilities.
 */

export { rollDie, rollDice, sumRolls } from './dice';
export { parsePlayerInput } from './input-parser';
export { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from './base64';
export {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey,
  cleanInput
} from './llm-utils';
export { extractMatch } from './text-utils';
export {
  parseDuration,
  addDuration,
  isPast,
  isValidDateStr,
  isValidDurationStr,
  formatDate,
  formatDate12Hr,
  getDow,
  clampTime,
  getMidnightsPassed
} from './time-utils';
