/**
 * LLM utilities for encoding/decoding game state and narration summaries.
 *
 * These utilities handle:
 * - Encoding game state to Base64 inside [RP_STATE]...[/RP_STATE] tags
 * - Decoding game state from LLM responses
 * - Extracting [NARRATION_SUMMARY]...[/NARRATION_SUMMARY] JSON blocks
 * - Rendering schema instructions for the LLM
 */

import { base64EncodeRaw, base64DecodeRaw } from './base64';
import { isValidDateStr } from './time-utils';
import { Signal } from '../types';

/** Effect definition used for LLM instruction generation. */
interface SignalSchema {
  key: string;
  condition: string;
  [prop: string]: unknown;
}

/** Result of finding a signal by key. */
interface FoundSignal {
  effect: Signal | null;
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
 * Render instruction text for the LLM to include a specific signal
 * in the NARRATION_SUMMARY based on a condition.
 */
function renderSchemaInstruction(schemaDef: SignalSchema): string {
  if (!schemaDef || !schemaDef.key || !schemaDef.condition) {
    return '';
  }

  const jsonBlock: Record<string, unknown> = {};
  const keys = Object.keys(schemaDef);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== 'condition') {
      jsonBlock[keys[i]] = schemaDef[keys[i]];
    }
  }

  const jsonString = JSON.stringify(jsonBlock, null, 4);
  return 'In the above narration of yours, if and only if ' +
    schemaDef.condition +
    ', include one instance of the following in the "effects" array.\n\n' +
    jsonString;
}

/**
 * Find a signal by its key in a narration summary.
 * Converts the raw JSON record into a typed Signal.
 */
function findSignalByKey(
  key: string,
  narrationSummary: Record<string, unknown>,
  typeChecks: Record<string, unknown>
): FoundSignal {
  let foundEffect: Signal | null = null;
  let foundTypeCheck: Record<string, unknown> | null = null;

  const effects = narrationSummary['effects'] as Array<Record<string, unknown>> | undefined;
  const typeCheckEffects = typeChecks['effects'] as Array<Record<string, unknown>> | undefined;

  if (effects && Array.isArray(effects)) {
    for (let j = 0; j < effects.length; j++) {
      if (effects[j]['key'] === key) {
        const raw = effects[j];
        foundEffect = {
          key: raw['key'] as string,
          what: typeof raw['what'] === 'string' ? raw['what'] : undefined,
          when: typeof raw['when'] === 'string' ? raw['when'] : undefined,
          meters: (raw['meters'] && typeof raw['meters'] === 'object') ? raw['meters'] as Record<string, number> : undefined,
          flags: (raw['flags'] && typeof raw['flags'] === 'object') ? raw['flags'] as Record<string, boolean> : undefined,
          tags: (raw['tags'] && typeof raw['tags'] === 'object') ? raw['tags'] as Record<string, string> : undefined
        };
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
 * object indicating which signal types are valid.
 * Used by aspect functions to safely access LLM-provided data.
 */
function validateSignalTypes(inputObject: Record<string, unknown>): Record<string, unknown> {
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
  SignalSchema,
  FoundSignal,
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  renderSchemaInstruction,
  findSignalByKey,
  validateSignalTypes
};
