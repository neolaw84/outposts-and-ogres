import { rollDie, rollDice, sumRolls } from '../src/systems/dice';

describe('Dice', () => {
  test('rollDie should return value between 1 and sides', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDie(6);
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(6);
      expect(result.sides).toBe(6);
    }
  });

  test('rollDie should work with d20', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDie(20);
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(20);
      expect(result.sides).toBe(20);
    }
  });

  test('rollDice should return correct number of results', () => {
    const results = rollDice(3, 6);
    expect(results.length).toBe(3);
    for (let i = 0; i < results.length; i++) {
      expect(results[i].sides).toBe(6);
      expect(results[i].value).toBeGreaterThanOrEqual(1);
      expect(results[i].value).toBeLessThanOrEqual(6);
    }
  });

  test('sumRolls should sum all roll values', () => {
    const rolls = [
      { sides: 6, value: 3 },
      { sides: 6, value: 5 },
      { sides: 6, value: 1 }
    ];
    expect(sumRolls(rolls)).toBe(9);
  });

  test('sumRolls should return 0 for empty array', () => {
    expect(sumRolls([])).toBe(0);
  });
});
