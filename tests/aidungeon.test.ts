import { AIDungeonAdapter } from '../src/systems/aidungeon/index';
import { OutputPrompt } from '../src/types';

describe('AIDungeonAdapter', () => {
  test('should have correct name', () => {
    const adapter = new AIDungeonAdapter();
    expect(adapter.name).toBe('AI Dungeon');
  });

  test('should extract player message from text field', () => {
    const adapter = new AIDungeonAdapter();
    const context = { text: '<attack goblin>' };
    expect(adapter.getPlayerMessage(context)).toBe('<attack goblin>');
  });

  test('should return null when text is absent', () => {
    const adapter = new AIDungeonAdapter();
    expect(adapter.getPlayerMessage({})).toBeNull();
  });

  test('should apply prompt to memory field', () => {
    const adapter = new AIDungeonAdapter();
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
    expect(context['memory']).toBe('Narrate the attack.');
  });

  test('should load empty state when none exists', () => {
    const adapter = new AIDungeonAdapter();
    expect(adapter.loadState({})).toEqual({});
  });

  test('should save and load state via state global object', () => {
    const adapter = new AIDungeonAdapter();
    const context: Record<string, unknown> = {};
    const state = { condition: 'combat', turn: 3 };
    adapter.saveState(context, state);
    expect(adapter.loadState(context)).toEqual(state);
  });

  test('should preserve other state properties on save', () => {
    const adapter = new AIDungeonAdapter();
    const context: Record<string, unknown> = {
      state: { otherData: 'keep me' }
    };
    adapter.saveState(context, { turn: 1 });
    const stateObj = context['state'] as Record<string, unknown>;
    expect(stateObj['otherData']).toBe('keep me');
    expect(stateObj['gameState']).toEqual({ turn: 1 });
  });
});
