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

function mapBasicFantasySillyTavern(events: TurnEvent[]): PromptChannels {
  const inputEvent = getEvent(events, 'player_input');
  const diceEvent = getEvent(events, 'dice_resolution');
  const choicesEvent = getEvent(events, 'available_choices');
  const cueEvent = getEvent(events, 'narrative_cue');

  const longHorizon =
    'Scene continuity: preserve consistent world logic, prior consequences, and condition transitions. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '.';

  const midTerm =
    'Narration plan: describe action outcome, NPC response, and transition to the next decision point for the player.';

  const shortTerm = diceEvent
    ? 'Action=' + diceEvent.action +
      (diceEvent.target ? ' target=' + diceEvent.target : '') +
      '; Roll=' + diceEvent.rollTotal +
      '; Difficulty=' + diceEvent.difficulty +
      '; Success=' + (diceEvent.success ? 'yes' : 'no') +
      '; Cue=' + (cueEvent ? cueEvent.cue : 'none') +
      '; Choices=' + (choicesEvent ? choicesEvent.choices.join(', ') : 'none') + '.'
    : 'Resolve the immediate turn and present clear follow-up choices.';

  return {
    longHorizon: longHorizon,
    midTerm: midTerm,
    shortTerm: shortTerm,
    combined: longHorizon + '\n\n' + midTerm + '\n\n' + shortTerm
  };
}

export { mapBasicFantasySillyTavern };
