import { GamePlayScript } from '../src/systems/game-play-script';
import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { GameCartridge, GamePlayEvent } from '../src/types';

function createScript(): GamePlayScript {
  return new GamePlayScript(basicFantasyCartridge);
}

describe('GamePlayScript', () => {
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
    const custom: GameCartridge = {
      name: 'Custom',
      version: '0.1.0',
      stopConditions: ['puzzle'],
      availableActions: { puzzle: ['solve', 'hint'] },
      defaultGameState: { timestamp: '1000-01-01T08:00:00', stats: {}, activeConditions: [], flags: [] },
      worldEventTrackers: [],
      gameRules: {},
      ruleSequence: ['player_action']
    };
    script.setCartridge(custom);
    expect(script.getCartridge().name).toBe('Custom');
    expect(script.getCondition()).toBe('puzzle');
  });

  test('extractAction should find a bracketed action in combat', () => {
    const script = createScript();
    const parsed = script.extractAction('<attack goblin>');
    expect(parsed).not.toBeNull();
    expect(parsed![0].effect.key).toBe('attack');
    expect(parsed![0].effect.what).toBe('goblin');
  });

  test('extractAction should return null for unknown action without brackets', () => {
    const script = createScript();
    const parsed = script.extractAction('I look around');
    expect(parsed).toBeNull();
  });


  test('executeTurn should run full 3-phase loop', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.executeTurn('<attack goblin>', mockState, {});
    const attackEvent = output.gamePlayEvents.find((e: GamePlayEvent) => e.ruleKey === 'attack');
    expect(attackEvent).toBeDefined();
    expect(attackEvent!.mustHappen.length).toBeGreaterThan(0);
  });

  test('executeTurn should return gamePlayEvents for unrecognised input', () => {
    const script = createScript();
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.executeTurn('I look around confused', mockState, {});
    expect(output.gamePlayEvents.length).toBeGreaterThan(0);
    const withMustHappen = output.gamePlayEvents.filter((e: GamePlayEvent) => e.mustHappen.length > 0);
    expect(withMustHappen.length).toBe(0);
  });

  test('executeTurn should work in exploration condition', () => {
    const script = createScript();
    script.setCondition('exploration');
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.executeTurn('<search>', mockState, {});
    const searchEvent = output.gamePlayEvents.find((e: GamePlayEvent) => e.ruleKey === 'search');
    expect(searchEvent).toBeDefined();
  });

  test('executeTurn should work in social condition', () => {
    const script = createScript();
    script.setCondition('social');
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.executeTurn('<persuade merchant>', mockState, {});
    const persuadeEvent = output.gamePlayEvents.find((e: GamePlayEvent) => e.ruleKey === 'persuade');
    expect(persuadeEvent).toBeDefined();
  });

  test('processTurn should trigger aspectFunction and mutate state', () => {
    const customCartridge: GameCartridge = {
      name: 'Test Aspect Cartridge',
      version: '1.0.0',
      stopConditions: ['combat'],
      availableActions: { combat: ['use_item'] },
      defaultGameState: {
        timestamp: '1000-01-01T08:00:00',
        stats: { hp: 20 },
        activeConditions: [],
        flags: []
      },
      worldEventTrackers: [],
      gameRules: {
        'use_item': (state, context) => {
          if (context.action && context.action.find(a => a.effect.key === 'use_item')) {
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
      ruleSequence: ['use_item']
    };

    const script = new GamePlayScript(customCartridge);
    const mockState = JSON.parse(JSON.stringify(customCartridge.defaultGameState));
    const output = script.executeTurn('<use_item potion>', mockState, {});

    expect(output.newState.stats.hp).toBe(15);

    const hasGuide = output.gamePlayEvents.some((e: GamePlayEvent) => e.mustHappen.join(' ').includes('drained 5 HP.'));
    expect(hasGuide).toBe(true);
  });
});
