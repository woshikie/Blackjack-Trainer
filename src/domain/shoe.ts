import type { Card } from './cards'
import { freshDecks } from './cards'
import type { Rng } from './rng'
import type { Rules } from './rules'

export class Shoe {
  private undealt: Card[]
  private discards: Card[] = []
  readonly totalCards: number
  private cutAfter: number
  private readonly csm: boolean

  constructor(
    rules: Pick<Rules, 'decks' | 'penetration' | 'csm'>,
    private rng: Rng,
    preset?: readonly Card[],
  ) {
    this.totalCards = preset ? preset.length : rules.decks * 52
    this.undealt = preset ? [...preset] : this.shuffledFresh(rules.decks)
    this.csm = rules.csm
    // CSM: cards return continuously, penetration is meaningless.
    this.cutAfter = rules.csm
      ? this.totalCards
      : Math.floor((this.totalCards * rules.penetration) / 100)
  }

  private shuffledFresh(decks: number): Card[] {
    const cards = freshDecks(decks)
    this.shuffle(cards)
    return cards
  }

  private shuffle(cards: Card[]): void {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      const tmp = cards[i]!
      cards[i] = cards[j]!
      cards[j] = tmp
    }
  }

  draw(): Card {
    if (this.undealt.length === 0) this.reshuffle()
    const card = this.undealt.pop()
    if (!card) throw new Error('shoe is empty')
    return card
  }

  discard(cards: readonly Card[]): void {
    this.discards.push(...cards)
  }

  /** CSM: return the discards to the shoe and reshuffle. */
  recycle(): void {
    this.undealt.push(...this.discards)
    this.discards = []
    this.shuffle(this.undealt)
  }

  /** Cut card reached (never under CSM). */
  needsShuffle(): boolean {
    if (this.csm) return false
    return this.dealt() >= this.cutAfter
  }

  dealt(): number {
    // every card that has left the shoe since the last shuffle, discards included
    return this.totalCards - this.undealt.length
  }

  remaining(): number {
    return this.undealt.length
  }

  reshuffle(): void {
    this.undealt.push(...this.discards)
    this.discards = []
    this.shuffle(this.undealt)
  }
}
