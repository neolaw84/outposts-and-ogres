import { JanitorAIAdapter } from '../src/systems/janitorai/index';
import { SillyTavernAdapter } from '../src/systems/sillytavern/index';
import { AIDungeonAdapter } from '../src/systems/aidungeon/index';
import { GamePlayEvent, GameState, WorldEventTracker } from '../src/types';

function makeSampleEvents(): GamePlayEvent[] {
  return [
    {
      ruleKey: 'drink_potion',
      status: 'neutral',
      mechanicsLogs: [],
      mustHappen: [],
      mustNotHappen: ['Do not narrate player drinking a potion.'],
      mayHappen: ['You may describe a potion bottle on a shelf.'],
      stateMutations: []
    },
    {
      ruleKey: 'attack',
      status: 'success',
      mechanicsLogs: ['Rolled 18 + 2 = 20 vs DC 12.'],
      mustHappen: ['Player strikes the goblin decisively.'],
      mustNotHappen: ['Goblin must not die from this single hit.'],
      mayHappen: ['Goblin staggers backward.'],
      actionName: 'attack',
      actionTarget: 'goblin',
      stateMutations: []
    }
  ];
}

function makeSampleConditions(): WorldEventTracker[] {
  return [
    {
      key: 'drink_potion',
      what: "string; type of potion; allowed values are 'healing', 'strength', 'poison'",
      condition: '{{user}} drinks a potion'
    }
  ];
}

const sampleState: GameState = {
  timestamp: '1000-01-01T08:00:00',
  stats: { hp: 100 },
  activeConditions: [],
  flags: []
};

describe('SystemAdapter.applyGamePlayOutput', () => {
  describe('JanitorAIAdapter', () => {
    test('applyGamePlayOutput injects MUST/MUST NOT/MAY into scenario', () => {
      const context: Record<string, unknown> = {
        character: { personality: '', scenario: '' }
      };
      const adapter = new JanitorAIAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, makeSampleConditions());

      const character = context['character'] as Record<string, unknown>;
      const scenario = character['scenario'] as string;
      expect(scenario).toContain('MUST: Player strikes the goblin decisively.');
      expect(scenario).toContain('MUST NOT: Do not narrate player drinking a potion.');
      expect(scenario).toContain('MUST NOT: Goblin must not die from this single hit.');
      expect(scenario).toContain('MAY: You may describe a potion bottle on a shelf.');
      expect(scenario).toContain('[NARRATION_GUIDE]');
      expect(scenario).toContain('[/NARRATION_GUIDE]');
    });

    test('applyGamePlayOutput includes conditionsToReportBack', () => {
      const context: Record<string, unknown> = {
        character: { personality: '', scenario: '' }
      };
      const adapter = new JanitorAIAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, makeSampleConditions());

      const character = context['character'] as Record<string, unknown>;
      const scenario = character['scenario'] as string;
      expect(scenario).toContain('drinks a potion');
      expect(scenario).toContain('drink_potion');
    });
  });

  describe('SillyTavernAdapter', () => {
    test('applyGamePlayOutput sets systemPrompt', () => {
      const context: Record<string, unknown> = {};
      const adapter = new SillyTavernAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, makeSampleConditions());

      const systemPrompt = context['systemPrompt'] as string;
      expect(systemPrompt).toContain('MUST: Player strikes the goblin decisively.');
      expect(systemPrompt).toContain('MUST NOT: Do not narrate player drinking a potion.');
      expect(systemPrompt).toContain('MAY: You may describe a potion bottle on a shelf.');
    });
  });

  describe('AIDungeonAdapter', () => {
    test('applyGamePlayOutput sets memory channels', () => {
      const context: Record<string, unknown> = {
        state: {}
      };
      const adapter = new AIDungeonAdapter(context);
      adapter.applyGamePlayOutput(makeSampleEvents(), sampleState, makeSampleConditions());

      const state = context['state'] as Record<string, unknown>;
      const memory = state['memory'] as Record<string, unknown>;
      expect(memory['context']).toContain('MUST');
      expect(memory['context']).toContain('Player strikes the goblin decisively.');
      expect(memory['context']).toContain('MUST NOT');
      expect(memory['context']).toContain('Do not narrate player drinking a potion.');
      expect(memory['authorsNote']).toContain('MAY');
      expect(memory['authorsNote']).toContain('You may describe a potion bottle on a shelf.');
      expect(memory['frontMemory']).toContain('drinks a potion');
    });
  });
});
