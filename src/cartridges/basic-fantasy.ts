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

/**
 * Calculate the stat modifier bonus (D&D-style: (stat - 10) / 2, rounded down).
 * Returns 0 when the stat equals 10.
 */
function calculateStatBonus(statValue: unknown): number {
  const v = typeof statValue === 'number' ? statValue : 10;
  return Math.floor((v - 10) / 2);
}

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

  stopConditions: ['combat', 'exploration', 'social', 'Combat Round Ends', 'Critical Injury', 'Travel complete'],

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

  gameRules: {
    drink_potion: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} drinking a potion unless the player explicitly says so.'],
            mayHappen: ['If {{user}} finds a potion, describe its appearance (color, smell).']
          },
          stateMutations: []
        };
      }
      const effect = context.effectData!;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let potionType = 'healing';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        potionType = extractMatch(['healing', 'strength', 'poison'], 'healing', effect['what']);
      }

      let potency = 1;
      if (typeCheck && typeCheck['meters']) {
        const meters = typeCheck['meters'] as Record<string, boolean>;
        const effectMeters = effect['meters'];
        if (meters['potency'] && effectMeters && typeof effectMeters['potency'] === 'number') {
          potency = Math.max(1, Math.min(10, effectMeters['potency']));
        }
      }

      let whenTime = sheet.timestamp;
      if (typeCheck && typeCheck['when'] && effect['when'] && effect['when'] <= sheet.timestamp) {
        whenTime = effect['when'];
      }

      const sideEffects: ActiveCondition[] = [];
      let mustHappenMsg = '';

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
          mustHappenMsg = '{{user}} feels a warm energy. Wounds close up. (Healed ' + actualHeal + ' HP).\n';
        } else {
          mustHappenMsg = '{{user}} feels warm, but is already at full health.\n';
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
        mustHappenMsg = '{{user}} feels a surge of power! Strength increased by ' + (potency * 5) + ' for 10 minutes.\n';
      } else if (potionType === 'poison') {
        const duration = 'PT1H';
        const expiryTime = addDuration(whenTime, duration);

        sideEffects.push({
          what: 'drank poison (potency ' + potency + ')',
          temp: true,
          expiry: expiryTime,
          impacts: [{ stats: 'poisoned', op: 'set', val: 1 }]
        });
        mustHappenMsg = '{{user}} feels sick. You are Poisoned for 1 hour.\n';
      }

      return {
        stateMutations: sideEffects,
        outcome: { status: 'neutral', mechanicsLogs: [], mustHappen: [mustHappenMsg], mustNotHappen: [], mayHappen: [] }
      };
    },

    combat_event: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not resolve combat damage or combat outcomes without a corresponding combat event.'],
            mayHappen: ["If combat starts, describe the enemy and the environment. Wait for {{user}}'s action."]
          },
          stateMutations: []
        };
      }
      const effect = context.effectData!;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let eventType = 'enemy_attack';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        eventType = extractMatch(['player_attack', 'enemy_attack', 'combat_end'], 'enemy_attack', effect['what']);
      }

      let damage = 0;
      if (typeCheck && typeCheck['meters']) {
        const meters = typeCheck['meters'] as Record<string, boolean>;
        const effectMeters = effect['meters'];
        if (meters['damage'] && effectMeters && typeof effectMeters['damage'] === 'number') {
          damage = Math.max(0, effectMeters['damage']);
        }
      }

      const sideEffects: ActiveCondition[] = [];
      let mustHappenMsg = '';

      if (eventType === 'enemy_attack') {
        const isCritical = !!(typeCheck && typeCheck['flags'] &&
          (typeCheck['flags'] as Record<string, boolean>)['critical'] &&
          effect['flags'] && effect['flags']['critical'] === true);

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

        mustHappenMsg = '{{user}} takes ' + actualDamage + ' damage! (Defense reduced it from ' + damage + ').\n';

        if (isCritical && actualDamage > 10) {
          // 50% chance of permanent scar
          if (sumRolls(rollDice(1, 100)) > 50) {
            sideEffects.push({
              what: 'received a permanent scar',
              temp: false,
              impacts: [{ stats: 'scars', op: 'add', val: 1 }]
            });
            mustHappenMsg += 'The attack leaves a nasty, permanent scar.\n';
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
          mustHappenMsg += '{{user}} is STUNNED and cannot act next turn!\n' + END_THIS_TURN;
        } else {
          mustHappenMsg += 'Describe the hit impact.\n';
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
        mustHappenMsg = 'Combat Over! Gained ' + gold + ' gold and ' + xp + ' XP.\n';
      }

      return {
        stateMutations: sideEffects,
        outcome: { status: 'neutral', mechanicsLogs: [], mustHappen: [mustHappenMsg], mustNotHappen: [], mayHappen: [] }
      };
    },

    travel: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} traveling to a new location unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }
      const effect = context.effectData!;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let arrivalTime = sheet.timestamp;
      if (typeCheck && typeCheck['when'] && effect['when']) {
        if (effect['when'] > sheet.timestamp) {
          arrivalTime = effect['when'];
        }
      }

      let travelMode = 'walk';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        travelMode = extractMatch(['walk', 'run', 'ride'], 'walk', effect['what']);
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
        outcome: { status: 'neutral', mechanicsLogs: [], mustHappen: ['Arrived at destination at ' + formatDate(new Date(arrivalTime)) + '.\n' + END_THIS_TURN], mustNotHappen: [], mayHappen: [] }
      };
    },

    rest: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      if (!context.effectData) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} resting unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }
      const effect = context.effectData!;
      const typeCheck = context.typeCheck as Record<string, unknown> | null;

      let restType = 'short';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        restType = extractMatch(['short', 'long'], 'short', effect['what']);
      }

      let wakeTime = sheet.timestamp;
      if (typeCheck && typeCheck['when'] && effect['when'] && effect['when'] > sheet.timestamp) {
        wakeTime = effect['when'];
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
        outcome: { status: 'neutral', mechanicsLogs: [], mustHappen: ['Awoke from rest at ' + formatDate(new Date(wakeTime)) + '. HP is now ' + (hp + (restType === 'short' ? Math.floor(maxHP * 0.25) : maxHP)) + '.\n' + END_THIS_TURN], mustNotHappen: [], mayHappen: [] }
      };
    },

    attack: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'attack');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing attack unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'combat') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['strength']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 10;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 10.`
          ],
          mustHappen: [isSuccess ? 'You attack decisively.' : 'Your attack misses the mark.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    cast: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'cast');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing cast unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'combat') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['intelligence']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 12;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 12.`
          ],
          mustHappen: [isSuccess ? 'Your spell erupts with power.' : 'Your spell fizzles harmlessly.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    defend: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'defend');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing defend unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'combat') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['constitution']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 10;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 10.`
          ],
          mustHappen: [isSuccess ? 'You brace and deflect the blow.' : 'Your guard is broken.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    dodge: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'dodge');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing dodge unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'combat') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['dexterity']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 12;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 12.`
          ],
          mustHappen: [isSuccess ? 'You gracefully evade the danger.' : 'You fail to get out of the way in time.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    flee: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'flee');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing flee unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'combat') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['dexterity']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 15;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 15.`
          ],
          mustHappen: [isSuccess ? 'You manage to escape the encounter.' : 'Your escape route is blocked.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    persuade: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'persuade');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing persuade unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'social') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['charisma']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 10;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 10.`
          ],
          mustHappen: [isSuccess ? 'They listen intently to your words.' : 'Your words fall on deaf ears.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    intimidate: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'intimidate');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing intimidate unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'social') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['strength']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 12;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 12.`
          ],
          mustHappen: [isSuccess ? 'They shrink back from your imposing stance.' : 'They stand their ground, unimpressed.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    deceive: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'deceive');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing deceive unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'social') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['charisma']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 15;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 15.`
          ],
          mustHappen: [isSuccess ? 'They buy your deception completely.' : 'They see right through your lies.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    barter: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'barter');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing barter unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'social') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['charisma']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 12;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 12.`
          ],
          mustHappen: [isSuccess ? 'You strike a favourable deal.' : 'The negotiation goes poorly.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    ask: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'ask');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing ask unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'social') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['wisdom']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 10;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 10.`
          ],
          mustHappen: [isSuccess ? 'You gather useful information.' : 'They refuse to tell you anything.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    inspect: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'inspect');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing inspect unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'exploration') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['wisdom']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 12;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 12.`
          ],
          mustHappen: [isSuccess ? 'You spot danger or hidden secrets.' : 'You notice nothing unusual.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    search: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'search');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing search unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'exploration') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['intelligence']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 15;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 15.`
          ],
          mustHappen: [isSuccess ? 'You uncover hidden loot or mechanics.' : 'You find only dust and cobwebs.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    move: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'move');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing move unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'exploration') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['constitution']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 5;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 5.`
          ],
          mustHappen: [isSuccess ? 'You make good progress.' : 'The path is grueling and slow.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },

    use: function (sheet: GameState, context: import('../types').RuleContext): RuleResolution {
      const parentIntent = context.action?.find(a => a.effect.key === 'use');
      if (!parentIntent) {
        return {
          outcome: {
            status: 'neutral', mechanicsLogs: [],
            mustHappen: [],
            mustNotHappen: ['Do not narrate {{user}} performing use unless the player explicitly says so.'],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      if (context.currentCondition !== 'exploration') {
        return {
          outcome: {
            actionName: parentIntent.effect.key,
            actionTarget: (parentIntent.effect.what || ''),
            status: 'neutral',
            mechanicsLogs: [`Action '${parentIntent.effect.key}' is not optimal in condition '${context.currentCondition}'.`],
            mustHappen: [`The player attempts to ${parentIntent.effect.key}${parentIntent.effect.what ? ' ' + parentIntent.effect.what : ''}.`],
            mustNotHappen: [],
            mayHappen: []
          },
          stateMutations: []
        };
      }

      const bonus = calculateStatBonus(sheet.stats['intelligence']);

      const rolls = rollDice(1, 20);
      const total = sumRolls(rolls);
      const isSuccess = (total + bonus) >= 10;

      return {
        outcome: {
          actionName: parentIntent.effect.key,
          actionTarget: (parentIntent.effect.what || ''),
          status: isSuccess ? 'success' : 'failure',
          mechanicsLogs: [
            `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty 10.`
          ],
          mustHappen: [isSuccess ? 'You handle the item properly.' : 'You fumble with the item.'],
          mustNotHappen: [],
          mayHappen: []
        },
        stateMutations: []
      };
    },
  }
};

export { basicFantasyCartridge };
