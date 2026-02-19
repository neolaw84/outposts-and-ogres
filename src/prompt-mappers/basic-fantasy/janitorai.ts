import { PromptChannels, TurnEvent } from '../../types';

function getEvent<T extends TurnEvent['type']>(
  events: TurnEvent[],
  type: T
): Extract<TurnEvent, { type: T }> | null {
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === type) {
      return events[i] as Extract<TurnEvent, { type: T }>;
    }
  }
  return null;
}

function mapBasicFantasyJanitorAI(events: TurnEvent[]): PromptChannels {
  const inputEvent = getEvent(events, 'player_input');
  const diceEvent = getEvent(events, 'dice_resolution');
  const choicesEvent = getEvent(events, 'available_choices');
  const cueEvent = getEvent(events, 'narrative_cue');

  const personalityText =
    'Persistent guidance: Maintain tone continuity, respect condition logic, and carry forward player emotional state. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '. ' +
    'Emotions=' + (inputEvent && inputEvent.emotions.length > 0
      ? inputEvent.emotions.map(function (signal) { return signal.emotion; }).join(', ')
      : 'none') + '.';

  const scenarioText = diceEvent
    ? 'Narrate now: Player tried ' + diceEvent.action +
      (diceEvent.target ? ' on ' + diceEvent.target : '') +
      '. Roll=' + diceEvent.rollTotal + '/' + diceEvent.difficulty +
      ' => ' + (diceEvent.success ? 'success' : 'failure') + '. ' +
      (cueEvent ? cueEvent.cue + ' ' : '') +
      'Then present next options: ' + (choicesEvent ? choicesEvent.choices.join(', ') : 'none') + '.'
    : 'Narrate now: resolve the player attempt and provide clear next options.';

  const midTerm =
    'Mid-turn objective: include NPC reaction, environmental consequence, and explicit player options.';

  return {
    longHorizon: personalityText,
    midTerm: midTerm,
    shortTerm: scenarioText,
    combined: personalityText + '\n\n' + midTerm + '\n\n' + scenarioText
  };
}

export { mapBasicFantasyJanitorAI };
