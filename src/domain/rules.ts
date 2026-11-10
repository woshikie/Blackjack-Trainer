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
  /** Surrender before the dealer peeks (much wider strategy vs ace/ten). */
  earlySurrender: boolean
  /**
   * Original and Busted Bets Only: vs a dealer natural in a no-peek game,
   * each live hand loses one unit (double increments refunded) and busted
   * hands lose everything. Dormant in peek games (dealer BJ ends the hand
   * before any extra bet exists).
   */
  obbo: boolean
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
  earlySurrender: false,
  obbo: false,
  insurance: true,
  peek: true,
  csm: false,
  penetration: 75,
  minBet: 5,
  maxBet: 0,
}

/** ENHC tables do not offer surrender; early surrender implies late. */
export function normalizeRules(rules: Rules): Rules {
  if (!rules.peek && (rules.lateSurrender || rules.earlySurrender)) {
    return { ...rules, lateSurrender: false, earlySurrender: false }
  }
  if (rules.earlySurrender && !rules.lateSurrender) {
    return { ...rules, lateSurrender: true }
  }
  return rules
}
