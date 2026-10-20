import { describe, expect, it } from 'vitest'
import { HI_LO, Counter, COUNT_SYSTEMS } from '../src/domain/counting'
import type { Rank } from '../src/domain/cards'

function card(rank: Rank): { rank: Rank; suit: 'S' } {
  return { rank, suit: 'S' }
}

describe('Hi-Lo tags', () => {
  it('tags low cards +1, neutrals 0, highs -1', () => {
    expect(HI_LO.tags['2']).toBe(1)
    expect(HI_LO.tags['6']).toBe(1)
    expect(HI_LO.tags['7']).toBe(0)
    expect(HI_LO.tags['9']).toBe(0)
    expect(HI_LO.tags['T']).toBe(-1)
    expect(HI_LO.tags['A']).toBe(-1)
  })

  it('is registered as a pluggable system', () => {
    expect(COUNT_SYSTEMS).toContain(HI_LO)
    expect(HI_LO.balanced).toBe(true)
  })
})

describe('Counter', () => {
  it('accumulates the running count over exposed cards', () => {
    const counter = new Counter(HI_LO)
    counter.observe(card('5'))
    counter.observe(card('T'))
    counter.observe(card('8'))
    counter.observe(card('3'))
    expect(counter.running).toBe(1)
    expect(counter.seen).toBe(4)
  })

  it('computes the true count from remaining cards', () => {
    const counter = new Counter(HI_LO)
    counter.running = 6
    // 3 decks remaining -> TC 2
    expect(counter.trueCount(156)).toBeCloseTo(2)
    // half a deck remaining clamps the divisor
    counter.running = 3
    expect(counter.trueCount(4)).toBeCloseTo(6)
  })

  it('resets for a fresh shuffle', () => {
    const counter = new Counter(HI_LO)
    counter.observe(card('5'))
    counter.reset()
    expect(counter.running).toBe(0)
    expect(counter.seen).toBe(0)
  })
})
