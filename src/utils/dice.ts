export interface DiceRollResult {
  sides: number;
  value: number;
}

function rollDie(sides: number): DiceRollResult {
  const value = Math.floor(Math.random() * sides) + 1;
  return { sides: sides, value: value };
}

function rollDice(count: number, sides: number): DiceRollResult[] {
  const results: DiceRollResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie(sides));
  }
  return results;
}

function sumRolls(rolls: DiceRollResult[]): number {
  let total = 0;
  for (let i = 0; i < rolls.length; i++) {
    total = total + rolls[i].value;
  }
  return total;
}

export { rollDie, rollDice, sumRolls };
