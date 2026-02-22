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
  const actionEvents = events.filter(e => e.type === 'action_resolution') as Extract<TurnEvent, { type: 'action_resolution' }>[];
  const choicesEvent = getEvent(events, 'available_choices');

  const longHorizon =
    'Scene continuity: preserve consistent world logic, prior consequences, and condition transitions. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '.';

  const midTerm =
    'Narration plan: describe action outcome, NPC response, and transition to the next decision point for the player.';

  const shortTermStrs: string[] = [];
  for (let i = 0; i < actionEvents.length; i++) {
    const ae = actionEvents[i];
    shortTermStrs.push(
      'Action=' + ae.action +
      (ae.target ? ' target=' + ae.target : '') +
      '; Logs=' + (ae.mechanicsLogs && ae.mechanicsLogs.length > 0 ? ae.mechanicsLogs.join(' | ') : 'none') +
      '; Status=' + ae.status +
      '; Cue=' + (ae.narrationGuidance && ae.narrationGuidance.length > 0 ? ae.narrationGuidance.join(' | ') : 'none')
    );
  }

  let shortTerm = '';
  if (shortTermStrs.length > 0) {
    shortTerm = shortTermStrs.join(' || ') + '; Choices=' + (choicesEvent ? choicesEvent.choices.join(', ') : 'none') + '.';
  } else {
    shortTerm = 'Resolve the immediate turn and present clear follow-up choices.';
  }

  return {
    longHorizon: longHorizon,
    midTerm: midTerm,
    shortTerm: shortTerm,
    combined: longHorizon + '\n\n' + midTerm + '\n\n' + shortTerm
  };
}

export { mapBasicFantasySillyTavern };
