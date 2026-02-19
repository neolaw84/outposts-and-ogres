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
  content?: string;
  [key: string]: unknown;
}

class JanitorAIAdapter implements SystemAdapter {
  readonly name: string = 'Janitor AI';

  // ------------------------------------------------------------------
  // Player input
  // ------------------------------------------------------------------

  getPlayerMessage(context: Record<string, unknown>): string | null {
    const chat = context['chat'] as Record<string, unknown> | undefined;
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
      if (lastMsg && lastMsg['content']) {
        return lastMsg['content'] as string;
      }
    }

    return null;
  }

  // ------------------------------------------------------------------
  // Prompt application
  // ------------------------------------------------------------------

  applyPrompt(context: Record<string, unknown>, prompt: OutputPrompt): void {
    const character = (context['character'] || {}) as Record<string, unknown>;
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

    context['character'] = character;
  }

  // ------------------------------------------------------------------
  // State persistence (Base64 inside [RP_STATE] tags)
  // ------------------------------------------------------------------

  loadState(context: Record<string, unknown>): Record<string, unknown> {
    const chat = context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return {};
    }

    // The previous LLM response is the second-last item in last_messages.
    const messages = chat['last_messages'] as Array<ChatMessage> | undefined;
    if (!messages || messages.length < 2) {
      return {};
    }

    const prevResponse = messages[messages.length - 2];
    if (!prevResponse || !prevResponse['content']) {
      return {};
    }

    const decoded = decodeState(prevResponse['content'] as string);
    return decoded || {};
  }

  saveState(context: Record<string, unknown>, state: Record<string, unknown>): void {
    const character = (context['character'] || {}) as Record<string, unknown>;
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
    context['character'] = character;
  }

  // ------------------------------------------------------------------
  // Scenario update extraction
  // ------------------------------------------------------------------

  /**
   * Extract the [NARRATION_SUMMARY] JSON from the last LLM response and
   * return it as a `ScenarioUpdate`.
   * Returns null if no valid block is found.
   */
  getScenarioUpdate(context: Record<string, unknown>): ScenarioUpdate | null {
    const chat = context['chat'] as Record<string, unknown> | undefined;
    if (!chat) {
      return null;
    }

    const messages = chat['last_messages'] as Array<ChatMessage> | undefined;
    if (!messages || messages.length < 2) {
      return null;
    }

    const prevResponse = messages[messages.length - 2];
    if (!prevResponse || !prevResponse['content']) {
      return null;
    }

    const raw = extractNarrationSummary(prevResponse['content'] as string);
    if (!raw) {
      return null;
    }
    return {
      elapsed_time: (raw['elapsed_time'] as string) || 'PT0S',
      flags: (raw['flags'] as Record<string, number>) || {},
      tags: (raw['tags'] as Record<string, string>) || {},
      meters: (raw['meters'] as Record<string, number>) || {}
    };
  }
}

export { JanitorAIAdapter };
