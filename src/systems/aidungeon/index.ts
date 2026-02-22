/**
 * AI Dungeon system adapter.
 *
 * AI Dungeon provides a better persistence system by defining JSON objects
 * under the global variable `state`. It also provides `info` and `memory`
 * fields for influencing AI behaviour.
 */

import { SystemAdapter, OutputPrompt, WorldSimulationUpdate, GamePlayEvent, GameState, WorldEventTracker } from '../../types';
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
    memory['context'] = prompt.channels.campaignContinuity;
    memory['authorsNote'] = prompt.channels.sceneGuidance;
    memory['frontMemory'] = prompt.channels.immediateInstruction;
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
   * entry and return it as a `WorldSimulationUpdate`.
   * AI Dungeon exposes narration via `context.history` where entries with
   * `type === 'story'` are AI-generated.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): WorldSimulationUpdate | null {
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

  deducePlayerIntent(rawMessage: string, availableActions: string[]): import('../../types').ParsedAction[] | null {
    return null; // To be implemented later
  }

  applyGamePlayOutput(
    events: GamePlayEvent[],
    state: GameState,
    conditionsToReportBack: WorldEventTracker[]
  ): void {
    const globalState = (this.context['state'] || {}) as Record<string, unknown>;
    const memory = (globalState['memory'] || {}) as Record<string, unknown>;

    const mustLines: string[] = [];
    const mustNotLines: string[] = [];
    const mayLines: string[] = [];

    for (let i = 0; i < events.length; i++) {
      const gpe = events[i];
      for (let j = 0; j < gpe.mustHappen.length; j++) {
        mustLines.push(gpe.mustHappen[j]);
      }
      for (let j = 0; j < gpe.mustNotHappen.length; j++) {
        mustNotLines.push(gpe.mustNotHappen[j]);
      }
      for (let j = 0; j < gpe.mayHappen.length; j++) {
        mayLines.push(gpe.mayHappen[j]);
      }
    }

    let reportBack = '';
    if (conditionsToReportBack.length > 0) {
      const parts: string[] = [];
      for (let i = 0; i < conditionsToReportBack.length; i++) {
        const def = conditionsToReportBack[i];
        const jsonBlock: Record<string, unknown> = {};
        const keys = Object.keys(def);
        for (let j = 0; j < keys.length; j++) {
          if (keys[j] !== 'condition') {
            jsonBlock[keys[j]] = def[keys[j]];
          }
        }
        parts.push('If ' + def.condition + ', include: ' + JSON.stringify(jsonBlock));
      }
      reportBack = parts.join('\n');
    }

    memory['context'] = (mustLines.length > 0 ? 'MUST:\n' + mustLines.join('\n') + '\n' : '') +
      (mustNotLines.length > 0 ? 'MUST NOT:\n' + mustNotLines.join('\n') + '\n' : '');
    memory['authorsNote'] = mayLines.length > 0 ? 'MAY:\n' + mayLines.join('\n') : '';
    memory['frontMemory'] = reportBack;
    globalState['memory'] = memory;
    this.context['state'] = globalState;
  }
}

export { AIDungeonAdapter };
