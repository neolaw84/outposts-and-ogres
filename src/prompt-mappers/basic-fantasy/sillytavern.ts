import { PromptInstructions, TurnEvent } from '../../types';

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

function mapBasicFantasySillyTavern(events: TurnEvent[]): PromptInstructions {
  const inputEvent = getEvent(events, 'player_input');
  const actionEvents = events.filter(e => e.type === 'action_resolution') as Extract<TurnEvent, { type: 'action_resolution' }>[];
  const choicesEvent = getEvent(events, 'available_choices');

  const campaignContinuity =
    'Scene continuity: preserve consistent world logic, prior consequences, and condition transitions. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '.';

  const sceneGuidance =
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

  let immediateInstruction = '';
  if (shortTermStrs.length > 0) {
    immediateInstruction = shortTermStrs.join(' || ') + '; Choices=' + (choicesEvent ? choicesEvent.choices.join(', ') : 'none') + '.';
  } else {
    immediateInstruction = 'Resolve the immediate turn and present clear follow-up choices.';
  }

  return {
    campaignContinuity: campaignContinuity,
    sceneGuidance: sceneGuidance,
    immediateInstruction: immediateInstruction,
    combined: campaignContinuity + '\n\n' + sceneGuidance + '\n\n' + immediateInstruction
  };
}

export { mapBasicFantasySillyTavern };
