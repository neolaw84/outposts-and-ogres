import { Platform, NarrationSummary, NarrationDirective, State, Signal, SignalDetector } from '../../types';
import { extractNarrationSummary } from '../../utils/llm-utils';
import { formatDirectiveLines } from '../helpers';
import { SillyTavernHelper } from './types';
// @ts-ignore
import CustomHelper from '@platform-helper';
import { DefaultSillyTavernHelper } from './helper';

class SillyTavernAdapter implements Platform {
  readonly name: string = 'SillyTavern';
  private context: Record<string, unknown>;
  private helper: SillyTavernHelper;

  constructor(context: Record<string, unknown>, testHelper?: SillyTavernHelper) {
    this.context = context;
    let fallback = new DefaultSillyTavernHelper();
    this.helper = testHelper || (CustomHelper ? new (CustomHelper as any)() : fallback);
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
    const stGlobal = globalThis as any;
    const extensionData = stGlobal.SillyTavern?.getContext()?.chatMetadata?.['outposts-and-ogres-state'] as Record<string, unknown> | undefined;
    if (extensionData && extensionData['gameState']) {
      return extensionData['gameState'] as Record<string, unknown>;
    }
    return {};
  }

  saveState(state: Record<string, unknown>): void {
    const stGlobal = globalThis as any;
    const stContext = stGlobal.SillyTavern?.getContext();
    if (!stContext || !stContext.chatMetadata) return;

    const extensionData = (stContext.chatMetadata['outposts-and-ogres-state'] || {}) as Record<string, unknown>;
    extensionData['gameState'] = state;
    stContext.chatMetadata['outposts-and-ogres-state'] = extensionData;

    // Asynchronously save the metadata without blocking
    if (typeof stContext.saveMetadata === 'function') {
      stContext.saveMetadata();
    }
  }

  getScenarioUpdate(): NarrationSummary | null {
    // We now extract the scenario update directly from metadata if available, instead of parsing chat history every time,
    // since the MESSAGE_RECEIVED event handles extracting and persisting it.
    const stGlobal = globalThis as any;
    const stContext = stGlobal.SillyTavern?.getContext();
    if (!stContext || !stContext.chatMetadata) return null;

    const extensionData = (stContext.chatMetadata['outposts-and-ogres-state'] || {}) as Record<string, unknown>;
    const summary = extensionData['lastNarrationSummary'] as NarrationSummary | undefined;

    return summary || null;
  }

  deducePlayerIntent(rawMessage: string, detectors: SignalDetector[]): Signal[] | null {
    return null; // To be implemented later via SillyTavern hidden prompt injection
  }

  applyGamePlayOutput(
    directives: NarrationDirective[],
    state: State,
    effectInstructions: string
  ): void {
    let directivesBlock: string | undefined;
    let instructionsBlock: string | undefined;

    if (this.helper.beforeApplyGamePlayOutput) {
      const hookResult = this.helper.beforeApplyGamePlayOutput(directives, state, effectInstructions, this.context);
      directivesBlock = hookResult.directivesBlock;
      instructionsBlock = hookResult.instructionsBlock;
    }

    const lines: string[] = [];
    if (directivesBlock) lines.push(directivesBlock);
    if (instructionsBlock) {
      lines.push('');
      lines.push(instructionsBlock);
    }

    this.context['systemPrompt'] = lines.join('\n');
  }
}

export { SillyTavernAdapter };
