/**
 * Basic Fantasy cartridge – a simple fantasy RPG rule book.
 *
 * This serves as both a working example and the out-of-the-box game system.
 * It can be swapped out for any other GameCartridge at runtime.
 */

import { GameCartridge } from '../types';

const basicFantasyCartridge: GameCartridge = {
  name: 'Outposts & Ogres – Basic',
  version: '1.0.0',

  stopConditions: ['combat', 'exploration', 'social'],

  availableActions: {
    combat: ['attack', 'dodge', 'cast', 'defend', 'flee'],
    exploration: ['search', 'move', 'rest', 'use', 'inspect'],
    social: ['persuade', 'intimidate', 'deceive', 'barter', 'ask']
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
