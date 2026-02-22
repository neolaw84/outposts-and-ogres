import { ParsedAction, PlayerEmotionSignal, ScenarioUpdate } from '../types';
import { parseActionInput } from './action-parser';
import { detectEmotionSignals } from './emotion-detector';
import { ScenarioUnderstanding, understandScenario } from './scenario-understanding';

interface PlayerInputUnderstanding {
  parsedActions: ParsedAction[] | null;
  emotions: PlayerEmotionSignal[];
  scenario: ScenarioUnderstanding;
}

function understandPlayerInput(
  message: string,
  knownActions: string[],
  availableConditions: string[],
  scenarioUpdate?: ScenarioUpdate | null
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
