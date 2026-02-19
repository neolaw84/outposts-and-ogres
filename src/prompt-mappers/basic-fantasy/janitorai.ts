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

/**
 * Build the [NARRATION_GUIDE] section that instructs the LLM how to
 * narrate the current turn. It tells the LLM:
 * - Do NOT resolve the outcome of combat actions on behalf of the player.
 * - Narrate the player's action faithfully.
 * - Narrate NPC actions and reactions.
 * - Keep the narration aligned with the dice result.
 */
function buildNarrationGuide(
  diceEvent: Extract<TurnEvent, { type: 'dice_resolution' }> | null,
  cueEvent: Extract<TurnEvent, { type: 'narrative_cue' }> | null,
  choicesEvent: Extract<TurnEvent, { type: 'available_choices' }> | null
): string {
  const lines: string[] = [];
  lines.push('[NARRATION_GUIDE]');

  if (diceEvent) {
    lines.push(
      '{{user}} attempted to ' + diceEvent.action +
      (diceEvent.target ? ' on ' + diceEvent.target : '') + '.'
    );
    lines.push(
      'Dice result: ' + diceEvent.rollTotal + ' vs difficulty ' + diceEvent.difficulty +
      ' => ' + (diceEvent.success ? 'SUCCESS' : 'FAILURE') + '.'
    );

    if (diceEvent.action === 'attack' || diceEvent.action === 'cast' ||
        diceEvent.action === 'dodge' || diceEvent.action === 'defend' ||
        diceEvent.action === 'flee') {
      lines.push(
        'DO NOT resolve the final outcome of this combat action for {{user}}. ' +
        'Narrate {{user}}\'s action and the NPC\'s reaction/counter-action.'
      );
    }
  }

  if (cueEvent) {
    lines.push(cueEvent.cue);
  }

  if (choicesEvent && choicesEvent.choices.length > 0) {
    lines.push(
      'After narrating, present the following options to {{user}}: ' +
      choicesEvent.choices.join(', ') + '.'
    );
  }

  lines.push('[/NARRATION_GUIDE]');
  return lines.join('\n');
}

/**
 * Build instructions that tell the LLM how to construct a
 * [NARRATION_SUMMARY] JSON block at the end of its response.
 * Each NPC action type has its own schema fragment so the LLM
 * knows exactly what JSON to produce.
 */
function buildNarrationSummaryInstructions(
  diceEvent: Extract<TurnEvent, { type: 'dice_resolution' }> | null
): string {
  const lines: string[] = [];
  lines.push(
    'At the END of your narration, include a [NARRATION_SUMMARY] block ' +
    'containing a JSON object that summarises what NPCs did this turn. ' +
    'The JSON must be valid and plain (no encoding). Format:'
  );
  lines.push('');
  lines.push('[NARRATION_SUMMARY]');
  lines.push('{');
  lines.push('  "elapsed_time": "<ISO 8601 duration, e.g. PT10M>",');
  lines.push('  "npc_actions": [');
  lines.push('    {');
  lines.push('      "npc": "<NPC name>",');
  lines.push('      "action": "<what the NPC did>",');
  lines.push('      "target": "<target of the action or null>"');
  lines.push('    }');
  lines.push('  ],');
  lines.push('  "outcome": "<brief description of what happened>"');
  lines.push('}');
  lines.push('[/NARRATION_SUMMARY]');

  if (diceEvent) {
    lines.push('');
    lines.push('NPC action type instructions:');
    lines.push(
      '- If an NPC attacks, set action to "attack" and target to the recipient.'
    );
    lines.push(
      '- If an NPC defends or dodges, set action to "defend" or "dodge" respectively.'
    );
    lines.push(
      '- If an NPC casts a spell, set action to "cast" and target to the spell target.'
    );
    lines.push(
      '- If an NPC flees, set action to "flee" and target to null.'
    );
    lines.push(
      '- If an NPC speaks or bargains, set action to "speak" and include what they said in outcome.'
    );
  }

  return lines.join('\n');
}

function mapBasicFantasyJanitorAI(events: TurnEvent[]): PromptChannels {
  const inputEvent = getEvent(events, 'player_input');
  const diceEvent = getEvent(events, 'dice_resolution');
  const choicesEvent = getEvent(events, 'available_choices');
  const cueEvent = getEvent(events, 'narrative_cue');

  // Long-horizon: persistent guidance prepended to personality.
  const personalityText =
    'Persistent guidance: Maintain tone continuity, respect condition logic, and carry forward player emotional state. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '. ' +
    'Emotions=' + (inputEvent && inputEvent.emotions.length > 0
      ? inputEvent.emotions.map(function (signal) { return signal.emotion; }).join(', ')
      : 'none') + '.';

  // Mid-term: instructions for upcoming narration behaviour.
  const midTerm =
    'Mid-turn objective: include NPC reaction, environmental consequence, and explicit player options.';

  // Short-term: [NARRATION_GUIDE] + NARRATION_SUMMARY instructions,
  // prepended/appended to scenario.
  const narrationGuide = buildNarrationGuide(diceEvent, cueEvent, choicesEvent);
  const summaryInstructions = buildNarrationSummaryInstructions(diceEvent);
  const scenarioText = narrationGuide + '\n\n' + summaryInstructions;

  return {
    longHorizon: personalityText,
    midTerm: midTerm,
    shortTerm: scenarioText,
    combined: personalityText + '\n\n' + midTerm + '\n\n' + scenarioText
  };
}

export { mapBasicFantasyJanitorAI };
