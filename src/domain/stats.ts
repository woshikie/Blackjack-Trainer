import type { Card } from './cards'
import { rankValue } from './cards'
import { handValue, isPair } from './hand'

export interface SpotStat {
  seen: number
  mistakes: number
}

export interface Stats {
  hands: number
  decisions: number
  mistakes: number
  streak: number
  bestStreak: number
  /** key: e.g. "h16 v T", "s18 v 6", "p8 v T", "insurance v A" */
  spots: Record<string, SpotStat>
}

export function emptyStats(): Stats {
  return { hands: 0, decisions: 0, mistakes: 0, streak: 0, bestStreak: 0, spots: {} }
}

export function decisionSpot(cards: readonly Card[], dealerUp: Card): string {
  const up = dealerUp.rank
  if (isPair(cards)) {
    const value = rankValue(cards[0]!.rank)
    const label = value === 11 ? 'A' : value === 10 ? 'T' : String(value)
    return `p${label} v ${up}`
  }
  const { total, soft } = handValue(cards)
  return `${soft ? 's' : 'h'}${total} v ${up}`
}

export function recordDecision(stats: Stats, key: string, correct: boolean): void {
  stats.decisions++
  if (!correct) {
    stats.mistakes++
    stats.streak = 0
  } else {
    stats.streak++
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak
  }
  const spot = stats.spots[key] ?? { seen: 0, mistakes: 0 }
  spot.seen++
  if (!correct) spot.mistakes++
  stats.spots[key] = spot
}

export function recordHand(stats: Stats): void {
  stats.hands++
}

/** Worst spots first: lowest accuracy among spots seen at least 3 times. */
export function worstSpots(
  stats: Stats,
  limit = 5,
): Array<{ key: string; accuracy: number; seen: number }> {
  return Object.entries(stats.spots)
    .filter(([, spot]) => spot.seen >= 3)
    .map(([key, spot]) => ({ key, accuracy: 1 - spot.mistakes / spot.seen, seen: spot.seen }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit)
}

export function accuracy(stats: Stats): number | null {
  return stats.decisions === 0 ? null : 1 - stats.mistakes / stats.decisions
}
