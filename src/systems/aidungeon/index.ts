/**
 * AI Dungeon system adapter.
 *
 * AI Dungeon provides a better persistence system by defining JSON objects
 * under the global variable `state`. It also provides `info` and `memory`
 * fields for influencing AI behaviour.
 */

import { SystemAdapter, OutputPrompt } from '../../types';

class AIDungeonAdapter implements SystemAdapter {
  readonly name: string = 'AI Dungeon';

  getPlayerMessage(context: Record<string, unknown>): string | null {
    // AI Dungeon provides the latest player input as `text`
    const text = context['text'] as string | undefined;
    return text || null;
  }

  applyPrompt(context: Record<string, unknown>, prompt: OutputPrompt): void {
    // AI Dungeon supports segmented memory channels
    const state = (context['state'] || {}) as Record<string, unknown>;
    const memory = (state['memory'] || {}) as Record<string, unknown>;
    memory['context'] = prompt.channels.longHorizon;
    memory['authorsNote'] = prompt.channels.midTerm;
    memory['frontMemory'] = prompt.channels.shortTerm;
    state['memory'] = memory;
    context['state'] = state;

    // Keep a single-field fallback for compatibility
    context['memory'] = prompt.text;
  }

  loadState(context: Record<string, unknown>): Record<string, unknown> {
    // AI Dungeon provides persistent state via the `state` global object
    const state = context['state'] as Record<string, unknown> | undefined;
    if (state && state['gameState']) {
      return state['gameState'] as Record<string, unknown>;
    }
    return {};
  }

  saveState(context: Record<string, unknown>, state: Record<string, unknown>): void {
    // AI Dungeon persists via the `state` global object
    const globalState = (context['state'] || {}) as Record<string, unknown>;
    globalState['gameState'] = state;
    context['state'] = globalState;
  }
}

export { AIDungeonAdapter };
