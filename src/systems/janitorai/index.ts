/**
 * Janitor AI system adapter.
 *
 * Janitor AI only allows modifying `context.character.personality` and
 * `context.character.scenario` fields for prompting the AI. It does not
 * have a persistent state mechanism, so state is stored in the scenario
 * field as a JSON block.
 */

import { SystemAdapter, OutputPrompt } from '../../types';

class JanitorAIAdapter implements SystemAdapter {
  readonly name: string = 'Janitor AI';

  getPlayerMessage(context: Record<string, unknown>): string | null {
    // Janitor AI provides the chat history; the last user message
    // is typically the most recent entry in the messages array.
    const chat = context['chat'] as Array<Record<string, string>> | undefined;
    if (!chat || chat.length === 0) {
      return null;
    }
    const lastMessage = chat[chat.length - 1];
    if (lastMessage && lastMessage['role'] === 'user') {
      return lastMessage['content'] || null;
    }
    return null;
  }

  applyPrompt(context: Record<string, unknown>, prompt: OutputPrompt): void {
    // Janitor AI allows modifying character personality and scenario
    const character = (context['character'] || {}) as Record<string, unknown>;
    character['scenario'] = prompt.text;
    context['character'] = character;
  }

  loadState(context: Record<string, unknown>): Record<string, unknown> {
    // No dedicated persistence – store state as JSON in the scenario field
    const character = (context['character'] || {}) as Record<string, unknown>;
    const personality = (character['personality'] || '') as string;
    const stateMatch = personality.match(/\[GAME_STATE\]([\s\S]*?)\[\/GAME_STATE\]/);
    if (stateMatch) {
      try {
        return JSON.parse(stateMatch[1]) as Record<string, unknown>;
      } catch (_e) {
        return {};
      }
    }
    return {};
  }

  saveState(context: Record<string, unknown>, state: Record<string, unknown>): void {
    const character = (context['character'] || {}) as Record<string, unknown>;
    let personality = (character['personality'] || '') as string;
    const stateJson = JSON.stringify(state);
    const stateBlock = '[GAME_STATE]' + stateJson + '[/GAME_STATE]';

    // Replace existing state block or append
    if (personality.indexOf('[GAME_STATE]') !== -1) {
      personality = personality.replace(
        /\[GAME_STATE\][\s\S]*?\[\/GAME_STATE\]/,
        stateBlock
      );
    } else {
      personality = personality + '\n' + stateBlock;
    }
    character['personality'] = personality;
    context['character'] = character;
  }
}

export { JanitorAIAdapter };
