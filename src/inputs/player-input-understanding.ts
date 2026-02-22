import { ParsedAction, PlayerEmotionSignal, WorldSimulationUpdate, PlayerInputUnderstanding } from '../types';
import { parseActionInput } from './action-parser';
import { detectEmotionSignals } from './emotion-detector';
import { understandScenario } from './scenario-understanding';

function understandPlayerInput(
  message: string,
  knownActions: string[],
  availableConditions: string[],
  scenarioUpdate?: WorldSimulationUpdate | null
): PlayerInputUnderstanding {
  return {
    parsedActions: parseActionInput(message, knownActions),
    emotions: detectEmotionSignals(message),
    scenario: scenarioUpdate != null
      ? understandScenario(scenarioUpdate, availableConditions)
      : { suggestedCondition: null, confidence: 'low', cues: [] }
  };
}

export { PlayerInputUnderstanding, understandPlayerInput };
