import { NarrationSummary } from '../types';

interface SceneReading {
  suggestedCondition: string | null;
  confidence: 'low' | 'medium' | 'high';
  cues: string[];
}

/** Interpret a NarrationSummary into a SceneReading by matching flags/tags to conditions. */
function readScene(
  update: NarrationSummary,
  availableConditions: string[]
): SceneReading {
  for (let i = 0; i < availableConditions.length; i++) {
    const condition = availableConditions[i];
    if (update.flags[condition] !== undefined && update.flags[condition] > 0) {
      return { suggestedCondition: condition, confidence: 'high', cues: [condition] };
    }
  }

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

export { SceneReading, readScene };
