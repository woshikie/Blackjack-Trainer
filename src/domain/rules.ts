export type DeckCount = 1 | 2 | 4 | 6 | 8
export type DoubleRule = 'any' | '9-11' | '10-11'
export type BlackjackPays = 1.5 | 1.2

export interface Rules {
  decks: DeckCount
  /** true = H17 (dealer hits soft 17), false = S17. */
  hitSoft17: boolean
  blackjackPays: BlackjackPays
  doubleAfterSplit: boolean
  /** Maximum number of player hands per round, including the original. */
  maxHands: 2 | 3 | 4
  /** Split aces receive one card and stand. */
  splitAcesOneCard: boolean
  /** Split aces may be resplit (requires drawing allowed to matter). */
  resplitAces: boolean
  doubleOn: DoubleRule
  lateSurrender: boolean
  insurance: boolean
  /** true = dealer checks first (US peek), false = ENHC (checks last). */
  peek: boolean
  csm: boolean
  /** Cut-card penetration as a percentage of the shoe (ignored under CSM). */
  penetration: number
  minBet: number
  /** 0 = no maximum. */
  maxBet: number
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  hitSoft17: false,
  blackjackPays: 1.5,
  doubleAfterSplit: true,
  maxHands: 4,
  splitAcesOneCard: true,
  resplitAces: false,
  doubleOn: 'any',
  lateSurrender: true,
  insurance: true,
  peek: true,
  csm: false,
  penetration: 75,
  minBet: 5,
  maxBet: 0,
}

/** ENHC tables do not offer late surrender. */
export function normalizeRules(rules: Rules): Rules {
  if (!rules.peek && rules.lateSurrender) {
    return { ...rules, lateSurrender: false }
  }
  return rules
}
