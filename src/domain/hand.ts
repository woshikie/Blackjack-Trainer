import type { Card } from './cards'
import { rankValue } from './cards'

export interface HandValue {
  /** Best total not exceeding 21 (may exceed 21 when busted). */
  total: number
  /** True when an ace is currently counted as 11. */
  soft: boolean
}

export function handValue(cards: readonly Card[]): HandValue {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += rankValue(card.rank)
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  // Any ace still counted at 11 keeps the hand soft.
  return { total, soft: aces > 0 }
}

/** Same rank *value* (a K and a Q are a splittable pair). */
export function isPair(cards: readonly Card[]): boolean {
  return cards.length === 2 && rankValue(cards[0]!.rank) === rankValue(cards[1]!.rank)
}

export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}

export function isBust(cards: readonly Card[]): boolean {
  return handValue(cards).total > 21
}
