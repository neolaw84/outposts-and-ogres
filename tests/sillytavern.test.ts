import { SillyTavernAdapter } from '../src/systems/sillytavern/index';
import { OutputPrompt } from '../src/types';

describe('SillyTavernAdapter', () => {
  test('should have correct name', () => {
    const adapter = new SillyTavernAdapter({});
    expect(adapter.name).toBe('SillyTavern');
  });

  test('should extract player message from chat array', () => {
    const context = {
      chat: [
        { is_user: 'false', mes: 'Welcome adventurer.' },
        { is_user: 'true', mes: '<attack goblin>' }
      ]
    };
    const adapter = new SillyTavernAdapter(context);
    expect(adapter.getPlayerMessage()).toBe('<attack goblin>');
  });

  test('should return null when chat is empty', () => {
    const adapter = new SillyTavernAdapter({ chat: [] });
    expect(adapter.getPlayerMessage()).toBeNull();
  });

  test('should apply prompt to systemPrompt', () => {
    const context: Record<string, unknown> = {};
    const adapter = new SillyTavernAdapter(context);
    const prompt: OutputPrompt = {
      text: 'Narrate the attack.',
      channels: {
        campaignContinuity: 'Long horizon',
        sceneGuidance: 'Mid term',
        immediateInstruction: 'Short term',
        combined: 'Combined prompt text'
      },
      events: []
    };
    adapter.applyPrompt(prompt);
    expect(context['systemPrompt']).toBe('Combined prompt text');
  });

  test('should load empty state when none exists', () => {
    const adapter = new SillyTavernAdapter({});
    expect(adapter.loadState()).toEqual({});
  });

  test('should save and load state via extensionData', () => {
    const context: Record<string, unknown> = {};
    const adapter = new SillyTavernAdapter(context);
    const state = { condition: 'combat', turn: 3 };
    adapter.saveState(state);
    expect(adapter.loadState()).toEqual(state);
  });

  // ----------------------------------------------------------------
  // getScenarioUpdate
  // ----------------------------------------------------------------

  test('should extract scenario update from last AI chat message', () => {
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
    const adapter = new SillyTavernAdapter(context);
    expect(adapter.getScenarioUpdate()).toEqual({ ...update, effects: [] });
  });

  test('should return null when last AI message has no summary', () => {
    const context = {
      chat: [
        { is_user: 'false', mes: 'Welcome to the dungeon.' },
        { is_user: 'true', mes: '<look around>' }
      ]
    };
    const adapter = new SillyTavernAdapter(context);
    expect(adapter.getScenarioUpdate()).toBeNull();
  });

  test('should return null when chat is empty', () => {
    const adapter = new SillyTavernAdapter({ chat: [] });
    expect(adapter.getScenarioUpdate()).toBeNull();
  });

  test('should skip AI messages without a summary and find an earlier one', () => {
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
    const adapter = new SillyTavernAdapter(context);
    expect(adapter.getScenarioUpdate()).toEqual({ ...update, effects: [] });
  });

  test('should use defaults for missing WorldSimulationUpdate fields', () => {
    const context = {
      chat: [
        { is_user: 'false', mes: 'Narration [NARRATION_SUMMARY]{}[/NARRATION_SUMMARY]' }
      ]
    };
    const adapter = new SillyTavernAdapter(context);
    const result = adapter.getScenarioUpdate();
    expect(result).not.toBeNull();
    expect(result!.elapsed_time).toBe('PT0S');
    expect(result!.flags).toEqual({});
    expect(result!.tags).toEqual({});
    expect(result!.meters).toEqual({});
  });
});
