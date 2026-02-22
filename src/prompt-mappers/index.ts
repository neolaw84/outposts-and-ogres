import { PromptInstructions, TurnEvent } from '../types';

type PromptMapper = (events: TurnEvent[]) => PromptInstructions;

function buildGenericPrompt(events: TurnEvent[]): PromptInstructions {
  let action = 'an action';
  let target = '';
  let rollSummary = '';
  let choices = '';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === 'action_resolution') {
      action = event.action;
      target = event.target || '';
      rollSummary =
        ' Logs: ' + (event.mechanicsLogs && event.mechanicsLogs.length > 0 ? event.mechanicsLogs.join(' | ') : 'none') +
        ' Status: ' + event.status + '.';
    }
    if (event.type === 'available_choices') {
      choices = event.choices.join(', ');
    }
  }

  const targetText = target ? ' targeting ' + target : '';
  const immediateInstruction =
    'Resolve: player attempts ' + action + targetText + '.' +
    rollSummary +
    (choices ? ' Next choices: ' + choices + '.' : '');

  const combined =
    'Maintain continuity of scene conditions and long-term stakes.\n\n' +
    'Narrate outcomes and present meaningful next choices.\n\n' +
    immediateInstruction;

  return {
    campaignContinuity: 'Maintain continuity of scene conditions and long-term stakes.',
    sceneGuidance: 'Narrate outcomes and present meaningful next choices.',
    immediateInstruction: immediateInstruction,
    combined: combined
  };
}

export { PromptMapper, buildGenericPrompt };
