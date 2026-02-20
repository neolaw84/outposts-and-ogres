/**
 * AI Dungeon system adapter.
 *
 * AI Dungeon provides a better persistence system by defining JSON objects
 * under the global variable `state`. It also provides `info` and `memory`
 * fields for influencing AI behaviour.
 */

import { SystemAdapter, OutputPrompt, ScenarioUpdate } from '../../types';
import { extractNarrationSummary } from '../../utils/llm-utils';

/** A single entry in the AI Dungeon action history. */
interface HistoryEntry {
  type?: string;
  text?: string;
  [key: string]: unknown;
}

class AIDungeonAdapter implements SystemAdapter {
  readonly name: string = 'AI Dungeon';
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  getPlayerMessage(): string | null {
    // AI Dungeon provides the latest player input as `text`
    const text = this.context['text'] as string | undefined;
    return text || null;
  }

  applyPrompt(prompt: OutputPrompt): void {
    // AI Dungeon supports segmented memory channels
    const state = (this.context['state'] || {}) as Record<string, unknown>;
    const memory = (state['memory'] || {}) as Record<string, unknown>;
    memory['context'] = prompt.channels.longHorizon;
    memory['authorsNote'] = prompt.channels.midTerm;
    memory['frontMemory'] = prompt.channels.shortTerm;
    state['memory'] = memory;
    this.context['state'] = state;

    // Keep a single-field fallback for compatibility
    this.context['memory'] = prompt.text;
  }

  loadState(): Record<string, unknown> {
    // AI Dungeon provides persistent state via the `state` global object
    const state = this.context['state'] as Record<string, unknown> | undefined;
    if (state && state['gameState']) {
      return state['gameState'] as Record<string, unknown>;
    }
    return {};
  }

  saveState(state: Record<string, unknown>): void {
    // AI Dungeon persists via the `state` global object
    const globalState = (this.context['state'] || {}) as Record<string, unknown>;
    globalState['gameState'] = state;
    this.context['state'] = globalState;
  }

  /**
   * Extract the [NARRATION_SUMMARY] JSON from the last AI-authored history
   * entry and return it as a `ScenarioUpdate`.
   * AI Dungeon exposes narration via `context.history` where entries with
   * `type === 'story'` are AI-generated.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): ScenarioUpdate | null {
    const history = this.context['history'] as Array<HistoryEntry> | undefined;
    if (!history || !Array.isArray(history)) {
      return null;
    }

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i]['type'] === 'story') {
        const raw = extractNarrationSummary(history[i]['text'] || null);
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
}

export { AIDungeonAdapter };
