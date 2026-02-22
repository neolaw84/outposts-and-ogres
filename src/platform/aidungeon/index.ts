import { Platform, NarrationSummary, NarrationDirective, State, Signal, SignalDetector } from '../../types';
import { extractNarrationSummary } from '../../utils/llm-utils';
import { collectDirectiveArrays } from '../helpers';

interface HistoryEntry {
  type?: string;
  text?: string;
  [key: string]: unknown;
}

class AIDungeonAdapter implements Platform {
  readonly name: string = 'AI Dungeon';
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  getPlayerMessage(): string | null {
    const text = this.context['text'] as string | undefined;
    return text || null;
  }

  loadState(): Record<string, unknown> {
    const state = this.context['state'] as Record<string, unknown> | undefined;
    if (state && state['gameState']) {
      return state['gameState'] as Record<string, unknown>;
    }
    return {};
  }

  saveState(state: Record<string, unknown>): void {
    const globalState = (this.context['state'] || {}) as Record<string, unknown>;
    globalState['gameState'] = state;
    this.context['state'] = globalState;
  }

  getScenarioUpdate(): NarrationSummary | null {
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
          effects: (raw['effects'] as Signal[]) || []
        };
      }
    }
    return null;
  }

  deducePlayerIntent(rawMessage: string, detectors: SignalDetector[]): Signal[] | null {
    return null; // To be implemented later
  }

  applyGamePlayOutput(
    directives: NarrationDirective[],
    state: State,
    effectInstructions: string
  ): void {
    const globalState = (this.context['state'] || {}) as Record<string, unknown>;
    const memory = (globalState['memory'] || {}) as Record<string, unknown>;

    const { mustLines, mustNotLines, mayLines } = collectDirectiveArrays(directives);

    const contextParts: string[] = [];
    if (mustLines.length > 0) { contextParts.push('MUST:\n' + mustLines.join('\n')); }
    if (mustNotLines.length > 0) { contextParts.push('MUST NOT:\n' + mustNotLines.join('\n')); }
    memory['context'] = contextParts.join('\n');

    memory['authorsNote'] = mayLines.length > 0 ? 'MAY:\n' + mayLines.join('\n') : '';
    memory['frontMemory'] = effectInstructions;

    globalState['memory'] = memory;
    this.context['state'] = globalState;
  }
}

export { AIDungeonAdapter };
