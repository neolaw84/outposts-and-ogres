/**
 * SillyTavern system adapter.
 *
 * SillyTavern provides access to chat messages and allows modifying
 * the system prompt and character card fields for prompting the AI.
 * State can be persisted via the extension data mechanism.
 */

import { SystemAdapter, WorldSimulationUpdate, GamePlayEvent, GameState, WorldEventTracker } from '../../types';
import { extractNarrationSummary } from '../../utils/llm-utils';

class SillyTavernAdapter implements SystemAdapter {
  readonly name: string = 'SillyTavern';
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  getPlayerMessage(): string | null {
    // SillyTavern provides chat as an array of message objects
    const chat = this.context['chat'] as Array<Record<string, string>> | undefined;
    if (!chat || chat.length === 0) {
      return null;
    }
    const lastMessage = chat[chat.length - 1];
    if (lastMessage && lastMessage['is_user'] === 'true') {
      return lastMessage['mes'] || null;
    }
    return null;
  }

  loadState(): Record<string, unknown> {
    // SillyTavern extension data for persistence
    const extensionData = this.context['extensionData'] as Record<string, unknown> | undefined;
    if (extensionData && extensionData['gameState']) {
      return extensionData['gameState'] as Record<string, unknown>;
    }
    return {};
  }

  saveState(state: Record<string, unknown>): void {
    const extensionData = (this.context['extensionData'] || {}) as Record<string, unknown>;
    extensionData['gameState'] = state;
    this.context['extensionData'] = extensionData;
  }

  /**
   * Extract the [NARRATION_SUMMARY] JSON from the last AI message in the
   * SillyTavern chat array and return it as a `WorldSimulationUpdate`.
   * SillyTavern chat messages use `is_user` ('true'/'false') and `mes` fields.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): WorldSimulationUpdate | null {
    const chat = this.context['chat'] as Array<Record<string, string>> | undefined;
    if (!chat || chat.length === 0) {
      return null;
    }

    for (let i = chat.length - 1; i >= 0; i--) {
      // SillyTavern represents the is_user field as the string 'true'/'false'.
      if (chat[i]['is_user'] !== 'true') {
        const raw = extractNarrationSummary(chat[i]['mes'] || null);
        if (!raw) {
          continue;
        }
        return {
          elapsed_time: (raw['elapsed_time'] as string) || 'PT0S',
          flags: (raw['flags'] as Record<string, number>) || {},
          tags: (raw['tags'] as Record<string, string>) || {},
          meters: (raw['meters'] as Record<string, number>) || {},
          effects: (raw['effects'] as Array<Record<string, unknown>>) || []
        };
      }
    }
    return null;
  }

  deducePlayerIntent(rawMessage: string, availableActions: string[]): import('../../types').ParsedAction[] | null {
    return null; // To be implemented later via SillyTavern hidden prompt injection
  }

  applyGamePlayOutput(
    events: GamePlayEvent[],
    state: GameState,
    conditionsToReportBack: WorldEventTracker[]
  ): void {
    const lines: string[] = [];
    for (let i = 0; i < events.length; i++) {
      const gpe = events[i];
      for (let j = 0; j < gpe.mustHappen.length; j++) {
        lines.push('MUST: ' + gpe.mustHappen[j]);
      }
      for (let j = 0; j < gpe.mustNotHappen.length; j++) {
        lines.push('MUST NOT: ' + gpe.mustNotHappen[j]);
      }
      for (let j = 0; j < gpe.mayHappen.length; j++) {
        lines.push('MAY: ' + gpe.mayHappen[j]);
      }
    }

    if (conditionsToReportBack.length > 0) {
      lines.push('');
      for (let i = 0; i < conditionsToReportBack.length; i++) {
        const def = conditionsToReportBack[i];
        const jsonBlock: Record<string, unknown> = {};
        const keys = Object.keys(def);
        for (let j = 0; j < keys.length; j++) {
          if (keys[j] !== 'condition') {
            jsonBlock[keys[j]] = def[keys[j]];
          }
        }
        lines.push('If ' + def.condition + ', include: ' + JSON.stringify(jsonBlock));
      }
    }

    this.context['systemPrompt'] = lines.join('\n');
  }
}

export { SillyTavernAdapter };
