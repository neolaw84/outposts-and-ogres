/**
 * LLM utilities for encoding/decoding game state and narration summaries.
 *
 * These utilities handle:
 * - Encoding game state to Base64 inside [RP_STATE]...[/RP_STATE] tags
 * - Decoding game state from LLM responses
 * - Extracting [NARRATION_SUMMARY]...[/NARRATION_SUMMARY] JSON blocks
 * - Generating effect instructions for the LLM
 */

import { base64EncodeRaw, base64DecodeRaw } from './base64';

/** Effect definition used for LLM instruction generation. */
interface EffectDefinition {
  key: string;
  condition: string;
  [prop: string]: unknown;
}

/** Result of finding an effect by key. */
interface FoundEffect {
  effect: Record<string, unknown> | null;
  typeCheck: Record<string, unknown> | null;
}

/**
 * Encode a game state object to a Base64 string.
 * Returns an empty string if the input is falsy.
 */
function encodeState(state: Record<string, unknown> | null): string {
  if (!state) {
    return '';
  }
  var jsonStr = JSON.stringify(state);
  return base64EncodeRaw(jsonStr);
}

/**
 * Decode a game state from a message containing [RP_STATE]...[/RP_STATE] tags.
 * The content between tags is expected to be Base64-encoded JSON.
 * Returns null if no valid state block is found.
 */
function decodeState(message: string | null): Record<string, unknown> | null {
  if (!message) {
    return null;
  }
  var startTag = '[RP_STATE]';
  var endTag = '[/RP_STATE]';
  var startIndex = message.indexOf(startTag);
  var endIndex = message.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return null;
  }

  var b64 = message.substring(startIndex + startTag.length, endIndex);
  try {
    var jsonStr = base64DecodeRaw(b64);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (_e) {
    return null;
  }
}

/**
 * Build the [RP_STATE] block string that instructs the LLM to return
 * the state verbatim in its response.
 */
function buildRpStateBlock(state: Record<string, unknown>): string {
  var encoded = encodeState(state);
  return '[RP_STATE]' + encoded + '[/RP_STATE]';
}

/**
 * Extract [NARRATION_SUMMARY] JSON from a message (last occurrence).
 * Returns null if no valid block is found.
 */
function extractNarrationSummary(message: string | null): Record<string, unknown> | null {
  if (!message) {
    return null;
  }
  var endTag = '[/NARRATION_SUMMARY]';
  var startTag = '[NARRATION_SUMMARY]';

  var endIndex = message.lastIndexOf(endTag);
  if (endIndex === -1) {
    return null;
  }

  var startIndex = message.lastIndexOf(startTag, endIndex);
  if (startIndex === -1) {
    return null;
  }

  var jsonStr = message.substring(startIndex + startTag.length, endIndex);
  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (_e) {
    return null;
  }
}

/**
 * Generate instruction text for the LLM to include a specific effect
 * in the NARRATION_SUMMARY based on a condition.
 */
function generateEffectInstruction(effectDef: EffectDefinition): string {
  if (!effectDef || !effectDef.key || !effectDef.condition) {
    return '';
  }

  var jsonBlock: Record<string, unknown> = {};
  var keys = Object.keys(effectDef);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== 'condition') {
      jsonBlock[keys[i]] = effectDef[keys[i]];
    }
  }

  var jsonString = JSON.stringify(jsonBlock, null, 4);
  return 'In the above narration of yours, if and only if ' +
    effectDef.condition +
    ', include one instance of the following in the "effects" array.\n\n' +
    jsonString;
}

/**
 * Find an effect by its key in a narration summary.
 */
function findEffectByKey(
  key: string,
  naSum: Record<string, unknown>,
  typeChecks: Record<string, unknown>
): FoundEffect {
  var foundEffect: Record<string, unknown> | null = null;
  var foundTypeCheck: Record<string, unknown> | null = null;

  var effects = naSum['effects'] as Array<Record<string, unknown>> | undefined;
  var typeCheckEffects = typeChecks['effects'] as Array<Record<string, unknown>> | undefined;

  if (effects && Array.isArray(effects)) {
    for (var j = 0; j < effects.length; j++) {
      if (effects[j]['key'] === key) {
        foundEffect = effects[j];
        if (typeCheckEffects && typeCheckEffects[j]) {
          foundTypeCheck = typeCheckEffects[j];
        }
        break;
      }
    }
  }

  return { effect: foundEffect, typeCheck: foundTypeCheck };
}

export {
  EffectDefinition,
  FoundEffect,
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey
};
