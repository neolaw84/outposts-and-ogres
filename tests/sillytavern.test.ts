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
      channels: {
        longHorizon: 'Long horizon',
        midTerm: 'Mid term',
        shortTerm: 'Short term',
        combined: 'Combined prompt text'
      },
      events: [],
      result: {
        success: true,
        action: { action: 'attack', target: 'goblin', raw: '<attack goblin>' },
        rolls: [{ sides: 20, value: 15 }],
        difficulty: 10,
        rollTotal: 15
      }
    };
    adapter.applyPrompt(context, prompt);
    expect(context['systemPrompt']).toBe('Combined prompt text');
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

  // ----------------------------------------------------------------
  // getScenarioUpdate
  // ----------------------------------------------------------------

  test('should extract scenario update from last AI chat message', () => {
    const adapter = new SillyTavernAdapter();
    const update = {
      elapsed_time: 'PT2M',
      flags: { door_open: 0 },
      tags: { npc_mood: 'hostile' },
      meters: { distance_to_exit: 12 }
    };
    const context = {
      chat: [
        { is_user: 'false', mes: 'The door slams shut. [NARRATION_SUMMARY]' + JSON.stringify(update) + '[/NARRATION_SUMMARY]' },
        { is_user: 'true', mes: '<search room>' }
      ]
    };
    expect(adapter.getScenarioUpdate(context)).toEqual({ ...update, effects: [] });
  });

  test('should return null when last AI message has no summary', () => {
    const adapter = new SillyTavernAdapter();
    const context = {
      chat: [
        { is_user: 'false', mes: 'Welcome to the dungeon.' },
        { is_user: 'true', mes: '<look around>' }
      ]
    };
    expect(adapter.getScenarioUpdate(context)).toBeNull();
  });

  test('should return null when chat is empty', () => {
    const adapter = new SillyTavernAdapter();
    expect(adapter.getScenarioUpdate({ chat: [] })).toBeNull();
  });

  test('should skip AI messages without a summary and find an earlier one', () => {
    const adapter = new SillyTavernAdapter();
    const update = {
      elapsed_time: 'PT1M',
      flags: { chest_open: 1 },
      tags: {},
      meters: {}
    };
    const context = {
      chat: [
        { is_user: 'false', mes: 'You enter the room. [NARRATION_SUMMARY]' + JSON.stringify(update) + '[/NARRATION_SUMMARY]' },
        { is_user: 'true', mes: '<open chest>' },
        { is_user: 'false', mes: 'The chest is already open.' } // no summary
      ]
    };
    expect(adapter.getScenarioUpdate(context)).toEqual({ ...update, effects: [] });
  });

  test('should use defaults for missing ScenarioUpdate fields', () => {
    const adapter = new SillyTavernAdapter();
    const context = {
      chat: [
        { is_user: 'false', mes: 'Narration [NARRATION_SUMMARY]{}[/NARRATION_SUMMARY]' }
      ]
    };
    const result = adapter.getScenarioUpdate(context);
    expect(result).not.toBeNull();
    expect(result!.elapsed_time).toBe('PT0S');
    expect(result!.flags).toEqual({});
    expect(result!.tags).toEqual({});
    expect(result!.meters).toEqual({});
  });
});
