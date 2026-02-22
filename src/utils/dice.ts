/**
 * Dice rolling utility for the RPG system.
 */

export interface DiceRollResult {
  sides: number;
  value: number;
}

/**
 * Roll a single die with the given number of sides.
 * Returns a value between 1 and sides (inclusive).
 */
function rollDie(sides: number): DiceRollResult {
  const value = Math.floor(Math.random() * sides) + 1;
  return { sides: sides, value: value };
}

/**
 * Roll multiple dice and return the individual results.
 */
function rollDice(count: number, sides: number): DiceRollResult[] {
  const results: DiceRollResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie(sides));
  }
  return results;
}

/**
 * Sum the values from an array of dice roll results.
 */
function sumRolls(rolls: DiceRollResult[]): number {
  let total = 0;
  for (let i = 0; i < rolls.length; i++) {
    total = total + rolls[i].value;
  }
  return total;
}

export { rollDie, rollDice, sumRolls };
