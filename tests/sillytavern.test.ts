import { SillyTavernAdapter } from '../src/systems/sillytavern/index';
import { OutputPrompt } from '../src/types';

describe('SillyTavernAdapter', () => {
  test('should have correct name', () => {
    const adapter = new SillyTavernAdapter();
    expect(adapter.name).toBe('SillyTavern');
  });

  test('should extract player message from chat array', () => {
    const adapter = new SillyTavernAdapter();
    const context = {
      chat: [
        { is_user: 'false', mes: 'Welcome adventurer.' },
        { is_user: 'true', mes: '<attack goblin>' }
      ]
    };
    expect(adapter.getPlayerMessage(context)).toBe('<attack goblin>');
  });

  test('should return null when chat is empty', () => {
    const adapter = new SillyTavernAdapter();
    expect(adapter.getPlayerMessage({ chat: [] })).toBeNull();
  });

  test('should apply prompt to systemPrompt', () => {
    const adapter = new SillyTavernAdapter();
    const context: Record<string, unknown> = {};
    const prompt: OutputPrompt = {
      text: 'Narrate the attack.',
      result: {
        success: true,
        action: { action: 'attack', target: 'goblin', raw: '<attack goblin>' },
        rolls: [{ sides: 20, value: 15 }],
        difficulty: 10,
        rollTotal: 15
      }
    };
    adapter.applyPrompt(context, prompt);
    expect(context['systemPrompt']).toBe('Narrate the attack.');
  });

  test('should load empty state when none exists', () => {
    const adapter = new SillyTavernAdapter();
    expect(adapter.loadState({})).toEqual({});
  });

  test('should save and load state via extensionData', () => {
    const adapter = new SillyTavernAdapter();
    const context: Record<string, unknown> = {};
    const state = { condition: 'combat', turn: 3 };
    adapter.saveState(context, state);
    expect(adapter.loadState(context)).toEqual(state);
  });
});
