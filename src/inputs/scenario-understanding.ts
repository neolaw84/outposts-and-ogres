import { NarrationSummary } from '../types';

interface SceneReading {
  suggestedCondition: string | null;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
}

/**
 * Interpret a `NarrationSummary` (the open-contract LLM output) into a
 * cartridge-specific `SceneReading`.
 *
 * Priority:
 *  1. A flag whose key matches an available condition and whose value is
 *     non-zero → high confidence.
 *  2. A tag whose value matches an available condition → medium confidence.
 *  3. No match → low confidence, no suggested condition.
 */
function understandScenario(
  update: NarrationSummary,
  availableConditions: string[]
): SceneReading {
  // Check flags: flag key equals a condition name with non-zero value
  for (let i = 0; i < availableConditions.length; i++) {
    const condition = availableConditions[i];
    if (update.flags[condition] !== undefined && update.flags[condition] > 0) {
      return { suggestedCondition: condition, confidence: 'high', cues: [condition] };
    }
  }

  // Check tags: tag value equals a condition name
  const tagKeys = Object.keys(update.tags);
  for (let i = 0; i < availableConditions.length; i++) {
    const condition = availableConditions[i];
    for (let j = 0; j < tagKeys.length; j++) {
      if (update.tags[tagKeys[j]] === condition) {
        return { suggestedCondition: condition, confidence: 'medium', cues: [tagKeys[j]] };
      }
    }
  }

  return { suggestedCondition: null, confidence: 'low', cues: [] };
}

export { SceneReading, understandScenario };
