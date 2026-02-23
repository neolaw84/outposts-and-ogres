import { AIDungeonAdapter } from '../../../src/platform/aidungeon/index';

describe('AIDungeonAdapter', () => {
  test('should have correct name', () => {
    const adapter = new AIDungeonAdapter({});
    expect(adapter.name).toBe('AI Dungeon');
  });

  test('should extract player message from text field', () => {
    const context = { text: '<attack goblin>' };
    const adapter = new AIDungeonAdapter(context);
    expect(adapter.getPlayerMessage()).toBe('<attack goblin>');
  });

  test('should return null when text is absent', () => {
    const adapter = new AIDungeonAdapter({});
    expect(adapter.getPlayerMessage()).toBeNull();
  });

  test('should load empty state when none exists', () => {
    const adapter = new AIDungeonAdapter({});
    expect(adapter.loadState()).toEqual({});
  });

  test('should save and load state via state global object', () => {
    const context: Record<string, unknown> = {};
    const adapter = new AIDungeonAdapter(context);
    const state = { condition: 'combat', turn: 3 };
    adapter.saveState(state);
    expect(adapter.loadState()).toEqual(state);
  });

  test('should preserve other state properties on save', () => {
    const context: Record<string, unknown> = {
      state: { otherData: 'keep me' }
    };
    const adapter = new AIDungeonAdapter(context);
    adapter.saveState({ turn: 1 });
    const stateObj = context['state'] as Record<string, unknown>;
    expect(stateObj['otherData']).toBe('keep me');
    expect(stateObj['gameState']).toEqual({ turn: 1 });
  });

  // ----------------------------------------------------------------
  // getScenarioUpdate
  // ----------------------------------------------------------------

  test('should extract scenario update from last story history entry', () => {
    const update = {
      elapsed_time: 'PT10M',
      flags: { torch_lit: 1 },
      tags: { location: 'dungeon' },
      meters: { tension: 0.5 }
    };
    const context = {
      history: [
        { type: 'do', text: 'You attack the goblin.' },
        { type: 'story', text: 'The goblin falls. [NARRATION_SUMMARY]' + JSON.stringify(update) + '[/NARRATION_SUMMARY]' }
      ]
    };
    const adapter = new AIDungeonAdapter(context);
    expect(adapter.getScenarioUpdate()).toEqual({ ...update, effects: [] });
  });

  test('should return null when history has no story entry with a summary', () => {
    const context = {
      history: [
        { type: 'do', text: 'You search the room.' },
        { type: 'story', text: 'You find nothing of interest.' }
      ]
    };
    const adapter = new AIDungeonAdapter(context);
    expect(adapter.getScenarioUpdate()).toBeNull();
  });

  test('should return null when history is absent', () => {
    const adapter = new AIDungeonAdapter({});
    expect(adapter.getScenarioUpdate()).toBeNull();
  });

  test('should skip story entries without a summary and find an earlier one', () => {
    const update = {
      elapsed_time: 'PT3M',
      flags: { goblin_dead: 1 },
      tags: {},
      meters: {}
    };
    const context = {
      history: [
        { type: 'story', text: 'You enter the cave. [NARRATION_SUMMARY]' + JSON.stringify(update) + '[/NARRATION_SUMMARY]' },
        { type: 'do', text: 'You attack.' },
        { type: 'story', text: 'The goblin dodges.' } // no summary
      ]
    };
    const adapter = new AIDungeonAdapter(context);
    expect(adapter.getScenarioUpdate()).toEqual({ ...update, effects: [] });
  });

  test('should use defaults for missing NarrationSummary fields', () => {
    const context = {
      history: [
        { type: 'story', text: 'Narration [NARRATION_SUMMARY]{}[/NARRATION_SUMMARY]' }
      ]
    };
    const adapter = new AIDungeonAdapter(context);
    const result = adapter.getScenarioUpdate();
    expect(result).not.toBeNull();
    expect(result!.elapsed_time).toBe('PT0S');
    expect(result!.flags).toEqual({});
    expect(result!.tags).toEqual({});
    expect(result!.meters).toEqual({});
  });
});
