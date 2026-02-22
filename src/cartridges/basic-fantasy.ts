/**
 * Basic Fantasy cartridge – a simple fantasy RPG rule book.
 *
 * This serves as both a working example and the out-of-the-box game system.
 * It can be swapped out for any other GameCartridge at runtime.
 *
 * Includes effect definitions and aspect functions ported from adult-scripts
 * to achieve feature parity with the showcase branch.
 */

import { GameCartridge, GameState, RuleResolution, ActiveCondition } from '../types';
import { extractMatch } from '../utils/text-utils';
import { addDuration, formatDate } from '../utils/time-utils';
import { rollDice, sumRolls } from '../utils/dice';

const END_THIS_TURN = 'Then, end this turn (i.e. give NARRATION_SUMMARY block) and ' +
  'wait for the Script to provide subsequent events.\n';

const defaultCharacterSheet: GameState = {
  timestamp: '1000-01-01T08:00:00',
  stats: {
    hp: 100,
    max_hp: 100,
    gold: 50,
    xp: 0,
    level: 1,
    strength: 10,
    defense: 5,
    stunned: 0,
    poisoned: 0,
    scars: 0,
    num_day: 0
  },
  activeConditions: [],
  flags: []
};

const basicFantasyCartridge: GameCartridge = {
  name: 'Outposts & Ogres – Basic',
  version: '1.0.0',

  stopConditions: ['combat', 'exploration', 'social'],

  availableActions: {
    combat: ['attack', 'dodge', 'cast', 'defend', 'flee'],
    exploration: ['search', 'move', 'rest', 'use', 'inspect'],
    social: ['persuade', 'intimidate', 'deceive', 'barter', 'ask']
  },

  defaultGameState: defaultCharacterSheet,

  ruleSequence: [
    'drink_potion',
    'combat_event',
    'travel',
    'rest',
    'attack', 'cast', 'defend', 'dodge', 'flee', // combat
    'persuade', 'intimidate', 'deceive', 'barter', 'ask', // social
    'inspect', 'search', 'move', 'use' // exploration (rest handled above)
  ],

  worldEventTrackers: [
    {
      key: 'drink_potion',
      what: "string; type of potion; allowed values are 'healing', 'strength', 'poison'",
      when: 'string; time of consumption; in yyyy-mm-ddTHH:MM:SS format',
      meters: {
        potency: 'number; strength or quality of the potion (1-10)'
      },
      condition: '{{user}} drinks a potion'
    },
    {
      key: 'combat_event',
      what: "string; type of combat event; allowed values are 'player_attack', 'enemy_attack', 'combat_end'",
      when: 'string; time of event; in yyyy-mm-ddTHH:MM:SS format',
      meters: {
        damage: 'number; amount of damage dealt or received',
        gold_gained: 'number; gold looted',
        xp_gained: 'number; experience gained'
      },
      flags: {
        critical: 'boolean; true if it was a critical hit'
      },
      condition: 'Combat is happening or ending'
    },
    {
      key: 'travel',
      what: "string; mode of travel; allowed values are 'walk', 'run', 'ride'",
      when: 'string; time of arrival at destination; in yyyy-mm-ddTHH:MM:SS format',
      condition: '{{user}} travels to a new location'
    },
    {
      key: 'rest',
      what: "string; type of rest; allowed values are 'short', 'long'",
      when: 'string; time when rest finishes; in yyyy-mm-ddTHH:MM:SS format',
      condition: '{{user}} takes a rest'
    }
  ],

  turnEndTriggers: [
    'Combat Round Ends',
    'Critical Injury',
    'Travel complete'
  ],

  gameRules: {
    drink_potion: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            narrationGuidance: ['If {{user}} finds a potion, describe its appearance (color, smell).'],
            mayHappen: ['If {{user}} finds a potion, describe its appearance (color, smell).'],
            mustNotHappen: ['Do not narrate {{user}} drinking a potion unless the player explicitly says so.']
          },
          stateMutations: []
        };
      }
      const effect = context.effectData as Record<string, unknown>;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let potionType = 'healing';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        potionType = extractMatch(['healing', 'strength', 'poison'], 'healing', effect['what'] as string);
      }

      let potency = 1;
      if (typeCheck && typeCheck['meters']) {
        const meters = typeCheck['meters'] as Record<string, boolean>;
        const effectMeters = effect['meters'] as Record<string, number> | undefined;
        if (meters['potency'] && effectMeters && typeof effectMeters['potency'] === 'number') {
          potency = Math.max(1, Math.min(10, effectMeters['potency']));
        }
      }

      let whenTime = sheet.timestamp;
      if (typeCheck && typeCheck['when'] && effect['when'] && (effect['when'] as string) <= sheet.timestamp) {
        whenTime = effect['when'] as string;
      }

      const sideEffects: ActiveCondition[] = [];
      let narrationGuide = '';

      if (potionType === 'healing') {
        const healAmount = potency * 10;
        const currentHP = sheet.stats['hp'] || 0;
        const maxHP = sheet.stats['max_hp'] || 100;
        let actualHeal = healAmount;
        if (currentHP + healAmount > maxHP) {
          actualHeal = maxHP - currentHP;
        }

        if (actualHeal > 0) {
          sideEffects.push({
            what: 'drank healing potion (potency ' + potency + ')',
            temp: false,
            impacts: [{ stats: 'hp', op: 'add', val: actualHeal }]
          });
          narrationGuide = '{{user}} feels a warm energy. Wounds close up. (Healed ' + actualHeal + ' HP).\n';
        } else {
          narrationGuide = '{{user}} feels warm, but is already at full health.\n';
        }
      } else if (potionType === 'strength') {
        const duration = 'PT10M';
        const expiryTime = addDuration(whenTime, duration);

        sideEffects.push({
          what: 'drank strength potion (potency ' + potency + ')',
          temp: true,
          expiry: expiryTime,
          impacts: [{ stats: 'strength', op: 'add', val: potency * 5 }]
        });
        narrationGuide = '{{user}} feels a surge of power! Strength increased by ' + (potency * 5) + ' for 10 minutes.\n';
      } else if (potionType === 'poison') {
        const duration = 'PT1H';
        const expiryTime = addDuration(whenTime, duration);

        sideEffects.push({
          what: 'drank poison (potency ' + potency + ')',
          temp: true,
          expiry: expiryTime,
          impacts: [{ stats: 'poisoned', op: 'set', val: 1 }]
        });
        narrationGuide = '{{user}} feels sick. You are Poisoned for 1 hour.\n';
      }

      return {
        stateMutations: sideEffects,
        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [narrationGuide] }
      };
    },

    combat_event: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            narrationGuidance: ["If combat starts, describe the enemy and the environment. Wait for {{user}}'s action."],
            mayHappen: ["If combat starts, describe the enemy and the environment. Wait for {{user}}'s action."],
            mustNotHappen: ['Do not resolve combat damage or combat outcomes without a corresponding combat event.']
          },
          stateMutations: []
        };
      }
      const effect = context.effectData as Record<string, unknown>;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let eventType = 'enemy_attack';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        eventType = extractMatch(['player_attack', 'enemy_attack', 'combat_end'], 'enemy_attack', effect['what'] as string);
      }

      let damage = 0;
      if (typeCheck && typeCheck['meters']) {
        const meters = typeCheck['meters'] as Record<string, boolean>;
        const effectMeters = effect['meters'] as Record<string, number> | undefined;
        if (meters['damage'] && effectMeters && typeof effectMeters['damage'] === 'number') {
          damage = Math.max(0, effectMeters['damage']);
        }
      }

      const sideEffects: ActiveCondition[] = [];
      let narrationGuide = '';

      if (eventType === 'enemy_attack') {
        const isCritical = !!(typeCheck && typeCheck['flags'] &&
          (typeCheck['flags'] as Record<string, boolean>)['critical'] &&
          effect['flags'] && (effect['flags'] as Record<string, boolean>)['critical'] === true);

        const defense = sheet.stats['defense'] || 0;
        let actualDamage = Math.max(1, damage - defense);
        if (isCritical) {
          actualDamage = Math.floor(damage * 1.5) - defense;
          if (actualDamage < 1) actualDamage = 1;
        }

        sideEffects.push({
          what: 'took damage from enemy',
          temp: false,
          impacts: [{ stats: 'hp', op: 'sub', val: actualDamage }]
        });

        narrationGuide = '{{user}} takes ' + actualDamage + ' damage! (Defense reduced it from ' + damage + ').\n';

        if (isCritical && actualDamage > 10) {
          // 50% chance of permanent scar
          if (sumRolls(rollDice(1, 100)) > 50) {
            sideEffects.push({
              what: 'received a permanent scar',
              temp: false,
              impacts: [{ stats: 'scars', op: 'add', val: 1 }]
            });
            narrationGuide += 'The attack leaves a nasty, permanent scar.\n';
          }
        }

        // Temporary stun if damage > 20
        if (actualDamage > 20) {
          const stunnedExpiry = addDuration(sheet.timestamp, 'PT1M');
          sideEffects.push({
            what: 'stunned by heavy blow',
            temp: true,
            expiry: stunnedExpiry,
            impacts: [{ stats: 'stunned', op: 'set', val: 1 }]
          });
          narrationGuide += '{{user}} is STUNNED and cannot act next turn!\n' + END_THIS_TURN;
        } else {
          narrationGuide += 'Describe the hit impact.\n';
        }
      } else if (eventType === 'combat_end') {
        let gold = 0;
        let xp = 0;
        if (typeCheck && typeCheck['meters']) {
          const meters = typeCheck['meters'] as Record<string, boolean>;
          const effectMeters = effect['meters'] as Record<string, number> | undefined;
          if (meters['gold_gained'] && effectMeters) gold = effectMeters['gold_gained'] || 0;
          if (meters['xp_gained'] && effectMeters) xp = effectMeters['xp_gained'] || 0;
        }

        sideEffects.push({
          what: 'combat victory rewards',
          temp: false,
          impacts: [
            { stats: 'gold', op: 'add', val: gold },
            { stats: 'xp', op: 'add', val: xp }
          ]
        });
        narrationGuide = 'Combat Over! Gained ' + gold + ' gold and ' + xp + ' XP.\n';
      }

      return {
        stateMutations: sideEffects,
        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [narrationGuide] }
      };
    },

    travel: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            narrationGuidance: [],
            mustNotHappen: ['Do not narrate {{user}} traveling to a new location unless the player explicitly says so.']
          },
          stateMutations: []
        };
      }
      const effect = context.effectData as Record<string, unknown>;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let arrivalTime = sheet.timestamp;
      if (typeCheck && typeCheck['when'] && effect['when']) {
        if ((effect['when'] as string) > sheet.timestamp) {
          arrivalTime = effect['when'] as string;
        }
      }

      let travelMode = 'walk';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        travelMode = extractMatch(['walk', 'run', 'ride'], 'walk', effect['what'] as string);
      }

      const sideEffects: ActiveCondition[] = [];
      sideEffects.push({
        what: 'traveled (' + travelMode + ')',
        temp: false,
        impacts: []
      });

      if (travelMode === 'run') {
        const fatigueExpiry = addDuration(arrivalTime, 'PT30M');
        sideEffects.push({
          what: 'fatigued from running',
          temp: true,
          expiry: fatigueExpiry,
          impacts: [{ stats: 'strength', op: 'sub', val: 2 }]
        });
      }

      return {
        stateMutations: sideEffects,
        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: ['Arrived at destination at ' + formatDate(new Date(arrivalTime)) + '.\n' + END_THIS_TURN] }
      };
    },

    rest: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            narrationGuidance: [],
            mustNotHappen: ['Do not narrate {{user}} resting unless the player explicitly says so.']
          },
          stateMutations: []
        };
      }
      const effect = context.effectData as Record<string, unknown>;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let restType = 'short';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        restType = extractMatch(['short', 'long'], 'short', effect['what'] as string);
      }

      let wakeTime = sheet.timestamp;
      if (typeCheck && typeCheck['when'] && effect['when'] && (effect['when'] as string) > sheet.timestamp) {
        wakeTime = effect['when'] as string;
      } else {
        const duration = (restType === 'long') ? 'PT8H' : 'PT1H';
        wakeTime = addDuration(sheet.timestamp, duration);
      }

      const sideEffects: ActiveCondition[] = [];
      const hp = sheet.stats['hp'] || 0;
      const maxHP = sheet.stats['max_hp'] || 100;

      if (restType === 'short') {
        const heal = Math.floor(maxHP * 0.25);
        sideEffects.push({
          what: 'short rest',
          temp: false,
          impacts: [{ stats: 'hp', op: 'add', val: heal }]
        });
      } else {
        sideEffects.push({
          what: 'long rest',
          temp: false,
          impacts: [{ stats: 'hp', op: 'set', val: maxHP }]
        });
      }

      return {
        stateMutations: sideEffects,
        outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: ['Awoke from rest at ' + formatDate(new Date(wakeTime)) + '. HP is now ' + (hp + (restType === 'short' ? Math.floor(maxHP * 0.25) : maxHP)) + '.\n' + END_THIS_TURN] }
      };
    },
  }
};

const logicMap: Array<{ condition: string, action: string, stat: string, diff: number, success: string, failure: string }> = [
  { condition: 'combat', action: 'attack', stat: 'strength', diff: 10, success: `You attack decisively.`, failure: 'Your attack misses the mark.' },
  { condition: 'combat', action: 'cast', stat: 'intelligence', diff: 12, success: 'Your spell erupts with power.', failure: 'Your spell fizzles harmlessly.' },
  { condition: 'combat', action: 'defend', stat: 'constitution', diff: 10, success: 'You brace and deflect the blow.', failure: 'Your guard is broken.' },
  { condition: 'combat', action: 'dodge', stat: 'dexterity', diff: 12, success: 'You gracefully evade the danger.', failure: 'You fail to get out of the way in time.' },
  { condition: 'combat', action: 'flee', stat: 'dexterity', diff: 15, success: 'You manage to escape the encounter.', failure: 'Your escape route is blocked.' },

  { condition: 'social', action: 'persuade', stat: 'charisma', diff: 10, success: 'They listen intently to your words.', failure: 'Your words fall on deaf ears.' },
  { condition: 'social', action: 'intimidate', stat: 'strength', diff: 12, success: 'They shrink back from your imposing stance.', failure: 'They stand their ground, unimpressed.' },
  { condition: 'social', action: 'deceive', stat: 'charisma', diff: 15, success: 'They buy your deception completely.', failure: 'They see right through your lies.' },
  { condition: 'social', action: 'barter', stat: 'charisma', diff: 12, success: 'You strike a favourable deal.', failure: 'The negotiation goes poorly.' },
  { condition: 'social', action: 'ask', stat: 'wisdom', diff: 10, success: 'You gather useful information.', failure: 'They refuse to tell you anything.' },

  { condition: 'exploration', action: 'inspect', stat: 'wisdom', diff: 12, success: 'You spot danger or hidden secrets.', failure: 'You notice nothing unusual.' },
  { condition: 'exploration', action: 'search', stat: 'intelligence', diff: 15, success: 'You uncover hidden loot or mechanics.', failure: 'You find only dust and cobwebs.' },
  { condition: 'exploration', action: 'move', stat: 'constitution', diff: 5, success: 'You make good progress.', failure: 'The path is grueling and slow.' },
  { condition: 'exploration', action: 'use', stat: 'intelligence', diff: 10, success: `You handle the item properly.`, failure: 'You fumble with the item.' }
];

logicMap.forEach(match => {
  basicFantasyCartridge.gameRules[match.action] = function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
    const parentIntent = context.action?.find(a => a.action === match.action);
    if (!parentIntent) {
      return {
        outcome: {
          status: 'neutral', mechanicsLogs: [],
          narrationGuidance: [],
          mustNotHappen: ['Do not narrate {{user}} performing ' + match.action + ' unless the player explicitly says so.']
        },
        stateMutations: []
      };
    }

    if (context.currentCondition !== match.condition) {
      return {
        outcome: {
          actionName: parentIntent.action,
          actionTarget: parentIntent.target,
          status: 'neutral',
          mechanicsLogs: [`Action '${parentIntent.action}' is not optimal in condition '${context.currentCondition}'.`],
          narrationGuidance: [`The player attempts to ${parentIntent.action}${parentIntent.target ? ' ' + parentIntent.target : ''}.`]
        },
        stateMutations: []
      };
    }

    let statValue = sheet.stats[match.stat];
    if (typeof statValue !== 'number') statValue = 10;

    let bonus = 0;
    if (statValue > 10) {
      bonus = Math.floor((statValue - 10) / 2);
    } else if (statValue < 10) {
      bonus = Math.floor((statValue - 10) / 2); // Negative stat mod
    }

    const rolls = rollDice(1, 20);
    const total = sumRolls(rolls);
    const isSuccess = (total + bonus) >= match.diff;

    return {
      outcome: {
        actionName: parentIntent.action,
        actionTarget: parentIntent.target,
        status: isSuccess ? 'success' : 'failure',
        mechanicsLogs: [
          `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty ${match.diff}.`
        ],
        narrationGuidance: [isSuccess ? match.success : match.failure]
      },
      stateMutations: []
    };
  };
});
export { basicFantasyCartridge };
