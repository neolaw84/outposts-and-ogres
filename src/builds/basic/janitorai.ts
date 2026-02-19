import { Character } from '../../character';
import { GamePlayScript } from '../../systems/game-play-script';
import { basicFantasyCartridge } from '../../cartridges/basic-fantasy';
import { mapBasicFantasyJanitorAI } from '../../prompt-mappers/basic-fantasy/janitorai';

class OutpostsAndOgres {
  private version: string;

  constructor() {
    this.version = '1.0.0';
  }

  public getVersion(): string {
    return this.version;
  }

  public createCharacter(name: string, maxHealth?: number): Character {
    return new Character(name, maxHealth);
  }

  public createGamePlayScript(): GamePlayScript {
    return new GamePlayScript(basicFantasyCartridge, mapBasicFantasyJanitorAI);
  }
}

const rpgSystem = new OutpostsAndOgres();

export default rpgSystem;
export { Character };
export { GamePlayScript } from '../../systems/game-play-script';
export { basicFantasyCartridge } from '../../cartridges/basic-fantasy';
export {
  Message,
  ParsedAction,
  DiceRollResult,
  ActionResult,
  CartridgeRule,
  GameCartridge,
  OutputPrompt,
  SystemAdapter
} from '../../types';
export { rollDie, rollDice, sumRolls } from '../../utils/dice';
export { parseActionInput } from '../../inputs/action-parser';
export { parsePlayerInput } from '../../utils/input-parser';
export { base64EncodeRaw, base64DecodeRaw, base64Encode, base64Decode } from '../../utils/base64';
export {
  encodeState,
  decodeState,
  buildRpStateBlock,
  extractNarrationSummary,
  generateEffectInstruction,
  findEffectByKey
} from '../../utils/llm-utils';
import { extractMatch } from '../../utils/text-utils';
import { JanitorAIAdapter } from '../../systems/janitorai/index';

export { extractMatch, JanitorAIAdapter };

// ------------------------------------------------------------------
// DRIVER SCRIPT
// ------------------------------------------------------------------

declare const context: Record<string, unknown>;

// Only execute if we are in the JanitorAI environment (context is present)
if (typeof context !== 'undefined') {
  const adapter = new JanitorAIAdapter();
  // rpgSystem is already instantiated above
  const script = rpgSystem.createGamePlayScript();

  // 1. INPUT
  const playerMsg = adapter.getPlayerMessage(context);

  if (playerMsg) {
    // 2. PROCESS & 3. OUTPUT
    // processTurn handles: input -> processing (dice) -> output (prompt generation)
    const prompt = script.processTurn(playerMsg);

    // 4. INJECT
    if (prompt) {
      adapter.applyPrompt(context, prompt);
    }
  }
}
