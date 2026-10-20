import { describe, expect, it } from 'vitest'
import type { Card, Rank } from '../src/domain/cards'
import { accuracy, decisionSpot, emptyStats, recordDecision, recordHand, worstSpots } from '../src/domain/stats'

function c(rank: Rank): Card {
  return { rank, suit: 'S' }
}

describe('decisionSpot', () => {
  it('labels hard totals', () => {
    expect(decisionSpot([c('T'), c('6')], c('T'))).toBe('h16 v T')
  })

  it('labels soft totals', () => {
    expect(decisionSpot([c('A'), c('7')], c('6'))).toBe('s18 v 6')
  })

  it('labels pairs by rank', () => {
    expect(decisionSpot([c('8'), c('8')], c('T'))).toBe('p8 v T')
    expect(decisionSpot([c('K'), c('Q')], c('A'))).toBe('pT v A')
    expect(decisionSpot([c('A'), c('A')], c('5'))).toBe('pA v 5')
  })
})

describe('recordDecision', () => {
  it('tracks counts, streaks and per-spot stats', () => {
    const stats = emptyStats()
    recordDecision(stats, 'h16 v T', true)
    recordDecision(stats, 'h16 v T', true)
    recordDecision(stats, 'h16 v T', false)
    expect(stats.decisions).toBe(3)
    expect(stats.mistakes).toBe(1)
    expect(stats.streak).toBe(0)
    expect(stats.bestStreak).toBe(2)
    expect(stats.spots['h16 v T']).toEqual({ seen: 3, mistakes: 1 })
  })

  it('updates the best streak only when exceeded', () => {
    const stats = emptyStats()
    recordDecision(stats, 'a', true)
    recordDecision(stats, 'a', true)
    recordDecision(stats, 'a', false)
    recordDecision(stats, 'a', true)
    expect(stats.bestStreak).toBe(2)
    expect(stats.streak).toBe(1)
  })
})

describe('worstSpots', () => {
  it('ranks low-accuracy spots first and ignores sparse spots', () => {
    const stats = emptyStats()
    for (let i = 0; i < 4; i++) recordDecision(stats, 'h16 v T', false)
    recordDecision(stats, 's18 v 6', true)
    for (let i = 0; i < 4; i++) recordDecision(stats, 's18 v 6', true)
    recordDecision(stats, 'sparse v 2', false)
    const spots = worstSpots(stats)
    expect(spots[0]?.key).toBe('h16 v T')
    expect(spots[0]?.accuracy).toBeCloseTo(0)
    expect(spots.find((spot) => spot.key === 'sparse v 2')).toBeUndefined()
  })

  it('respects the limit', () => {
    const stats = emptyStats()
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) recordDecision(stats, `spot ${i}`, i % 2 === 0)
    }
    expect(worstSpots(stats, 2)).toHaveLength(2)
  })
})

describe('accuracy / recordHand', () => {
  it('returns null with no decisions', () => {
    expect(accuracy(emptyStats())).toBeNull()
  })

  it('computes overall accuracy', () => {
    const stats = emptyStats()
    recordDecision(stats, 'a', true)
    recordDecision(stats, 'a', false)
    expect(accuracy(stats)).toBeCloseTo(0.5)
    recordHand(stats)
    expect(stats.hands).toBe(1)
  })
})
