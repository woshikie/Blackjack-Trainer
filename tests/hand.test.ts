import { describe, expect, it } from 'vitest'
import { RANKS, freshDecks, rankValue } from '../src/domain/cards'
import type { Rank, Suit } from '../src/domain/cards'
import { handValue, isBust, isNatural, isPair } from '../src/domain/hand'
import type { Card } from '../src/domain/cards'

function c(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit }
}

describe('rankValue', () => {
  it('values ace as 11', () => {
    expect(rankValue('A')).toBe(11)
  })

  it('values ten cards as 10', () => {
    expect(rankValue('T')).toBe(10)
    expect(rankValue('J')).toBe(10)
    expect(rankValue('Q')).toBe(10)
    expect(rankValue('K')).toBe(10)
  })

  it('values number cards as their number', () => {
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9'] as Rank[]) {
      expect(rankValue(rank)).toBe(Number(rank))
    }
  })
})

describe('freshDecks', () => {
  it('builds the full composition', () => {
    const cards = freshDecks(2)
    expect(cards).toHaveLength(104)
    for (const rank of RANKS) {
      expect(cards.filter((card) => card.rank === rank)).toHaveLength(8)
    }
  })
})

describe('handValue', () => {
  it('totals hard hands', () => {
    expect(handValue([c('T'), c('6')])).toEqual({ total: 16, soft: false })
  })

  it('totals soft hands', () => {
    expect(handValue([c('A'), c('5')])).toEqual({ total: 16, soft: true })
  })

  it('downgrades aces to avoid busting', () => {
    expect(handValue([c('A'), c('T'), c('T')])).toEqual({ total: 21, soft: false })
    expect(handValue([c('A'), c('T'), c('T'), c('T')])).toEqual({ total: 31, soft: false })
  })

  it('marks busted hands as hard', () => {
    expect(handValue([c('T'), c('T'), c('T')])).toEqual({ total: 30, soft: false })
  })

  it('handles multiple aces', () => {
    expect(handValue([c('A'), c('A'), c('T')])).toEqual({ total: 12, soft: false })
    expect(handValue([c('A'), c('A'), c('A')])).toEqual({ total: 13, soft: true })
  })
})

describe('isPair', () => {
  it('accepts two cards of equal value', () => {
    expect(isPair([c('K'), c('Q')])).toBe(true)
    expect(isPair([c('8'), c('8')])).toBe(true)
  })

  it('rejects unequal cards and wrong counts', () => {
    expect(isPair([c('8'), c('9')])).toBe(false)
    expect(isPair([c('8')])).toBe(false)
    expect(isPair([c('8'), c('8'), c('8')])).toBe(false)
  })
})

describe('isNatural / isBust', () => {
  it('detects a natural two-card 21', () => {
    expect(isNatural([c('A'), c('K')])).toBe(true)
    expect(isNatural([c('A'), c('K'), c('K')])).toBe(false)
    expect(isNatural([c('9'), c('Q')])).toBe(false)
  })

  it('detects busts', () => {
    expect(isBust([c('T'), c('T'), c('2')])).toBe(true)
    expect(isBust([c('T'), c('2')])).toBe(false)
  })
})
