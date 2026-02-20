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

function mapBasicFantasyAIDungeon(events: TurnEvent[]): PromptChannels {
  const inputEvent = getEvent(events, 'player_input');
  const actionEvent = getEvent(events, 'action_resolution');
  const choicesEvent = getEvent(events, 'available_choices');

  const emotions = inputEvent && inputEvent.emotions.length > 0
    ? inputEvent.emotions.map(function (signal) { return signal.emotion; }).join(', ')
    : 'none detected';

  const choices = choicesEvent ? choicesEvent.choices.join(', ') : 'none';

  const shortTerm = actionEvent
    ? 'Immediate render: The player attempts ' + actionEvent.action +
    (actionEvent.target ? ' targeting ' + actionEvent.target : '') +
    '. Logs: ' + (actionEvent.mechanicsLogs && actionEvent.mechanicsLogs.length > 0 ? actionEvent.mechanicsLogs.join(' | ') : 'none') +
    '. Outcome: ' + actionEvent.status + '. ' +
    (actionEvent.narrationGuidance && actionEvent.narrationGuidance.length > 0 ? actionEvent.narrationGuidance.join(' ') : '')
    : 'Immediate render: narrate the attempted action and consequence.';

  const midTerm =
    'Narration instruction: Continue the scene with NPC reactions and consequences, then end with explicit next choices. ' +
    'Current condition: ' + (inputEvent ? inputEvent.condition : 'unknown') + '. ' +
    'Player emotional signals: ' + emotions + '. ' +
    'Next choices: ' + choices + '.';

  const longHorizon =
    'Campaign continuity: Keep condition and stakes coherent with the current scene. ' +
    'Condition=' + (choicesEvent ? choicesEvent.condition : 'unknown') + '. ' +
    'Track recurring NPCs, unresolved threats, and player emotional tone over multiple turns.';

  return {
    longHorizon: longHorizon,
    midTerm: midTerm,
    shortTerm: shortTerm,
    combined: longHorizon + '\n\n' + midTerm + '\n\n' + shortTerm
  };
}

export { mapBasicFantasyAIDungeon };
