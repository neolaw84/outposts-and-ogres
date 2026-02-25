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
        // Simple example: { key: 'attack', description: 'Player tries to attack', keywords: ['hit', 'strike'] }
        // Complex example: { key: 'consume', verbs: ['drink', 'eat'], whatDict: { potion: ['flask', 'elixir'], food: ['bread', 'meat'] } }
    ],

    signalSchemas: [
        // Instruct the LLM on how to extract world state here
        /*
        {
            key: 'enemy_attack',
            what: "string; type of attack; allowed values are 'melee', 'ranged', 'magic'",
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
            if (context.playerSignals.length === 0) return { ruleDebugLogs: [], mustHappen: [], mustNotHappen: [], mayHappen: [], stateMutations: [] };
            
            // If using whatDict, you can filter sub-intents here:
            // const subIntent = context.playerSignals[0].what;

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
