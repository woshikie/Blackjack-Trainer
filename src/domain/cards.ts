export type Suit = 'S' | 'H' | 'D' | 'C'

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K'

export interface Card {
  readonly rank: Rank
  readonly suit: Suit
}

export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']

export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (rank === 'T' || rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

export function freshDecks(decks: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit })
      }
    }
  }
  return cards
}
