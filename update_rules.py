import re

file_path = "/home/neolaw/projects/outposts-and-ogres/src/cartridges/basic-fantasy.ts"
with open(file_path, "r") as f:
    text = f.read()

rules_block = """  rules: [
    ...[
      { condition: 'combat', action: 'attack', stat: 'strength', diff: 10, success: 'Your attack strikes true.', failure: 'Your attack misses the mark.' },
      { condition: 'combat', action: 'cast', stat: 'intelligence', diff: 12, success: 'Your spell erupts with power.', failure: 'Your spell fizzles harmlessly.' },
      { condition: 'combat', action: 'defend', stat: 'constitution', diff: 10, success: 'You brace and deflect the blow.', failure: 'Your guard is broken.' },
      { condition: 'combat', action: 'dodge', stat: 'dexterity', diff: 12, success: 'You gracefully evade the danger.', failure: 'You fail to get out of the way in time.' },
      { condition: 'combat', action: 'flee', stat: 'dexterity', diff: 15, success: 'You manage to escape the encounter.', failure: 'Your escape route is blocked.' },
      { condition: 'combat', action: 'use', stat: 'intelligence', diff: 10, success: 'The item is applied correctly.', failure: 'You fail to use the item effectively under pressure.' },
      
      { condition: 'social', action: 'speak', stat: 'charisma', diff: 10, success: 'They listen intently to your words.', failure: 'Your words fall on deaf ears.' },
      { condition: 'social', action: 'intimidate', stat: 'strength', diff: 12, success: 'They shrink back from your imposing stance.', failure: 'They stand their ground, unimpressed.' },
      { condition: 'social', action: 'lie', stat: 'charisma', diff: 15, success: 'They buy your deception completely.', failure: 'They see right through your lies.' },
      { condition: 'social', action: 'bargain', stat: 'charisma', diff: 12, success: 'You strike a favourable deal.', failure: 'The negotiation goes poorly.' },
      { condition: 'social', action: 'inquire', stat: 'wisdom', diff: 10, success: 'You gather useful information.', failure: 'They refuse to tell you anything.' },
      { condition: 'social', action: 'attack', stat: 'strength', diff: 10, success: 'You launch a surprise attack!', failure: 'Your sudden strike is deflected.' },
      { condition: 'social', action: 'cast', stat: 'intelligence', diff: 12, success: 'You cast a spell amidst the conversation.', failure: 'Your spellcasting is interrupted.' },
      { condition: 'social', action: 'flee', stat: 'dexterity', diff: 10, success: 'You abruptly leave the conversation.', failure: 'They block your path to leave.' },
      
      { condition: 'stealth', action: 'sneak', stat: 'dexterity', diff: 12, success: 'You move silently and unseen.', failure: 'You step on a twig, alerting everyone.' },
      { condition: 'stealth', action: 'pickpocket', stat: 'dexterity', diff: 15, success: 'You deftly lift the item.', failure: 'They catch your hand in their pocket.' },
      { condition: 'stealth', action: 'hide', stat: 'dexterity', diff: 10, success: 'You blend perfectly into the shadows.', failure: 'You remain painfully visible.' },
      { condition: 'stealth', action: 'attack', stat: 'strength', diff: 10, success: 'You strike from the shadows!', failure: 'Your ambush fails.' },
      { condition: 'stealth', action: 'cast', stat: 'intelligence', diff: 12, success: 'You silently weave an incantation.', failure: 'The magical glow gives you away.' },
      { condition: 'stealth', action: 'flee', stat: 'dexterity', diff: 10, success: 'You slip away undetected.', failure: 'You are spotted as you try to run.' },
      
      { condition: 'exploration', action: 'scout', stat: 'wisdom', diff: 12, success: 'You spot danger ahead.', failure: 'You notice nothing unusual.' },
      { condition: 'exploration', action: 'search', stat: 'intelligence', diff: 15, success: 'You uncover hidden secrets.', failure: 'You find only dust and cobwebs.' },
      { condition: 'exploration', action: 'travel', stat: 'constitution', diff: 10, success: 'You make good progress on your journey.', failure: 'The journey is grueling and slow.' },
      { condition: 'exploration', action: 'camp', stat: 'survival', diff: 10, success: 'You set up a secure and comfortable camp.', failure: 'Your campsite is exposed and uncomfortable.' },
      { condition: 'exploration', action: 'rest', stat: 'constitution', diff: 2, success: 'You feel fully rested.', failure: 'Your rest is plagued by nightmares.' },
      { condition: 'exploration', action: 'use', stat: 'intelligence', diff: 10, success: 'You handle the item properly.', failure: 'You fumble with the item.' },
      { condition: 'exploration', action: 'inspect', stat: 'wisdom', diff: 10, success: 'You carefully inspect and gather details.', failure: 'Nothing of interest stands out.' }
    ].map(def => {
      return {
        condition: def.condition,
        action: def.action,
        aspectFunction: (
          state: import('../types').GameState, 
          context: import('../types').AspectContext
        ): import('../types').AspectFunctionResult => {
          if (context.type !== 'player_action') {
            return { outcome: { status: 'neutral', mechanicsLogs: [], narrationGuidance: [] }, stateMutations: [] };
          }
          
          let statValue = state.stats[def.stat];
          if (typeof statValue !== 'number') statValue = 10;
          let bonus = 0;
          if (statValue > 10) {
            bonus = Math.floor((statValue - 10) / 2);
          } else if (statValue < 10) {
            bonus = Math.floor((statValue - 10) / 2);
          }

          const rolls = rollDice(1, 20);
          const total = sumRolls(rolls);
          const difficulty = typeof def.diff === 'number' ? def.diff : 10;
          const isSuccess = (total + bonus) >= difficulty;

          return {
            outcome: {
              status: isSuccess ? 'success' : 'failure',
              mechanicsLogs: [
                 `Rolled ${total} + stat mod ${bonus} = ${total + bonus} vs difficulty ${difficulty}.`
              ],
              narrationGuidance: [ isSuccess ? def.success : def.failure ]
            },
            stateMutations: []
          };
        }
      } as import('../types').CartridgeRule;
    })
  ],"""

text = text.replace("  rules: [\n    // Replace this block with our script\n  ],", rules_block)

with open(file_path, "w") as f:
    f.write(text)

print("Rules updated successfully.")
