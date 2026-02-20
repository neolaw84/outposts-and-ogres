/**
 * SillyTavern system adapter.
 *
 * SillyTavern provides access to chat messages and allows modifying
 * the system prompt and character card fields for prompting the AI.
 * State can be persisted via the extension data mechanism.
 */

import { SystemAdapter, OutputPrompt, ScenarioUpdate } from '../../types';
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

  applyPrompt(prompt: OutputPrompt): void {
    // SillyTavern allows modifying the system prompt and character description
    this.context['systemPrompt'] = prompt.channels.combined;
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
   * SillyTavern chat array and return it as a `ScenarioUpdate`.
   * SillyTavern chat messages use `is_user` ('true'/'false') and `mes` fields.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): ScenarioUpdate | null {
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

  deducePlayerIntent(rawMessage: string, availableActions: string[]): import('../../types').ParsedAction | null {
    return null; // To be implemented later via SillyTavern hidden prompt injection
  }
}

export { SillyTavernAdapter };
