import { Platform, NarrationSummary, NarrationDirective, State, Signal, SignalDetector } from '../../types';
import { decodeState, buildRpStateBlock, extractNarrationSummary } from '../../utils/llm-utils';
import { formatDirectiveLines } from '../helpers';

interface ChatMessage {
  message?: string;
}

class JanitorAIAdapter implements Platform {
  readonly name: string = 'Janitor AI';
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  getPlayerMessage(): string | null {
    const chat = this.context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return null;
    }

    const singular = chat['last_message'] as string | undefined;
    if (singular) {
      return singular;
    }

    const messages = chat['last_messages'] as Array<ChatMessage> | undefined;
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg['message']) {
        return lastMsg['message'] as string;
      }
    }

    return null;
  }

  loadState(): Record<string, unknown> {
    const chat = this.context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return {};
    }

    // Previous LLM response is second-last in last_messages
    const messages = chat['last_messages'] as Array<ChatMessage> | undefined;
    if (!messages || messages.length < 2) {
      return {};
    }

    const prevResponse = messages[messages.length - 2];
    if (!prevResponse || !prevResponse['message']) {
      return {};
    }

    const decoded = decodeState(prevResponse['message'] as string);
    return decoded || {};
  }

  saveState(state: Record<string, unknown>): void {
    const character = (this.context['character'] || {}) as Record<string, unknown>;
    let personality = (character['personality'] || '') as string;

    const stateBlock = buildRpStateBlock(state);

    const instruction =
      'IMPORTANT: The following block contains encoded game state. ' +
      'You MUST include it EXACTLY as-is in your response, without ' +
      'any modification whatsoever.\n' +
      stateBlock;

    const rpStateRegex = /[\s\S]*?\[RP_STATE\][\s\S]*?\[\/RP_STATE\]/;
    if (personality.indexOf('[RP_STATE]') !== -1) {
      personality = personality.replace(rpStateRegex, instruction);
    } else {
      personality = instruction + '\n\n' + personality;
    }

    character['personality'] = personality;
    this.context['character'] = character;
  }

  getScenarioUpdate(): NarrationSummary | null {
    const chat = this.context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return null;
    }

    const messages = chat['last_messages'] as Array<ChatMessage> | undefined;
    if (!messages || messages.length < 2) {
      return null;
    }

    const prevResponse = messages[messages.length - 2];
    if (!prevResponse || !prevResponse['message']) {
      return null;
    }

    const raw = extractNarrationSummary(prevResponse['message'] as string);
    if (!raw) {
      return null;
    }
    return {
      elapsed_time: (raw['elapsed_time'] as string) || 'PT0S',
      flags: (raw['flags'] as Record<string, number>) || {},
      tags: (raw['tags'] as Record<string, string>) || {},
      meters: (raw['meters'] as Record<string, number>) || {},
      effects: (raw['effects'] as Signal[]) || []
    };
  }

  deducePlayerIntent(rawMessage: string, detectors: SignalDetector[]): Signal[] | null {
    return null; // To be implemented later
  }

  applyGamePlayOutput(
    directives: NarrationDirective[],
    state: State,
    effectInstructions: string
  ): void {
    const character = (this.context['character'] || {}) as Record<string, unknown>;
    const existingScenario = (character['scenario'] || '') as string;

    const lines: string[] = [];
    lines.push('[NARRATION_GUIDE]');
    lines.push(...formatDirectiveLines(directives));
    lines.push('[/NARRATION_GUIDE]');

    if (effectInstructions) {
      lines.push('');
      lines.push('[NARRATION_SUMMARY_INSTRUCTIONS]');
      lines.push(effectInstructions);
      lines.push('[/NARRATION_SUMMARY_INSTRUCTIONS]');
    }

    character['scenario'] = lines.join('\n') + '\n' + existingScenario;
    this.context['character'] = character;
  }
}

export function runJanitorAILoop(context: Record<string, unknown>, engine: import('../../engine').GameEngine) {
  if (typeof context === 'undefined') {
    return;
  }

  const adapter = new JanitorAIAdapter(context);
  const cartridge = engine.getCartridge();

  // Decode state and narration summary
  const loadedState = adapter.loadState();
  let rpState: State | null = (loadedState && (loadedState as Record<string, unknown>)['timestamp'])
    ? loadedState as unknown as State
    : null;
  const scenarioUpdate = adapter.getScenarioUpdate();

  const dataCorrupted = !rpState || !rpState.timestamp;

  if (!rpState || !rpState.timestamp) {
    rpState = JSON.parse(JSON.stringify(cartridge.defaultState)) as State;
  }

  let narrationSummary: Record<string, unknown> = {
    elapsed_time: 'PT1M',
    effects: []
  };
  if (scenarioUpdate) {
    narrationSummary = {
      elapsed_time: scenarioUpdate.elapsed_time || 'PT1M',
      effects: scenarioUpdate.effects || [],
      flags: scenarioUpdate.flags || {},
      tags: scenarioUpdate.tags || {},
      meters: scenarioUpdate.meters || {}
    };
  }

  // Process turn
  const playerMsg = adapter.getPlayerMessage();

  if (!dataCorrupted && playerMsg) {
    let preParsedIntents: import('../../types').Signal[] | null = null;
    if (adapter.deducePlayerIntent) {
      const deduced = adapter.deducePlayerIntent(playerMsg, cartridge.signalDetectors);
      if (!(deduced instanceof Promise)) {
        preParsedIntents = deduced;
      }
    }
    const turnResult = engine.executeTurn(playerMsg, rpState as State, narrationSummary, preParsedIntents);
    rpState = turnResult.newState;

    adapter.saveState(rpState as unknown as Record<string, unknown>);
    adapter.applyGamePlayOutput(turnResult.directives, rpState, turnResult.schemaInstructions);
  } else if (dataCorrupted) {
    const character = (context['character'] || {}) as Record<string, unknown>;
    character['personality'] = 'You are a fair game master that ALWAYS AND PROMPTLY INFORMS the player {{user}} when ' +
      'there is data corruption. After you have informed, the player will restart from 1 or 2 turns ago.';

    let corruptionInfo = 'Your next response must be to tell {{user}} that there is data corruption and ' +
      'she must restart from the corruption point.';

    const chat = context['chat'] as Record<string, unknown> | undefined;
    if (chat) {
      const msgs = chat['last_messages'] as Array<Record<string, unknown>> | undefined;
      if (msgs && msgs.length >= 3) {
        const msgToRetry = (msgs[msgs.length - 3]['message'] || '') as string;
        corruptionInfo += '\\n\\nHelp the user identify where to retry by quoting this message to delete and retry from:\\n"' +
          msgToRetry.substring(0, 200) + '..."';
      }
    }
    character['scenario'] = corruptionInfo;
    context['character'] = character;
  } else {
    adapter.saveState(rpState as unknown as Record<string, unknown>);
  }
}

export { JanitorAIAdapter };
