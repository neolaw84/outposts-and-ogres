import { GamePlayScript } from '../src/systems/game-play-script';
import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { GameCartridge } from '../src/types';
import { mapBasicFantasyJanitorAI } from '../src/prompt-mappers/basic-fantasy/janitorai';
import { mapBasicFantasySillyTavern } from '../src/prompt-mappers/basic-fantasy/sillytavern';

function createScript(): GamePlayScript {
  return new GamePlayScript(basicFantasyCartridge, mapBasicFantasyJanitorAI);
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
      rules: [],
      defaultGameState: { cur_ts: '1000-01-01T08:00:00', stats: {}, se: [], flags: [] },
      effectDefinitions: [],
      aspectFunctions: {},
      turnEndTriggers: []
    };
    script.setCartridge(custom);
    expect(script.getCartridge().name).toBe('Custom');
    expect(script.getCondition()).toBe('puzzle');
  });

  test('should track messages', () => {
    const script = createScript();
    script.addMessage({ role: 'ai', content: 'Welcome adventurer.' });
    script.addMessage({ role: 'player', content: '<attack>' });
    expect(script.getMessages().length).toBe(2);
    expect(script.getMessages()[0].role).toBe('ai');
    expect(script.getMessages()[1].role).toBe('player');
  });

  test('extractAction should find a bracketed action in combat', () => {
    const script = createScript();
    const parsed = script.extractAction('<attack goblin>');
    expect(parsed).not.toBeNull();
    expect(parsed!.action).toBe('attack');
    expect(parsed!.target).toBe('goblin');
  });

  test('extractAction should return null for unknown action without brackets', () => {
    const script = createScript();
    const parsed = script.extractAction('I look around');
    expect(parsed).toBeNull();
  });

  test('findRule should return matching rule', () => {
    const script = createScript();
    const rule = script.findRule('attack');
    expect(rule).not.toBeNull();
    expect(rule!.condition).toBe('combat');
    expect(rule!.action).toBe('attack');
    expect(rule!.aspectFunction).toBeDefined();
  });

  test('findRule should return null for non-existent action', () => {
    const script = createScript();
    const rule = script.findRule('fly');
    expect(rule).toBeNull();
  });

  test('buildPrompt should produce an OutputPrompt', () => {
    const script = createScript();
    const events: import('../src/types').TurnEvent[] = [{
      type: 'action_resolution',
      action: 'attack',
      target: 'orc',
      mechanicsLogs: ['Rolled a 15.'],
      status: 'success',
      narrationGuidance: ['Your attack strikes true.']
    }];
    const prompt = script.buildPrompt(events);
    expect(prompt.text).toContain('attack');
    expect(prompt.text).toContain('orc');
    expect(prompt.channels.shortTerm).toContain('NARRATION_GUIDE');
    expect(prompt.events.length).toBe(1);
  });

  test('processTurn should run full 3-phase loop', () => {
    const script = new GamePlayScript(basicFantasyCartridge, mapBasicFantasySillyTavern);
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.processTurn('<attack goblin>', mockState);
    expect(output.prompt).not.toBeNull();
    expect(output.prompt!.text).toContain('attack');
    expect(output.prompt!.text).toContain('goblin');
    expect(script.getMessages().length).toBe(1);
    expect(script.getMessages()[0].role).toBe('player');
  });

  test('processTurn should return null prompt for unrecognised input', () => {
    const script = createScript();
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.processTurn('I look around confused', mockState);
    expect(output.prompt).toBeNull();
    expect(script.getMessages().length).toBe(1);
  });

  test('processTurn should work in exploration condition', () => {
    const script = createScript();
    script.setCondition('exploration');
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.processTurn('<search>', mockState);
    expect(output.prompt).not.toBeNull();
    expect(output.prompt!.text).toContain('search');
  });

  test('processTurn should work in social condition', () => {
    const script = createScript();
    script.setCondition('social');
    const mockState = JSON.parse(JSON.stringify(basicFantasyCartridge.defaultGameState));
    const output = script.processTurn('<persuade merchant>', mockState);
    expect(output.prompt).not.toBeNull();
    expect(output.prompt!.text).toContain('persuade');
    expect(output.prompt!.text).toContain('merchant');
  });

  test('processTurn should trigger aspectFunction and mutate state', () => {
    // 1. Create a minimal cartridge with an aspectFunction
    const customCartridge: GameCartridge = {
      name: 'Test Aspect Cartridge',
      version: '1.0.0',
      stopConditions: ['combat'],
      availableActions: { combat: ['use_item'] },
      rules: [
        {
          condition: 'combat',
          action: 'use_item',
          aspectFunction: (state, context) => {
            return {
              outcome: {
                status: 'success',
                mechanicsLogs: [],
                narrationGuidance: ['The item drained 5 HP.']
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
        }
      ],
      defaultGameState: {
        cur_ts: '1000-01-01T08:00:00',
        stats: { hp: 20 }, // Starting HP is 20
        se: [],
        flags: []
      },
      effectDefinitions: [],
      aspectFunctions: {},
      turnEndTriggers: []
    };

    // 2. Initialize script with our custom cartridge
    const script = new GamePlayScript(customCartridge, mapBasicFantasySillyTavern);
    const mockState = JSON.parse(JSON.stringify(customCartridge.defaultGameState));

    // 3. Process the turn
    const output = script.processTurn('<use_item potion>', mockState);

    // 4. Verify the state was mutated by the aspectFunction
    expect(output.newState.stats.hp).toBe(15); // 20 - 5 = 15

    // 5. Verify the narrationGuidance was appended to the success/failure event in the prompt
    expect(output.prompt).not.toBeNull();
    // Events array is where narrationGuidance is pushed to
    // Let's examine the last event in output.prompt.events
    const hasGuide = output.prompt!.events.some(e => e.type === 'action_resolution' && e.narrationGuidance?.join(' ').includes('drained 5 HP.'));
    expect(hasGuide).toBe(true);
  });
});
