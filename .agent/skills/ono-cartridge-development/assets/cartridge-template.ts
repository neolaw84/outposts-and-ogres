import { Cartridge, TurnContext, State, RuleOutcome, SideEffect } from '../../../../src/types';

/**
 * A boilerplate template used by the ONO Cartridge Development Skill.
 */
export const templateCartridge: Cartridge = {
    name: '{{GAME_NAME}}',
    version: '1.0.0',
    debug: true,

    defaultState: {
        timestamp: '1000-01-01T08:00:00',
        stats: {
            // Define your core numerical or boolean stats here
            // e.g., hp: 100, gold: 0
        },
        activeConditions: [],
        flags: []
    },

    signalDetectors: [
        // Map natural language to inputs here
        // { key: 'attack', description: 'Player tries to attack', keywords: ['hit', 'strike'] }
    ],

    signalSchemas: [
        // Instruct the LLM on how to extract world state here
        /*
        {
            key: 'enemy_attack',
            what: 'An enemy damages the player',
            condition: 'When the player is attacked...',
            flags: { critical: 'True if it was a deadly blow' },
            meters: { damage: 'Scale of 1-10' },
            tags: {}
        }
        */
    ],

    ruleOrder: [
        // Define the execution sequence of your rules 
    ],

    rules: {
        // Implement the math logic and LLM directives here
        /*
        'example_rule': (state: State, context: TurnContext): RuleOutcome => {
            const intent = context.playerSignals.find(s => s.key === 'example_action');
            if (!intent) return { ruleDebugLogs: [], mustHappen: [], mustNotHappen: [], mayHappen: [], stateMutations: [] };

            return {
                ruleDebugLogs: ['Action evaluated.'],
                mustHappen: ['Describe the action.'],
                mustNotHappen: [],
                mayHappen: [],
                stateMutations: []
            };
        }
        */
    }
};
