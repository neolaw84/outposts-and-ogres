import { PromptInstructions, TurnEvent, WorldEventTracker } from '../../types';

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
  actionEvents: Extract<TurnEvent, { type: 'action_resolution' }>[],
  choicesEvent: Extract<TurnEvent, { type: 'available_choices' }> | null,
  effectNarrationGuide?: string,
  turnEndTriggers?: string[],
  inGameDateTime?: string
): string {
  const lines: string[] = [];
  lines.push('[NARRATION_GUIDE]');

  if (inGameDateTime) {
    lines.push('"In-Game Date/Time: ' + inGameDateTime + '."');
    lines.push('');
  }

  if (actionEvents.length > 0) {
    for (let i = 0; i < actionEvents.length; i++) {
      const ae = actionEvents[i];
      if (ae.action && ae.action !== 'world_event') {
        lines.push(
          'Event (' + ae.action + (ae.target ? ' on ' + ae.target : '') + '):'
        );
      }

      if (ae.mechanicsLogs && ae.mechanicsLogs.length > 0) {
        lines.push('Mechanics logs: ' + ae.mechanicsLogs.join(' '));
      }

      lines.push('Outcome status: ' + ae.status.toUpperCase() + '.');

      if (ae.narrationGuidance && ae.narrationGuidance.length > 0) {
        lines.push('Narration guidance: ' + ae.narrationGuidance.join(' '));
      }

      if (ae.action === 'attack' || ae.action === 'cast' ||
        ae.action === 'dodge' || ae.action === 'defend' ||
        ae.action === 'flee') {
        lines.push(
          'DO NOT resolve the final outcome of this combat action for {{user}}. ' +
          'Narrate {{user}}\'s action and the NPC\'s reaction/counter-action.'
        );
      }
      lines.push('');
    }
  }

  if (effectNarrationGuide) {
    lines.push('');
    lines.push(effectNarrationGuide);
  }

  if (turnEndTriggers && turnEndTriggers.length > 0) {
    lines.push('');
    lines.push('If any of the following events occur, you MUST narrate it briefly and then IMMEDIATELY END this turn (provide NARRATION_SUMMARY):');
    for (let i = 0; i < turnEndTriggers.length; i++) {
      lines.push('- ' + turnEndTriggers[i]);
    }
    lines.push('Do not narrate past these events. Wait for the script to process them.');
  }

  if (choicesEvent && choicesEvent.choices.length > 0) {
    lines.push(
      'After narrating, present the following options to {{user}}: ' +
      choicesEvent.choices.join(', ') + '.'
    );
  }

  lines.push('[/NARRATION_GUIDE]');
  lines.push('');
  lines.push('**YOU MUST NEVER CONTRADICT OR CONFLICT WITH ANY PART OF THE NARRATION GUIDE.**');
  lines.push('');
  lines.push("However, feel free to be creative and add more details to the story as long as it doesn't conflict with the narration guide.");
  return lines.join('\n');
}

/**
 * Build instructions that tell the LLM how to construct a
 * [NARRATION_SUMMARY] JSON block at the end of its response.
 * Includes effect-based instructions from the cartridge.
 */
function buildNarrationSummaryInstructions(
  actionEvents: Extract<TurnEvent, { type: 'action_resolution' }>[],
  worldEventTrackers?: WorldEventTracker[]
): string {
  const lines: string[] = [];
  lines.push(
    'At the END of your narration, include a [NARRATION_SUMMARY] block ' +
    'containing a JSON object that summarises what happened this turn. ' +
    'The JSON must be valid and plain (no encoding). Format:'
  );
  lines.push('');
  lines.push('[NARRATION_SUMMARY]');
  lines.push('{');
  lines.push('  "elapsed_time": "<ISO 8601 duration, e.g. PT10M>",');
  lines.push('  "effects": [');
  lines.push('    // Include effect entries as described below');
  lines.push('  ]');
  lines.push('}');
  lines.push('[/NARRATION_SUMMARY]');

  // Add effect definition instructions
  if (worldEventTrackers && worldEventTrackers.length > 0) {
    lines.push('');
    lines.push('Effect instructions - include matching entries in the "effects" array when conditions are met:');
    for (let i = 0; i < worldEventTrackers.length; i++) {
      const def = worldEventTrackers[i];
      const jsonBlock: Record<string, unknown> = {};
      const keys = Object.keys(def);
      for (let j = 0; j < keys.length; j++) {
        if (keys[j] !== 'condition') {
          jsonBlock[keys[j]] = def[keys[j]];
        }
      }
      lines.push('');
      lines.push('If and only if ' + def.condition + ', include:');
      lines.push(JSON.stringify(jsonBlock, null, 4));
    }
  }

  if (actionEvents.length > 0) {
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

function mapBasicFantasyJanitorAI(events: TurnEvent[]): PromptInstructions {
  const inputEvent = getEvent(events, 'player_input');
  const actionEvents = events.filter(e => e.type === 'action_resolution') as Extract<TurnEvent, { type: 'action_resolution' }>[];
  const choicesEvent = getEvent(events, 'available_choices');

  // Long-horizon: persistent guidance prepended to personality.
  const personalityText =
    'Persistent guidance: Maintain tone continuity, respect condition logic, and carry forward player emotional state. ' +
    'Condition=' + (inputEvent ? inputEvent.condition : 'unknown') + '. ' +
    'Emotions=' + (inputEvent && inputEvent.emotions.length > 0
      ? inputEvent.emotions.map(function (signal) { return signal.emotion; }).join(', ')
      : 'none') + '.';

  // Mid-term: instructions for upcoming narration behaviour.
  const sceneGuidance =
    'Mid-turn objective: include NPC reaction, environmental consequence, and explicit player options.';

  // Short-term: [NARRATION_GUIDE] + NARRATION_SUMMARY instructions,
  // prepended/appended to scenario.
  const narrationGuide = buildNarrationGuide(actionEvents, choicesEvent);
  const summaryInstructions = buildNarrationSummaryInstructions(actionEvents);
  const scenarioText = narrationGuide + '\n\n' + summaryInstructions;

  return {
    campaignContinuity: personalityText,
    sceneGuidance: sceneGuidance,
    immediateInstruction: scenarioText,
    combined: personalityText + '\n\n' + sceneGuidance + '\n\n' + scenarioText
  };
}

export { mapBasicFantasyJanitorAI, buildNarrationGuide, buildNarrationSummaryInstructions };
