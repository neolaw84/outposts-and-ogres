/**
 * SillyTavern system adapter.
 *
 * SillyTavern provides access to chat messages and allows modifying
 * the system prompt and character card fields for prompting the AI.
 * State can be persisted via the extension data mechanism.
 */

import { SystemAdapter, OutputPrompt } from '../../types';

class SillyTavernAdapter implements SystemAdapter {
  readonly name: string = 'SillyTavern';

  getPlayerMessage(context: Record<string, unknown>): string | null {
    // SillyTavern provides chat as an array of message objects
    const chat = context['chat'] as Array<Record<string, string>> | undefined;
    if (!chat || chat.length === 0) {
      return null;
    }
    const lastMessage = chat[chat.length - 1];
    if (lastMessage && lastMessage['is_user'] === 'true') {
      return lastMessage['mes'] || null;
    }
    return null;
  }

  applyPrompt(context: Record<string, unknown>, prompt: OutputPrompt): void {
    // SillyTavern allows modifying the system prompt and character description
    context['systemPrompt'] = prompt.channels.combined;
  }

  loadState(context: Record<string, unknown>): Record<string, unknown> {
    // SillyTavern extension data for persistence
    const extensionData = context['extensionData'] as Record<string, unknown> | undefined;
    if (extensionData && extensionData['gameState']) {
      return extensionData['gameState'] as Record<string, unknown>;
    }
    return {};
  }

  saveState(context: Record<string, unknown>, state: Record<string, unknown>): void {
    const extensionData = (context['extensionData'] || {}) as Record<string, unknown>;
    extensionData['gameState'] = state;
    context['extensionData'] = extensionData;
  }
}

export { SillyTavernAdapter };
