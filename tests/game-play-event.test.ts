import { GamePlayScript } from '../src/systems/game-play-script';
import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { Cartridge, State, NarrationDirective, RuleOutcome } from '../src/types';

function makeSheet(overrides?: Partial<State>): State {
  return JSON.parse(JSON.stringify({
    ...basicFantasyCartridge.defaultState,
    ...overrides,
    stats: {
      ...basicFantasyCartridge.defaultState.stats,
      ...(overrides && overrides.stats ? overrides.stats : {})
    }
  }));
}

describe('NarrationDirective - standardized game play loop output', () => {
  describe('always-call-all-rules behavior', () => {
    test('executeTurn returns gamePlayEvents for every rule in the sequence', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('<attack goblin>', sheet, {});

      // gamePlayEvents should have one entry for every rule in the sequence
      expect(result.gamePlayEvents).toBeDefined();
      expect(result.gamePlayEvents.length).toBe(basicFantasyCartridge.ruleOrder.length);
    });

    test('gamePlayEvents contain mustNotHappen for untriggered rules', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('<attack goblin>', sheet, {});

      // drink_potion was not triggered, so it should have mustNotHappen
      const potionEvent = result.gamePlayEvents.find(e => e.ruleKey === 'drink_potion');
      expect(potionEvent).toBeDefined();
      expect(potionEvent!.mustNotHappen.length).toBeGreaterThan(0);
      expect(potionEvent!.mustNotHappen.join(' ')).toContain('potion');

      // travel was not triggered
      const travelEvent = result.gamePlayEvents.find(e => e.ruleKey === 'travel');
      expect(travelEvent).toBeDefined();
      expect(travelEvent!.mustNotHappen.length).toBeGreaterThan(0);
      expect(travelEvent!.mustNotHappen.join(' ')).toContain('traveling');
    });

    test('gamePlayEvents contain mustHappen for triggered action rules', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, strength: 100 } });
      const result = script.executeTurn('<attack goblin>', sheet, {});

      const attackEvent = result.gamePlayEvents.find(e => e.ruleKey === 'attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent!.mustHappen.length).toBeGreaterThan(0);
    });

    test('gamePlayEvents have correct structure', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('<attack goblin>', sheet, {});

      for (const gpe of result.gamePlayEvents) {
        expect(gpe.ruleKey).toBeDefined();
        expect(typeof gpe.ruleKey).toBe('string');
        expect(Array.isArray(gpe.mustHappen)).toBe(true);
        expect(Array.isArray(gpe.mustNotHappen)).toBe(true);
        expect(Array.isArray(gpe.mayHappen)).toBe(true);
      }
    });
  });

  describe('effectInstructions', () => {
    test('executeTurn returns effectInstructions generated from signalSchemas', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('<attack goblin>', sheet, {});

      expect(result.effectInstructions).toBeDefined();
      expect(typeof result.effectInstructions).toBe('string');
      // Should contain instructions generated from all 4 signalSchemas
      expect(result.effectInstructions).toContain('drink_potion');
      expect(result.effectInstructions).toContain('combat_event');
      expect(result.effectInstructions).toContain('travel');
      expect(result.effectInstructions).toContain('rest');
      expect(result.effectInstructions).toContain('if and only if');
      expect(result.effectInstructions).toContain('"effects" array');
    });
  });

  describe('mustHappen / mustNotHappen / mayHappen from world events', () => {
    test('drink_potion with effect data produces mustHappen', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, hp: 50 } });
      const narrationSummary = {
        elapsed_time: 'PT5M',
        effects: [{ key: 'drink_potion', what: 'healing', meters: { potency: 3 } }]
      };

      const result = script.executeTurn('', sheet, narrationSummary);

      const potionEvent = result.gamePlayEvents.find(e => e.ruleKey === 'drink_potion');
      expect(potionEvent).toBeDefined();
      expect(potionEvent!.mustHappen.length).toBeGreaterThan(0);
      expect(potionEvent!.mustHappen.join(' ')).toContain('Healed 30 HP');
    });

    test('drink_potion without effect data produces mustNotHappen and mayHappen', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();

      const result = script.executeTurn('', sheet, {});

      const potionEvent = result.gamePlayEvents.find(e => e.ruleKey === 'drink_potion');
      expect(potionEvent).toBeDefined();
      expect(potionEvent!.mustNotHappen.length).toBeGreaterThan(0);
      expect(potionEvent!.mustNotHappen.join(' ')).toContain('drinking a potion');
      expect(potionEvent!.mayHappen.length).toBeGreaterThan(0);
      expect(potionEvent!.mayHappen.join(' ')).toContain('potion');
    });

    test('combat_event without effect data produces mustNotHappen', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();

      const result = script.executeTurn('', sheet, {});

      const combatEvent = result.gamePlayEvents.find(e => e.ruleKey === 'combat_event');
      expect(combatEvent).toBeDefined();
      expect(combatEvent!.mustNotHappen.length).toBeGreaterThan(0);
      expect(combatEvent!.mustNotHappen.join(' ')).toContain('combat');
    });
  });

  describe('player action mustNotHappen', () => {
    test('untriggered player actions have mustNotHappen entries', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      // Only attacking - all other actions should have mustNotHappen
      const result = script.executeTurn('<attack goblin>', sheet, {});

      const dodgeEvent = result.gamePlayEvents.find(e => e.ruleKey === 'dodge');
      expect(dodgeEvent).toBeDefined();
      expect(dodgeEvent!.mustNotHappen.length).toBeGreaterThan(0);
      expect(dodgeEvent!.mustNotHappen.join(' ')).toContain('dodge');

      const castEvent = result.gamePlayEvents.find(e => e.ruleKey === 'cast');
      expect(castEvent).toBeDefined();
      expect(castEvent!.mustNotHappen.length).toBeGreaterThan(0);
      expect(castEvent!.mustNotHappen.join(' ')).toContain('cast');
    });
  });

  describe('action event output', () => {
    test('executeTurn returns gamePlayEvents with attack mustHappen data', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('<attack goblin>', sheet, {});

      const attackEvent = result.gamePlayEvents.find(e => e.ruleKey === 'attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent!.mustHappen.length).toBeGreaterThan(0);
    });

    test('executeTurn returns gamePlayEvents for all rules even with no action', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('I look around confused', sheet, {});

      // gamePlayEvents should still have entries for all rules
      expect(result.gamePlayEvents.length).toBe(basicFantasyCartridge.ruleOrder.length);
    });

    test('GamePlayScript works with single constructor arg', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet();
      const result = script.executeTurn('<attack goblin>', sheet, {});

      // gamePlayEvents should have full data
      expect(result.gamePlayEvents.length).toBe(basicFantasyCartridge.ruleOrder.length);

      const attackEvent = result.gamePlayEvents.find(e => e.ruleKey === 'attack');
      expect(attackEvent).toBeDefined();
      expect(attackEvent!.mustHappen.length).toBeGreaterThan(0);
    });

    test('gamePlayEvents contain mustHappen for drink_potion effect', () => {
      const script = new GamePlayScript(basicFantasyCartridge);
      const sheet = makeSheet({ stats: { ...basicFantasyCartridge.defaultState.stats, hp: 50 } });
      const narrationSummary = {
        elapsed_time: 'PT5M',
        effects: [{ key: 'drink_potion', what: 'healing', meters: { potency: 3 } }]
      };

      const result = script.executeTurn('', sheet, narrationSummary);
      const potionEvent = result.gamePlayEvents.find(e => e.ruleKey === 'drink_potion');
      expect(potionEvent).toBeDefined();
      expect(potionEvent!.mustHappen.join(' ')).toContain('Healed 30 HP');
    });
  });

  describe('custom cartridge with mustHappen/mustNotHappen/mayHappen', () => {
    test('rules can explicitly set mustHappen, mustNotHappen, and mayHappen', () => {
      const customCartridge: Cartridge = {
        name: 'Test NarrationDirective Cartridge',
        version: '1.0.0',
        breakpoints: ['combat'],
        signalDetectors: [{ key: 'strike', description: 'Player strikes', keywords: ['strike'] }],
        defaultState: {
          timestamp: '1000-01-01T08:00:00',
          stats: { hp: 100 },
          activeConditions: [],
          flags: []
        },
        signalSchemas: [],
        rules: {
          'strike': (_state, context) => {
            const intent = context.playerSignals.find(a => a.key === 'strike');
            if (intent) {
              return {
                outcome: {
                  status: 'success',
                  mechanicsLogs: ['Rolled 18 vs DC 12'],
                  mustHappen: ['Player strikes the goblin with full force.', 'Goblin takes damage.'],
                  mustNotHappen: ['Goblin must not die from this single hit.'],
                  mayHappen: ['Goblin staggers backward.', 'Other goblins look alarmed.'],
                  actionName: 'strike',
                  actionTarget: 'goblin'
                },
                stateMutations: []
              };
            }
            return {
              outcome: {
                status: 'neutral',
                mechanicsLogs: [],
                mustHappen: [],
                mustNotHappen: ['Do not narrate player striking anything.'],
                mayHappen: []
              },
              stateMutations: []
            };
          }
        },
        ruleOrder: ['strike']
      };

      const script = new GamePlayScript(customCartridge);
      const sheet = JSON.parse(JSON.stringify(customCartridge.defaultState));

      // With action
      const result = script.executeTurn('<strike goblin>', sheet, {});
      expect(result.gamePlayEvents.length).toBe(1);
      const event = result.gamePlayEvents[0];
      expect(event.ruleKey).toBe('strike');
      expect(event.mustHappen).toEqual(['Player strikes the goblin with full force.', 'Goblin takes damage.']);
      expect(event.mustNotHappen).toEqual(['Goblin must not die from this single hit.']);
      expect(event.mayHappen).toEqual(['Goblin staggers backward.', 'Other goblins look alarmed.']);

      // Without action
      const result2 = script.executeTurn('I look around', sheet, {});
      expect(result2.gamePlayEvents.length).toBe(1);
      const event2 = result2.gamePlayEvents[0];
      expect(event2.mustNotHappen).toEqual(['Do not narrate player striking anything.']);
      expect(event2.mustHappen).toEqual([]);
      expect(event2.mayHappen).toEqual([]);
    });
  });
});
