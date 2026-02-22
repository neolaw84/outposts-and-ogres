import { Platform, NarrationSummary, NarrationDirective, State, Signal, SignalDetector } from '../../types';
import { extractNarrationSummary } from '../../utils/llm-utils';
import { formatDirectiveLines } from '../helpers';

class SillyTavernAdapter implements Platform {
  readonly name: string = 'SillyTavern';
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  getPlayerMessage(): string | null {
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

  getScenarioUpdate(): NarrationSummary | null {
    const chat = this.context['chat'] as Array<Record<string, string>> | undefined;
    if (!chat || chat.length === 0) {
      return null;
    }

    for (let i = chat.length - 1; i >= 0; i--) {
      // SillyTavern uses string 'true'/'false' for is_user
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
          effects: (raw['effects'] as Signal[]) || []
        };
      }
    }
    return null;
  }

  deducePlayerIntent(rawMessage: string, detectors: SignalDetector[]): Signal[] | null {
    return null; // To be implemented later via SillyTavern hidden prompt injection
  }

  applyGamePlayOutput(
    directives: NarrationDirective[],
    state: State,
    effectInstructions: string
  ): void {
    const lines = formatDirectiveLines(directives);

    if (effectInstructions) {
      lines.push('');
      lines.push(effectInstructions);
    }

    this.context['systemPrompt'] = lines.join('\n');
  }
}

export { SillyTavernAdapter };
