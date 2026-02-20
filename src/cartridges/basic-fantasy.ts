/**
 * Basic Fantasy cartridge – a simple fantasy RPG rule book.
 *
 * This serves as both a working example and the out-of-the-box game system.
 * It can be swapped out for any other GameCartridge at runtime.
 *
 * Includes effect definitions and aspect functions ported from adult-scripts
 * to achieve feature parity with the showcase branch.
 */

import { GameCartridge, CharacterSheet, AspectFunctionResult, SideEffect } from '../types';
import { extractMatch } from '../utils/text-utils';
import { addDuration, formatDate } from '../utils/time-utils';
import { rollDice, sumRolls } from '../utils/dice';

const END_THIS_TURN = 'Then, end this turn (i.e. give NARRATION_SUMMARY block) and ' +
  'wait for the Script to provide subsequent events.\n';

const defaultCharacterSheet: CharacterSheet = {
  cur_ts: '1000-01-01T08:00:00',
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
  se: [],
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

  defaultCharacterSheet: defaultCharacterSheet,

  effectDefinitions: [
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

  aspectFunctions: {
    drink_potion: function (sheet: CharacterSheet, effect: Record<string, unknown> | null, typeCheck: Record<string, unknown> | null): AspectFunctionResult {
      if (effect === null) {
        return {
          narrationGuide: 'If {{user}} finds a potion, describe its appearance (color, smell).',
          sideEffect: null
        };
      }

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

      let whenTime = sheet.cur_ts;
      if (typeCheck && typeCheck['when'] && effect['when'] && (effect['when'] as string) <= sheet.cur_ts) {
        whenTime = effect['when'] as string;
      }

      const sideEffects: SideEffect[] = [];
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
        sideEffect: sideEffects.length > 0 ? sideEffects : null,
        narrationGuide: narrationGuide
      };
    },

    combat_event: function (sheet: CharacterSheet, effect: Record<string, unknown> | null, typeCheck: Record<string, unknown> | null): AspectFunctionResult {
      if (effect === null) {
        return {
          narrationGuide: "If combat starts, describe the enemy and the environment. Wait for {{user}}'s action.",
          sideEffect: null
        };
      }

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

      const sideEffects: SideEffect[] = [];
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
          const stunnedExpiry = addDuration(sheet.cur_ts, 'PT1M');
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
        sideEffect: sideEffects.length > 0 ? sideEffects : null,
        narrationGuide: narrationGuide
      };
    },

    travel: function (sheet: CharacterSheet, effect: Record<string, unknown> | null, typeCheck: Record<string, unknown> | null): AspectFunctionResult {
      if (effect === null) {
        return { narrationGuide: '', sideEffect: null };
      }

      let arrivalTime = sheet.cur_ts;
      if (typeCheck && typeCheck['when'] && effect['when']) {
        if ((effect['when'] as string) > sheet.cur_ts) {
          arrivalTime = effect['when'] as string;
        }
      }

      let travelMode = 'walk';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        travelMode = extractMatch(['walk', 'run', 'ride'], 'walk', effect['what'] as string);
      }

      const sideEffects: SideEffect[] = [];
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
        sideEffect: sideEffects,
        narrationGuide: 'Arrived at destination at ' + formatDate(new Date(arrivalTime)) + '.\n' + END_THIS_TURN
      };
    },

    rest: function (sheet: CharacterSheet, effect: Record<string, unknown> | null, typeCheck: Record<string, unknown> | null): AspectFunctionResult {
      if (effect === null) return { narrationGuide: '', sideEffect: null };

      let restType = 'short';
      if (typeCheck && typeCheck['what'] && effect['what']) {
        restType = extractMatch(['short', 'long'], 'short', effect['what'] as string);
      }

      let wakeTime = sheet.cur_ts;
      if (typeCheck && typeCheck['when'] && effect['when'] && (effect['when'] as string) > sheet.cur_ts) {
        wakeTime = effect['when'] as string;
      } else {
        const duration = (restType === 'long') ? 'PT8H' : 'PT1H';
        wakeTime = addDuration(sheet.cur_ts, duration);
      }

      const sideEffects: SideEffect[] = [];
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
        sideEffect: sideEffects,
        narrationGuide: 'Rested until ' + formatDate(new Date(wakeTime)) + '. HP Restored.\n'
      };
    }
  },

  rules: [
    // ---- Combat ----
    {
      condition: 'combat',
      action: 'attack',
      diceCount: 1,
      diceSides: 20,
      difficulty: 10,
      successPrompt: 'The attack lands solidly. Describe the hit and the damage dealt.',
      failurePrompt: 'The attack misses. Describe how the opponent evades or blocks.'
    },
    {
      condition: 'combat',
      action: 'dodge',
      diceCount: 1,
      diceSides: 20,
      difficulty: 12,
      successPrompt: 'The player deftly avoids the incoming attack. Describe the acrobatic dodge.',
      failurePrompt: 'The dodge fails and the player takes the blow. Describe the impact.'
    },
    {
      condition: 'combat',
      action: 'cast',
      diceCount: 2,
      diceSides: 10,
      difficulty: 14,
      successPrompt: 'The spell fires off successfully. Describe the magical effect.',
      failurePrompt: 'The spell fizzles. Describe the failed incantation.'
    },
    {
      condition: 'combat',
      action: 'defend',
      diceCount: 1,
      diceSides: 20,
      difficulty: 8,
      successPrompt: 'The player raises their guard. Describe the successful defense.',
      failurePrompt: 'The defense crumbles. Describe how the guard breaks.'
    },
    {
      condition: 'combat',
      action: 'flee',
      diceCount: 1,
      diceSides: 20,
      difficulty: 14,
      successPrompt: 'The player escapes the combat. Describe the successful retreat.',
      failurePrompt: 'The escape attempt fails. Describe how the player is blocked.'
    },

    // ---- Exploration ----
    {
      condition: 'exploration',
      action: 'search',
      diceCount: 1,
      diceSides: 20,
      difficulty: 10,
      successPrompt: 'The search reveals something useful. Describe the discovery.',
      failurePrompt: 'The search turns up nothing. Describe the fruitless effort.'
    },
    {
      condition: 'exploration',
      action: 'move',
      diceCount: 1,
      diceSides: 20,
      difficulty: 8,
      successPrompt: 'The player moves safely. Describe the new area.',
      failurePrompt: 'Something impedes the player. Describe the obstacle or hazard encountered.'
    },
    {
      condition: 'exploration',
      action: 'rest',
      diceCount: 1,
      diceSides: 6,
      difficulty: 2,
      successPrompt: 'The rest is peaceful. Describe the recovery.',
      failurePrompt: 'The rest is disturbed. Describe the interruption.'
    },
    {
      condition: 'exploration',
      action: 'use',
      diceCount: 1,
      diceSides: 20,
      difficulty: 10,
      successPrompt: 'The item is used successfully. Describe the effect.',
      failurePrompt: 'The item use fails. Describe what goes wrong.'
    },
    {
      condition: 'exploration',
      action: 'inspect',
      diceCount: 1,
      diceSides: 20,
      difficulty: 10,
      successPrompt: 'The inspection reveals details. Describe what is found.',
      failurePrompt: 'The inspection reveals nothing. Describe the confusion.'
    },

    // ---- Social ----
    {
      condition: 'social',
      action: 'persuade',
      diceCount: 1,
      diceSides: 20,
      difficulty: 12,
      successPrompt: 'The persuasion works. Describe the NPC being convinced.',
      failurePrompt: 'The persuasion fails. Describe the NPC remaining unconvinced.'
    },
    {
      condition: 'social',
      action: 'intimidate',
      diceCount: 1,
      diceSides: 20,
      difficulty: 14,
      successPrompt: 'The intimidation succeeds. Describe the NPC cowering.',
      failurePrompt: 'The intimidation fails. Describe the NPC standing firm.'
    },
    {
      condition: 'social',
      action: 'deceive',
      diceCount: 1,
      diceSides: 20,
      difficulty: 14,
      successPrompt: 'The deception works. Describe the NPC being fooled.',
      failurePrompt: 'The deception is seen through. Describe the NPC catching the lie.'
    },
    {
      condition: 'social',
      action: 'barter',
      diceCount: 1,
      diceSides: 20,
      difficulty: 10,
      successPrompt: 'The barter succeeds. Describe the favorable deal struck.',
      failurePrompt: 'The barter fails. Describe the NPC refusing the offer.'
    },
    {
      condition: 'social',
      action: 'ask',
      diceCount: 1,
      diceSides: 20,
      difficulty: 8,
      successPrompt: 'The NPC shares useful information. Describe what they reveal.',
      failurePrompt: 'The NPC is unhelpful. Describe their evasive answer.'
    }
  ]
};

export { basicFantasyCartridge };
