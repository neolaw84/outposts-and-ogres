import { ParsedAction, PlayerEmotionSignal } from '../types';
import { parseActionInput } from './action-parser';
import { detectEmotionSignals } from './emotion-detector';
import { ScenarioUnderstanding, understandScenario } from './scenario-understanding';

interface PlayerInputUnderstanding {
  parsedAction: ParsedAction | null;
  emotions: PlayerEmotionSignal[];
  scenario: ScenarioUnderstanding;
}

function understandPlayerInput(
  message: string,
  knownActions: string[],
  availableConditions: string[]
): PlayerInputUnderstanding {
  return {
    parsedAction: parseActionInput(message, knownActions),
    emotions: detectEmotionSignals(message),
    scenario: understandScenario(message, availableConditions)
  };
}

export { PlayerInputUnderstanding, understandPlayerInput };
