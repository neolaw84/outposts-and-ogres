import { Cartridge, State, RuleOutcome, SideEffect } from '../types';

console.log('[TOY CARTRIDGE] Initializing...');

const defaultCharacterSheet: State = {
    timestamp: '1000-01-01T08:00:00',
    stats: {
        test_counter: 0
    },
    activeConditions: [],
    flags: []
};

export const toyPlatformCartridge: Cartridge = {
    name: 'Toy Debug Cartridge',
    version: '1.0.0',
    debug: true,

    signalDetectors: [
        { key: 'test_action', description: 'Player performs a test action', keywords: ['test', 'ping', 'hello'] },
        { key: 'world_event', description: 'A random world event occurs', keywords: ['event', 'random'] }
    ],

    defaultState: defaultCharacterSheet,

    ruleOrder: ['world_event', 'test_action'],

    signalSchemas: [
        {
            key: 'test_action',
            what: 'string; target of the test action',
            when: 'string; time in yyyy-mm-ddTHH:MM:SS format',
            condition: '{{user}} performs a test action'
        },
        {
            key: 'world_event',
            what: 'string; name of the active event',
            condition: 'A random world event occurs'
        }
    ],

    rules: {
        world_event: function (sheet: State, context: import('../types').TurnContext): RuleOutcome {
            console.log(`[TOY CARTRIDGE] Evaluating 'world_event' rule... Current state counter: ${sheet.stats['test_counter']}`);

            if (!context.worldSignal) {
                console.log(`[TOY CARTRIDGE] 'world_event' - no worldSignal detected. Skiping.`);
                return {
                    ruleDebugLogs: [],
                    mustHappen: [],
                    mustNotHappen: [],
                    mayHappen: [],
                    stateMutations: []
                };
            }

            console.log(`[TOY CARTRIDGE] 'world_event' - Signal detected: ${JSON.stringify(context.worldSignal)}`);
            return {
                ruleDebugLogs: ['World event processed.'],
                mustHappen: ['A random event happens nearby.'],
                mustNotHappen: [],
                mayHappen: [],
                stateMutations: []
            };
        },

        test_action: function (sheet: State, context: import('../types').TurnContext): RuleOutcome {
            console.log(`[TOY CARTRIDGE] Evaluating 'test_action' rule...`);
            const signal = context.playerSignals.find(s => s.key === 'test_action');

            if (!signal) {
                console.log(`[TOY CARTRIDGE] 'test_action' - Player did not trigger this action.`);
                return {
                    ruleDebugLogs: [],
                    mustHappen: [],
                    mustNotHappen: [],
                    mayHappen: [],
                    stateMutations: []
                };
            }

            console.log(`[TOY CARTRIDGE] 'test_action' - Triggered! Adding +1 to counter.`);
            const currentCounter = (sheet.stats['test_counter'] as number) || 0;

            const sideEffects: SideEffect[] = [{
                what: 'increment counter',
                temp: false,
                impacts: [{ stats: 'test_counter', op: 'add', val: 1 }]
            }];

            console.log(`[TOY CARTRIDGE] 'test_action' - Counter goes from ${currentCounter} to ${currentCounter + 1}.`);

            return {
                ruleDebugLogs: [`Action evaluated successfully. Counter incremented.`],
                mustHappen: [`The test action resolves successfully. Provide an over the top narration.`],
                mustNotHappen: [],
                mayHappen: [],
                stateMutations: sideEffects
            };
        }
    }
};

export default toyPlatformCartridge;
