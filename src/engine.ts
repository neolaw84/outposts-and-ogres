import {
  Cartridge,
  NarrationDirective,
  State,
  RuleOutcome,
  TurnContext,
  SideEffect,
  SignalSchema,
  Signal
} from './types';
import { detectSignals } from './signals/detect';
import { applySideEffect, revertSideEffect } from './core/game-state';
import { addDuration, getMidnightsPassed } from './utils/time-utils';
import { validateSignalTypes, findSignalByKey, renderSchemaInstruction } from './utils/llm-utils';

class GameEngine {
  private cartridge: Cartridge;
  private currentCondition: string;

  constructor(cartridge: Cartridge) {
    this.cartridge = cartridge;
    this.currentCondition = cartridge.breakpoints.length > 0
      ? cartridge.breakpoints[0]
      : 'default';
  }

  public getCartridge(): Cartridge {
    return this.cartridge;
  }

  public setCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
    this.currentCondition = cartridge.breakpoints.length > 0
      ? cartridge.breakpoints[0]
      : 'default';
  }

  public getCondition(): string {
    return this.currentCondition;
  }

  public setCondition(condition: string): void {
    this.currentCondition = condition;
  }

  public detectSignals(playerMessage: string): Signal[] {
    return detectSignals(playerMessage, this.cartridge.signalDetectors);
  }

  /**
   * Run a complete turn. Every rule in ruleOrder is called (even without a
   * matching event) so that mustNotHappen entries can be emitted.
   */
  public executeTurn(
    playerMessage: string,
    currentState: State,
    narrationSummary: Record<string, unknown>,
    preParsedSignals?: Signal[] | null
  ): {
    newState: State;
    directives: NarrationDirective[];
    schemaInstructions: string;
  } {
    const allSignals = preParsedSignals || this.detectSignals(playerMessage);

    let newState = JSON.parse(JSON.stringify(currentState));

    // Time advance and expired effect reversion
    const typeChecks = validateSignalTypes(narrationSummary);
    let durationToAdd = 'PT0M';
    if (typeChecks['elapsed_time']) {
      durationToAdd = narrationSummary['elapsed_time'] as string;
    } else if (narrationSummary['elapsed_time'] && typeof narrationSummary['elapsed_time'] === 'string' &&
      (narrationSummary['elapsed_time'] as string).indexOf('P') === 0) {
      durationToAdd = narrationSummary['elapsed_time'] as string;
    }
    const newCurrentTime = addDuration(newState.timestamp, durationToAdd);
    newState.stats['num_day'] = (newState.stats['num_day'] || 0) +
      getMidnightsPassed(newState.timestamp, newCurrentTime);
    newState.timestamp = newCurrentTime;
    newState = revertSideEffect(newState);

    const directives: NarrationDirective[] = [];

    const sequence = this.cartridge.ruleOrder || [];
    for (const key of sequence) {
      if (this.cartridge.rules && this.cartridge.rules[key]) {
        const def = this.cartridge.signalSchemas.find(d => d.key === key);

        let foundEffect: Signal | null = null;
        let foundTypeCheck: Record<string, unknown> | null = null;
        if (def) {
          const found = findSignalByKey(key, narrationSummary, typeChecks);
          foundEffect = found.effect;
          foundTypeCheck = found.typeCheck;
        }

        const context: TurnContext = {
          playerSignals: allSignals.filter(e => e.key === key),
          currentCondition: this.currentCondition,
          ruleKey: key,
          worldSignal: foundEffect,
          typeCheck: foundTypeCheck,
          narrationSummary: narrationSummary
        };

        const result = this.cartridge.rules[key](newState, context);

        const gpe = this.buildNarrationDirective(key, result);
        directives.push(gpe);

        if (result) {
          if (result.stateMutations && result.stateMutations.length > 0) {
            for (let j = 0; j < result.stateMutations.length; j++) {
              newState = applySideEffect(newState, result.stateMutations[j]);
            }
          }
        }
      }
    }

    // Build schema instructions
    const instructionParts: string[] = [];
    for (const tracker of this.cartridge.signalSchemas) {
      const instruction = renderSchemaInstruction(tracker);
      if (instruction) {
        instructionParts.push(instruction);
      }
    }
    const schemaInstructions = instructionParts.join('\n\n');

    return {
      newState: newState,
      directives: directives,
      schemaInstructions: schemaInstructions
    };
  }

  private buildNarrationDirective(ruleKey: string, result: RuleOutcome | null): NarrationDirective {
    if (!result || !result.outcome) {
      return {
        ruleKey: ruleKey,
        mustHappen: [],
        mustNotHappen: [],
        mayHappen: []
      };
    }

    const o = result.outcome;

    return {
      ruleKey: ruleKey,
      mustHappen: o.mustHappen.slice(),
      mustNotHappen: o.mustNotHappen.slice(),
      mayHappen: o.mayHappen.slice()
    };
  }
}

export { GameEngine };
