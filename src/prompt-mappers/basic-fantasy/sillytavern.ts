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
  const actionEvent = getEvent(events, 'action_resolution');
  const choicesEvent = getEvent(events, 'available_choices');

  const longHorizon =
    'Scene continuity: preserve consistent world logic, prior consequences, and condition transitions. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '.';

  const midTerm =
    'Narration plan: describe action outcome, NPC response, and transition to the next decision point for the player.';

  const shortTerm = actionEvent
    ? 'Action=' + actionEvent.action +
    (actionEvent.target ? ' target=' + actionEvent.target : '') +
    '; Logs=' + (actionEvent.mechanicsLogs && actionEvent.mechanicsLogs.length > 0 ? actionEvent.mechanicsLogs.join(' | ') : 'none') +
    '; Status=' + actionEvent.status +
    '; Cue=' + (actionEvent.narrationGuidance && actionEvent.narrationGuidance.length > 0 ? actionEvent.narrationGuidance.join(' | ') : 'none') +
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
