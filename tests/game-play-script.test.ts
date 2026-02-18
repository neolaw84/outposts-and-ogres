import { GamePlayScript } from '../src/systems/game-play-script';
import { basicFantasyCartridge } from '../src/cartridges/basic-fantasy';
import { GameCartridge } from '../src/types';

describe('GamePlayScript', () => {
  test('should initialise with the default cartridge', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    expect(script.getCartridge()).toBe(basicFantasyCartridge);
    expect(script.getCondition()).toBe('combat');
  });

  test('should allow setting the condition', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    script.setCondition('exploration');
    expect(script.getCondition()).toBe('exploration');
  });

  test('should allow swapping cartridges', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const custom: GameCartridge = {
      name: 'Custom',
      version: '0.1.0',
      stopConditions: ['puzzle'],
      availableActions: { puzzle: ['solve', 'hint'] },
      rules: []
    };
    script.setCartridge(custom);
    expect(script.getCartridge().name).toBe('Custom');
    expect(script.getCondition()).toBe('puzzle');
  });

  test('should track messages', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    script.addMessage({ role: 'ai', content: 'Welcome adventurer.' });
    script.addMessage({ role: 'player', content: '<attack>' });
    expect(script.getMessages().length).toBe(2);
    expect(script.getMessages()[0].role).toBe('ai');
    expect(script.getMessages()[1].role).toBe('player');
  });

  test('extractAction should find a bracketed action in combat', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const parsed = script.extractAction('<attack goblin>');
    expect(parsed).not.toBeNull();
    expect(parsed!.action).toBe('attack');
    expect(parsed!.target).toBe('goblin');
  });

  test('extractAction should return null for unknown action without brackets', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const parsed = script.extractAction('I look around');
    expect(parsed).toBeNull();
  });

  test('findRule should return matching rule', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const rule = script.findRule('attack');
    expect(rule).not.toBeNull();
    expect(rule!.condition).toBe('combat');
    expect(rule!.action).toBe('attack');
    expect(rule!.diceSides).toBe(20);
  });

  test('findRule should return null for non-existent action', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const rule = script.findRule('fly');
    expect(rule).toBeNull();
  });

  test('resolveAction should produce an ActionResult', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const result = script.resolveAction({ action: 'attack', target: 'orc', raw: '<attack orc>' });
    expect(result.action.action).toBe('attack');
    expect(result.rolls.length).toBe(1);
    expect(result.rolls[0].sides).toBe(20);
    expect(result.difficulty).toBe(10);
    expect(typeof result.success).toBe('boolean');
    expect(result.rollTotal).toBe(result.rolls[0].value);
  });

  test('resolveAction with unknown action should use default d20 check', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const result = script.resolveAction({ action: 'fly', target: '', raw: '<fly>' });
    expect(result.rolls.length).toBe(1);
    expect(result.rolls[0].sides).toBe(20);
    expect(result.difficulty).toBe(10);
  });

  test('buildPrompt should produce an OutputPrompt', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const result = script.resolveAction({ action: 'attack', target: 'orc', raw: '<attack orc>' });
    const prompt = script.buildPrompt(result);
    expect(prompt.text).toContain('attack');
    expect(prompt.text).toContain('orc');
    expect(prompt.text).toContain('difficulty');
    expect(prompt.text).toContain('Available actions');
    expect(prompt.result).toBe(result);
  });

  test('processTurn should run full 3-phase loop', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const output = script.processTurn('<attack goblin>');
    expect(output).not.toBeNull();
    expect(output!.text).toContain('attack');
    expect(output!.text).toContain('goblin');
    expect(script.getMessages().length).toBe(1);
    expect(script.getMessages()[0].role).toBe('player');
  });

  test('processTurn should return null for unrecognised input', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    const output = script.processTurn('I look around confused');
    expect(output).toBeNull();
    expect(script.getMessages().length).toBe(1);
  });

  test('processTurn should work in exploration condition', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    script.setCondition('exploration');
    const output = script.processTurn('<search>');
    expect(output).not.toBeNull();
    expect(output!.text).toContain('search');
  });

  test('processTurn should work in social condition', () => {
    const script = new GamePlayScript(basicFantasyCartridge);
    script.setCondition('social');
    const output = script.processTurn('<persuade merchant>');
    expect(output).not.toBeNull();
    expect(output!.text).toContain('persuade');
    expect(output!.text).toContain('merchant');
  });
});
