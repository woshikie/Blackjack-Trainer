import { describe, expect, it } from 'vitest'
import type { Card } from '../src/domain/cards'
import { mulberry32 } from '../src/domain/rng'
import { DEFAULT_RULES } from '../src/domain/rules'
import { Shoe } from '../src/domain/shoe'

const DECK: readonly Card[] = (() => {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'] as const
  const suits = ['S', 'H', 'D', 'C'] as const
  const cards: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) cards.push({ rank, suit })
  }
  return cards
})()

describe('Shoe', () => {
  it('serves a full composition for the configured deck count', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1, csm: false }, mulberry32(1))
    const drawn: Card[] = []
    while (shoe.remaining() > 0) drawn.push(shoe.draw())
    expect(drawn).toHaveLength(52)
    expect(drawn.filter((card) => card.rank === 'A')).toHaveLength(4)
  })

  it('respects a preset order (last element drawn first)', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1 }, mulberry32(1), [DECK[0]!, DECK[1]!, DECK[2]!])
    expect(shoe.draw()).toEqual(DECK[2])
    expect(shoe.draw()).toEqual(DECK[1])
    expect(shoe.draw()).toEqual(DECK[0])
  })

  it('flags the cut card at the configured penetration', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1, penetration: 50, csm: false }, mulberry32(2))
    expect(shoe.needsShuffle()).toBe(false)
    for (let i = 0; i < 25; i++) shoe.discard([shoe.draw()])
    expect(shoe.dealt()).toBe(25)
    expect(shoe.needsShuffle()).toBe(false)
    shoe.discard([shoe.draw()])
    expect(shoe.dealt()).toBe(26)
    expect(shoe.needsShuffle()).toBe(true)
  })

  it('never flags the cut card under a CSM', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1, csm: true }, mulberry32(3))
    for (let i = 0; i < 52; i++) shoe.discard([shoe.draw()])
    expect(shoe.needsShuffle()).toBe(false)
  })

  it('recycles discards back into a CSM shoe', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1, csm: true }, mulberry32(4))
    for (let i = 0; i < 20; i++) shoe.discard([shoe.draw()])
    expect(shoe.remaining()).toBe(32)
    shoe.recycle()
    expect(shoe.remaining()).toBe(52)
    expect(shoe.dealt()).toBe(0)
  })

  it('reshuffles discards on demand and keeps the total constant', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1, csm: false }, mulberry32(5))
    for (let i = 0; i < 30; i++) shoe.discard([shoe.draw()])
    shoe.reshuffle()
    expect(shoe.remaining()).toBe(52)
    expect(shoe.dealt()).toBe(0)
  })

  it('reshuffles mid-round when the shoe runs dry', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1, csm: false }, mulberry32(6))
    for (let i = 0; i < 52; i++) shoe.discard([shoe.draw()])
    expect(shoe.draw()).toBeDefined()
  })

  it('throws when it cannot replenish', () => {
    const shoe = new Shoe({ ...DEFAULT_RULES, decks: 1 }, mulberry32(7), [DECK[0]!])
    shoe.draw()
    expect(() => shoe.draw()).toThrow('shoe is empty')
  })
})
