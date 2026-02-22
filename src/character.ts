class Character {
  private name: string;
  private health: number;
  private maxHealth: number;
  private level: number;

  constructor(name: string, maxHealth: number = 100) {
    this.name = name;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.level = 1;
  }

  public getName(): string {
    return this.name;
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getLevel(): number {
    return this.level;
  }

  public takeDamage(damage: number): void {
    this.health = Math.max(0, this.health - damage);
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  public levelUp(): void {
    this.level = this.level + 1;
    this.maxHealth = this.maxHealth + 10;
    this.health = this.maxHealth;
  }

  public isAlive(): boolean {
    return this.health > 0;
  }
}

export { Character };
