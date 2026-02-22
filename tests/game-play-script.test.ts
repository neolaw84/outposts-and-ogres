import { GameEngine } from '../src/engine';
import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { Cartridge, NarrationDirective } from '../src/types';

function createScript(): GameEngine {
  return new GameEngine(basicFantasyCartridge);
}

describe('GameEngine', () => {
  test('should initialise with the default cartridge', () => {
    const script = createScript();
    expect(script.getCartridge()).toBe(basicFantasyCartridge);
    expect(script.getCondition()).toBe('combat');
  });

  test('should allow setting the condition', () => {
    const script = createScript();
    script.setCondition('exploration');
    expect(script.getCondition()).toBe('exploration');
  });

  test('should allow swapping cartridges', () => {
    const script = createScript();
    const custom: Cartridge = {
      name: 'Custom',
      version: '0.1.0',
      breakpoints: ['puzzle'],
      signalDetectors: [
        { key: 'solve', description: 'Solve puzzle', keywords: ['solve'] },
        { key: 'hint', description: 'Get hint', keywords: ['hint'] }
      ],
      defaultState: { timestamp: '1000-01-01T08:00:00', stats: {}, activeConditions: [], flags: [] },
      signalSchemas: [],
      rules: {},
      ruleOrder: ['player_action']
    };
    script.setCartridge(custom);
    expect(script.getCartridge().name).toBe('Custom');
    expect(script.getCondition()).toBe('puzzle');
  });

  test('detectSignals should find a bracketed action in combat', () => {
    const script = createScript();
    const intents = script.detectSignals('<attack goblin>');
    expect(intents.length).toBeGreaterThan(0);
    expect(intents[0].key).toBe('attack');
    expect(intents[0].what).toBe('goblin');
  });

  test('detectSignals should return empty array for input with no matching keywords', () => {
    const script = createScript();
    const intents = script.detectSignals('I ponder silently');
    expect(intents.length).toBe(0);
  });


  test('executeTurn should run full 3-phase loop', () => {
    const script = new GameEngine(basicFantasyCartridge);
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultState));
    const output = script.executeTurn('<attack goblin>', mockState, {});
    const attackEvent = output.directives.find((e: NarrationDirective) => e.ruleKey === 'attack');
    expect(attackEvent).toBeDefined();
    expect(attackEvent!.mustHappen.length).toBeGreaterThan(0);
  });

  test('executeTurn should return directives with no mustHappen for fully unrecognised input', () => {
    const script = createScript();
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultState));
    const output = script.executeTurn('I ponder silently', mockState, {});
    expect(output.directives.length).toBeGreaterThan(0);
    const withMustHappen = output.directives.filter((e: NarrationDirective) => e.mustHappen.length > 0);
    expect(withMustHappen.length).toBe(0);
  });

  test('executeTurn should work in exploration condition', () => {
    const script = createScript();
    script.setCondition('exploration');
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultState));
    const output = script.executeTurn('<search>', mockState, {});
    const searchEvent = output.directives.find((e: NarrationDirective) => e.ruleKey === 'search');
    expect(searchEvent).toBeDefined();
  });

  test('executeTurn should work in social condition', () => {
    const script = createScript();
    script.setCondition('social');
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultState));
    const output = script.executeTurn('<persuade merchant>', mockState, {});
    const persuadeEvent = output.directives.find((e: NarrationDirective) => e.ruleKey === 'persuade');
    expect(persuadeEvent).toBeDefined();
  });

  test('processTurn should trigger aspectFunction and mutate state', () => {
    const customCartridge: Cartridge = {
      name: 'Test Aspect Cartridge',
      version: '1.0.0',
      breakpoints: ['combat'],
      signalDetectors: [
        { key: 'use_item', description: 'Use an item', keywords: ['use_item', 'use'] }
      ],
      defaultState: {
        timestamp: '1000-01-01T08:00:00',
        stats: { hp: 20 },
        activeConditions: [],
        flags: []
      },
      signalSchemas: [],
      rules: {
        'use_item': (state, context) => {
          if (context.playerSignals.length > 0) {
            return {
              outcome: {
                actionName: 'use_item',
                status: 'success',
                mechanicsLogs: [],
                mustHappen: ['The item drained 5 HP.'],
                mustNotHappen: [],
                mayHappen: []
              },
              stateMutations: [
                {
                  what: 'HP drain',
                  temp: false,
                  impacts: [
                    { stats: 'hp', op: 'sub', val: 5 }
                  ]
                }
              ]
            };
          }
          return {
            outcome: { status: 'neutral', mechanicsLogs: [], mustHappen: [], mustNotHappen: [], mayHappen: [] },
            stateMutations: []
          };
        }
      },
      ruleOrder: ['use_item']
    };

    const script = new GameEngine(customCartridge);
    const mockState = JSON.parse(JSON.stringify(customCartridge.defaultState));
    const output = script.executeTurn('<use_item potion>', mockState, {});

    expect(output.newState.stats.hp).toBe(15);

    const hasGuide = output.directives.some((e: NarrationDirective) => e.mustHappen.join(' ').includes('drained 5 HP.'));
    expect(hasGuide).toBe(true);
  });
});
