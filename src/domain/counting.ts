import type { Card, Rank } from './cards'

export interface CountSystem {
  id: string
  name: string
  balanced: boolean
  tags: Readonly<Record<Rank, number>>
}

export const HI_LO: CountSystem = {
  id: 'hilo',
  name: 'Hi-Lo',
  balanced: true,
  tags: {
    A: -1,
    '2': 1,
    '3': 1,
    '4': 1,
    '5': 1,
    '6': 1,
    '7': 0,
    '8': 0,
    '9': 0,
    T: -1,
    J: -1,
    Q: -1,
    K: -1,
  },
}

/** Registry so other systems (KO, Zen, ...) can plug in later. */
export const COUNT_SYSTEMS: readonly CountSystem[] = [HI_LO]

export class Counter {
  running = 0
  seen = 0

  constructor(readonly system: CountSystem) {}

  observe(card: Card): void {
    this.running += this.system.tags[card.rank]
    this.seen++
  }

  /** True count from the cards still in the shoe (continuous, clamped at half a deck). */
  trueCount(cardsRemaining: number): number {
    const decksRemaining = Math.max(cardsRemaining / 52, 0.5)
    return this.running / decksRemaining
  }

  reset(): void {
    this.running = 0
    this.seen = 0
  }
}
