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
import { isValidDateStr } from './time-utils';

/** Effect definition used for LLM instruction generation. */
interface WorldEventTracker {
  key: string;
  condition: string;
  [prop: string]: unknown;
}

/** Concrete effect data record (matching the EffectRecord shape from types.ts). */
interface EffectRecord {
  key: string;
  what?: string;
  when?: string;
  meters?: Record<string, number>;
  flags?: Record<string, boolean>;
  tags?: Record<string, string>;
}

/** Result of finding an effect by key. */
interface FoundEffect {
  effect: EffectRecord | null;
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
  const jsonStr = JSON.stringify(state);
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
  const startTag = '[RP_STATE]';
  const endTag = '[/RP_STATE]';
  const startIndex = message.indexOf(startTag);
  const endIndex = message.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return null;
  }

  const b64 = message.substring(startIndex + startTag.length, endIndex);
  try {
    const jsonStr = base64DecodeRaw(b64);
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
  const encoded = encodeState(state);
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
  const endTag = '[/NARRATION_SUMMARY]';
  const startTag = '[NARRATION_SUMMARY]';

  const endIndex = message.lastIndexOf(endTag);
  if (endIndex === -1) {
    return null;
  }

  const startIndex = message.lastIndexOf(startTag, endIndex);
  if (startIndex === -1) {
    return null;
  }

  const jsonStr = message.substring(startIndex + startTag.length, endIndex);
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
function generateEffectInstruction(effectDef: WorldEventTracker): string {
  if (!effectDef || !effectDef.key || !effectDef.condition) {
    return '';
  }

  const jsonBlock: Record<string, unknown> = {};
  const keys = Object.keys(effectDef);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== 'condition') {
      jsonBlock[keys[i]] = effectDef[keys[i]];
    }
  }

  const jsonString = JSON.stringify(jsonBlock, null, 4);
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
  narrationSummary: Record<string, unknown>,
  typeChecks: Record<string, unknown>
): FoundEffect {
  let foundEffect: EffectRecord | null = null;
  let foundTypeCheck: Record<string, unknown> | null = null;

  const effects = narrationSummary['effects'] as Array<Record<string, unknown>> | undefined;
  const typeCheckEffects = typeChecks['effects'] as Array<Record<string, unknown>> | undefined;

  if (effects && Array.isArray(effects)) {
    for (let j = 0; j < effects.length; j++) {
      if (effects[j]['key'] === key) {
        foundEffect = effects[j] as unknown as EffectRecord;
        if (typeCheckEffects && typeCheckEffects[j]) {
          foundTypeCheck = typeCheckEffects[j];
        }
        break;
      }
    }
  }

  return { effect: foundEffect, typeCheck: foundTypeCheck };
}

/**
 * Validate a narration summary object recursively and return a mirror
 * object indicating which fields are valid.
 * Used by aspect functions to safely access LLM-provided data.
 */
function cleanInput(inputObject: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // 1. Validate elapsed_time
  if (typeof inputObject['elapsed_time'] === 'string' &&
      (inputObject['elapsed_time'] as string).indexOf('P') === 0) {
    result['elapsed_time'] = true;
  } else {
    result['elapsed_time'] = false;
  }

  // 2. Validate effects
  if (Array.isArray(inputObject['effects'])) {
    const effectsResult: Array<Record<string, unknown>> = [];
    const effects = inputObject['effects'] as Array<Record<string, unknown>>;
    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i];
      const resEff: Record<string, unknown> = {};

      // Key
      resEff['key'] = (typeof eff['key'] === 'string' && (eff['key'] as string).length > 0);

      // What
      resEff['what'] = (typeof eff['what'] === 'string');

      // When
      resEff['when'] = (typeof eff['when'] === 'string' && isValidDateStr(eff['when'] as string));

      // Flags
      if (eff['flags'] && typeof eff['flags'] === 'object') {
        const flagsResult: Record<string, boolean> = {};
        const flags = eff['flags'] as Record<string, unknown>;
        const flagKeys = Object.keys(flags);
        for (let j = 0; j < flagKeys.length; j++) {
          flagsResult[flagKeys[j]] = (typeof flags[flagKeys[j]] === 'boolean');
        }
        resEff['flags'] = flagsResult;
      }

      // Tags
      if (eff['tags'] && typeof eff['tags'] === 'object') {
        const tagsResult: Record<string, boolean> = {};
        const tags = eff['tags'] as Record<string, unknown>;
        const tagKeys = Object.keys(tags);
        for (let j = 0; j < tagKeys.length; j++) {
          tagsResult[tagKeys[j]] = (typeof tags[tagKeys[j]] === 'string');
        }
        resEff['tags'] = tagsResult;
      }

      // Meters
      if (eff['meters'] && typeof eff['meters'] === 'object') {
        const metersResult: Record<string, boolean> = {};
        const meters = eff['meters'] as Record<string, unknown>;
        const meterKeys = Object.keys(meters);
        for (let j = 0; j < meterKeys.length; j++) {
          metersResult[meterKeys[j]] = (typeof meters[meterKeys[j]] === 'number');
        }
        resEff['meters'] = metersResult;
      }

      effectsResult.push(resEff);
    }
    result['effects'] = effectsResult;
  } else {
    result['effects'] = false;
  }

  // 3. Debug
  if (inputObject['debug']) {
    result['debug'] = true;
  }

  return result;
}

export {
  WorldEventTracker,
  EffectRecord,
  FoundEffect,
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey,
  cleanInput
};
