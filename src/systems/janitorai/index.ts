/**
 * Janitor AI system adapter.
 *
 * ## Environment characteristics
 *
 * Janitor AI Script has a single injection point: **before LLM call**.
 * The only mutable fields are `context.character.personality` and
 * `context.character.scenario` – and only via prepend/append.
 *
 * ## Storage
 *
 * There is no persistent storage.  Game state is serialised to JSON,
 * Base64-encoded (to stop the LLM from inspecting or modifying it),
 * and wrapped in `[RP_STATE]...[/RP_STATE]` tags.  The block is
 * prepended to `personality` with strict instructions for the LLM to
 * return it verbatim.  On the next turn the previous LLM response
 * (found at `context.chat.last_messages`, second-last item) is
 * searched for the `[RP_STATE]` block to recover the state.
 *
 * ## Input
 *
 * The player's last message is at `context.chat.last_messages` (last
 * item) or `context.chat.last_message` (singular).  These are
 * read-only objects.
 *
 * ## Prompting
 *
 * * `[RP_STATE]` instruction → prepended to personality.
 * * `[NARRATION_GUIDE]...[/NARRATION_GUIDE]` → prepended to scenario.
 *   Instructs the LLM to align narration with the guide (e.g. do not
 *   resolve combat outcomes, narrate player/NPC actions, etc.).
 * * Per-action NARRATION_SUMMARY construction instructions → appended
 *   to scenario so the LLM produces a plain-JSON summary block.
 */

import { SystemAdapter, OutputPrompt, ScenarioUpdate } from '../../types';
import { decodeState, buildRpStateBlock, extractNarrationSummary } from '../../utils/llm-utils';

/** Content of the last LLM response message. */
interface ChatMessage {
  message?: string;
}

class JanitorAIAdapter implements SystemAdapter {
  readonly name: string = 'Janitor AI';
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown>) {
    this.context = context;
  }

  // ------------------------------------------------------------------
  // Player input
  // ------------------------------------------------------------------

  getPlayerMessage(): string | null {
    const chat = this.context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return null;
    }

    // Try context.chat.last_message (singular) first.
    const singular = chat['last_message'] as string | undefined;
    if (singular) {
      return singular;
    }

    // Fall back to context.chat.last_messages (last item).
    const messages = chat['last_messages'] as Array<ChatMessage> | undefined;
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg['message']) {
        return lastMsg['message'] as string;
      }
    }

    return null;
  }

  // ------------------------------------------------------------------
  // Prompt application
  // ------------------------------------------------------------------

  applyPrompt(prompt: OutputPrompt): void {
    const character = (this.context['character'] || {}) as Record<string, unknown>;
    const existingPersonality = (character['personality'] || '') as string;
    const existingScenario = (character['scenario'] || '') as string;

    // Prepend long-horizon + mid-term guidance to personality.
    character['personality'] =
      prompt.channels.longHorizon + '\n\n' +
      prompt.channels.midTerm + '\n\n' +
      existingPersonality;

    // Prepend narration guide and append narration-summary instructions
    // to scenario (shortTerm contains both sections already composed
    // by the prompt mapper).
    character['scenario'] =
      prompt.channels.shortTerm + '\n\n' +
      existingScenario;

    this.context['character'] = character;
  }

  // ------------------------------------------------------------------
  // State persistence (Base64 inside [RP_STATE] tags)
  // ------------------------------------------------------------------

  loadState(): Record<string, unknown> {
    const chat = this.context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return {};
    }

    // The previous LLM response is the second-last item in last_messages.
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

    // Build the instruction that tells the LLM to return the block verbatim.
    const instruction =
      'IMPORTANT: The following block contains encoded game state. ' +
      'You MUST include it EXACTLY as-is in your response, without ' +
      'any modification whatsoever.\n' +
      stateBlock;

    // Replace an existing RP_STATE instruction or prepend a new one.
    const rpStateRegex = /[\s\S]*?\[RP_STATE\][\s\S]*?\[\/RP_STATE\]/;
    if (personality.indexOf('[RP_STATE]') !== -1) {
      personality = personality.replace(rpStateRegex, instruction);
    } else {
      personality = instruction + '\n\n' + personality;
    }

    character['personality'] = personality;
    this.context['character'] = character;
  }

  // ------------------------------------------------------------------
  // Scenario update extraction
  // ------------------------------------------------------------------

  /**
   * Extract the [NARRATION_SUMMARY] JSON from the last LLM response and
   * return it as a `ScenarioUpdate`.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(): ScenarioUpdate | null {
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
      effects: (raw['effects'] as Array<Record<string, unknown>>) || []
    };
  }

  deducePlayerIntent(rawMessage: string, availableActions: string[]): import('../../types').ParsedAction[] | null {
    return null; // To be implemented later
  }
}

export { JanitorAIAdapter };
