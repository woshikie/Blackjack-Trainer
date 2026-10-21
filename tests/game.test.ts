import { describe, expect, it } from 'vitest'
import { freshDecks } from '../src/domain/cards'
import type { Card, Rank, Suit } from '../src/domain/cards'
import { HI_LO } from '../src/domain/counting'
import { Game, START_BANKROLL } from '../src/domain/engine/game'
import { mulberry32 } from '../src/domain/rng'
import { DEFAULT_RULES } from '../src/domain/rules'
import type { Rules } from '../src/domain/rules'

function c(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit }
}

/** Preset draw order: the engine draws order[0] first. */
function shoeOf(...order: Card[]): Card[] {
  return [...order].reverse()
}

function makeGame(partial: Partial<Rules>, order: Card[], counting = false): Game {
  return new Game(
    { ...DEFAULT_RULES, ...partial },
    mulberry32(1),
    counting ? HI_LO : undefined,
    shoeOf(...order),
  )
}

const BET = 10

function playSimpleRound(game: Game): void {
  game.placeBet(BET)
  game.deal()
  game.decide('stand')
}

describe('betting', () => {
  it('rejects bets below the minimum, above the maximum, and over the bankroll', () => {
    const game = makeGame({ maxBet: 50 }, [])
    expect(() => game.placeBet(4)).toThrow('below table minimum')
    expect(() => game.placeBet(100)).toThrow('above table maximum')
    expect(() => game.placeBet(0)).toThrow('below table minimum')
  })

  it('ignores the maximum when it is zero but rejects overdrafts', () => {
    const game = makeGame({}, [])
    expect(() => game.placeBet(START_BANKROLL + 1)).toThrow('insufficient bankroll')
    game.placeBet(BET)
    expect(game.bet).toBe(BET)
  })

  it('rejects dealing without a bet or in the wrong phase', () => {
    const game = makeGame({}, [c('T'), c('6'), c('T'), c('8')])
    expect(() => game.deal()).toThrow('no bet placed')
    game.placeBet(BET)
    game.deal()
    expect(() => game.placeBet(BET)).toThrow('expected phase betting')
  })

  it('tops up the bankroll in the betting phase', () => {
    const game = makeGame({}, [])
    game.bankroll = 100
    game.topUp()
    expect(game.bankroll).toBe(START_BANKROLL)
  })
})

describe('peek flow', () => {
  it('dealer blackjack beats a non-natural hand; declined insurance just lapses', () => {
    const game = makeGame({}, [c('T'), c('A'), c('5'), c('T')])
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('insurance')
    game.resolveInsurance(false)
    expect(game.phase).toBe('settled')
    expect(game.message).toBe('Dealer blackjack')
    expect(game.hands[0]!.result).toBe('lose')
    expect(game.bankroll).toBe(START_BANKROLL - BET)
    expect(game.dealerHoleExposed).toBe(true)
  })

  it('insurance pays 2:1 when the dealer has blackjack', () => {
    const game = makeGame({}, [c('T'), c('A'), c('5'), c('T')])
    game.placeBet(BET)
    game.deal()
    game.resolveInsurance(true)
    expect(game.insuranceTaken).toBe(true)
    expect(game.bankroll).toBe(START_BANKROLL - BET - 5 + 15)
  })

  it('skips the insurance prompt when insurance is disabled', () => {
    const game = makeGame({ insurance: false }, [c('T'), c('A'), c('5'), c('T')])
    game.placeBet(BET)
    game.deal()
    // no insurance phase ever appears: the peek settles the dealer natural directly
    expect(game.phase).toBe('settled')
    expect(game.hands[0]!.result).toBe('lose')
  })

  it('skips the insurance prompt when the bankroll cannot cover it', () => {
    const game = makeGame({}, [c('T'), c('A'), c('5'), c('T')])
    game.bankroll = BET
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('settled')
    expect(game.hands[0]!.result).toBe('lose')
  })

  it('pays a natural 3:2 after the peek clears', () => {
    const game = makeGame({}, [c('A'), c('5'), c('K'), c('T')])
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('settled')
    expect(game.hands[0]!.result).toBe('blackjack')
    expect(game.bankroll).toBe(START_BANKROLL - BET + 25)
  })

  it('pays a natural 6:5 when configured', () => {
    const game = makeGame({ blackjackPays: 1.2 }, [c('A'), c('5'), c('K'), c('T')])
    game.placeBet(BET)
    game.deal()
    expect(game.bankroll).toBe(START_BANKROLL - BET + 22)
  })

  it('offers even money on a natural against an ace', () => {
    const game = makeGame({}, [c('A'), c('A'), c('K'), c('8')])
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('insurance')
    expect(game.snapshot().evenMoney).toBe(true)
    game.resolveInsurance(false)
    expect(game.hands[0]!.result).toBe('blackjack')
    expect(game.bankroll).toBe(START_BANKROLL - BET + 25)
  })

  it('even money with a dealer blackjack nets exactly the stake', () => {
    const game = makeGame({}, [c('A'), c('A'), c('K'), c('T')])
    game.placeBet(BET)
    game.deal()
    game.resolveInsurance(true)
    expect(game.hands[0]!.result).toBe('push')
    expect(game.bankroll).toBe(START_BANKROLL)
  })
})

describe('ENHC flow', () => {
  it('takes doubled bets when the dealer turns over blackjack', () => {
    const game = makeGame({ peek: false }, [c('T'), c('T'), c('2'), c('3'), c('A')])
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('player')
    game.decide('double')
    expect(game.phase).toBe('settled')
    expect(game.message).toBe('Dealer blackjack')
    expect(game.hands[0]!.result).toBe('lose')
    expect(game.bankroll).toBe(START_BANKROLL - 2 * BET)
  })

  it('pays player naturals immediately, before the dealer checks', () => {
    const game = makeGame({ peek: false }, [c('A'), c('5'), c('K')])
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('settled')
    expect(game.hands[0]!.result).toBe('blackjack')
    expect(game.bankroll).toBe(START_BANKROLL - BET + 25)
    expect(game.dealerCards).toHaveLength(1)
  })

  it('pays taken insurance when the dealer turns over blackjack', () => {
    // draw order: 5(P), A(up), T(P), T(hole)
    const game = makeGame({ peek: false }, [c('5'), c('A'), c('T'), c('T')])
    game.placeBet(BET)
    game.deal()
    expect(game.phase).toBe('insurance')
    game.resolveInsurance(true)
    game.decide('stand')
    expect(game.phase).toBe('settled')
    expect(game.message).toBe('Dealer blackjack')
    expect(game.hands[0]!.result).toBe('lose')
    expect(game.bankroll).toBe(START_BANKROLL - BET - 5 + 15)
  })
})

describe('dealer play', () => {
  it('hits soft 17 only under H17', () => {
    const h17 = makeGame({ hitSoft17: true }, [c('T'), c('6'), c('8'), c('A'), c('2')])
    h17.placeBet(BET)
    h17.deal()
    h17.decide('stand')
    expect(h17.hands[0]!.result).toBe('lose')
    expect(h17.bankroll).toBe(START_BANKROLL - BET)

    const s17 = makeGame({}, [c('T'), c('6'), c('8'), c('A')])
    s17.placeBet(BET)
    s17.deal()
    s17.decide('stand')
    expect(s17.hands[0]!.result).toBe('win')
    expect(s17.bankroll).toBe(START_BANKROLL + BET)
  })

  it('collects from busted hands without drawing', () => {
    // draw order: T(P), 6(up), 6(P), T(hole), T(hit)
    const game = makeGame({}, [c('T'), c('6'), c('6'), c('T'), c('T')])
    game.placeBet(BET)
    game.deal()
    game.decide('hit')
    expect(game.hands[0]!.result).toBe('bust')
    expect(game.dealerCards).toHaveLength(2)
    expect(game.bankroll).toBe(START_BANKROLL - BET)
  })

  it('pushes on equal totals', () => {
    // player T+8, dealer T+8
    const game = makeGame({}, [c('T'), c('T'), c('8'), c('8')])
    game.placeBet(BET)
    game.deal()
    game.decide('stand')
    expect(game.hands[0]!.result).toBe('push')
    expect(game.bankroll).toBe(START_BANKROLL)
  })

  it('auto-stands a hand that reaches 21', () => {
    // draw order: T(P), 6(up), 4(P), T(hole), 7(hit), 9(dealer draw)
    const game = makeGame({}, [c('T'), c('6'), c('4'), c('T'), c('7'), c('9')])
    game.placeBet(BET)
    game.deal()
    game.decide('hit')
    expect(game.hands[0]!.stood).toBe(true)
    expect(game.hands[0]!.result).toBe('win')
  })
})

describe('surrender', () => {
  it('forfeits half the bet', () => {
    // hole 5 keeps the dealer below 21 so the surrender resolves on its own
    const game = makeGame({}, [c('T'), c('T'), c('6'), c('5')])
    game.placeBet(BET)
    game.deal()
    game.decide('surrender')
    expect(game.hands[0]!.surrendered).toBe(true)
    expect(game.hands[0]!.result).toBe('surrender')
    expect(game.bankroll).toBe(START_BANKROLL - BET / 2)
    expect(game.dealerCards).toHaveLength(2)
  })
})

describe('splits', () => {
  it('splits, plays each hand, and settles both', () => {
    // draw order: 8(P), 6(up), 8(P), T(hole), 4(to first), 5(to second), T(dealer draw)
    const game = makeGame({}, [c('8'), c('6'), c('8'), c('T'), c('4'), c('5'), c('T')])
    game.placeBet(BET)
    game.deal()
    game.decide('split')
    expect(game.hands).toHaveLength(2)
    expect(game.bankroll).toBe(START_BANKROLL - 2 * BET)
    // after the split the first hand keeps the action
    expect(game.snapshot().activeIndex).toBe(0)
    game.decide('stand')
    game.decide('stand')
    expect(game.phase).toBe('settled')
    expect(game.hands[0]!.result).toBe('win')
    expect(game.hands[1]!.result).toBe('win')
    expect(game.bankroll).toBe(START_BANKROLL + 2 * BET)
  })

  it('stops splitting at the hand limit and plays the pair as a total', () => {
    const game = makeGame({ maxHands: 2 }, [c('8'), c('6'), c('8'), c('8'), c('5'), c('T'), c('9')])
    game.placeBet(BET)
    game.deal()
    game.decide('split')
    expect(game.availableActions()).not.toContain('split')
    game.decide('stand')
    game.decide('stand')
    expect(game.hands[0]!.result).toBe('win')
    expect(game.hands[1]!.result).toBe('win')
  })

  it('gives split aces one card each under the one-card rule', () => {
    const game = makeGame({}, [c('A'), c('6'), c('A'), c('K'), c('5'), c('9'), c('T')])
    game.placeBet(BET)
    game.deal()
    game.decide('split')
    expect(game.hands[0]!.stood).toBe(true)
    expect(game.hands[1]!.stood).toBe(true)
    expect(game.hands).toHaveLength(2)
    expect(game.phase).toBe('settled')
    // 21 after a split is a win, never a blackjack
    expect(game.hands[0]!.result).toBe('win')
    expect(game.hands[1]!.result).toBe('win')
  })

  it('allows hitting split aces when drawing is permitted', () => {
    // draw order: A(P), 6(up), A(P), 4(hole), 5(to first), 9(to second)
    const game = makeGame({ splitAcesOneCard: false }, [c('A'), c('6'), c('A'), c('4'), c('5'), c('9')])
    game.placeBet(BET)
    game.deal()
    game.decide('split')
    expect(game.hands[0]!.stood).toBe(false)
    expect(game.availableActions()).toContain('hit')
  })

  it('auto-stands a split hand dealt 21 while the first hand keeps the action', () => {
    // draw order: A(P), 6(up), A(P), 5(hole), 4(to first), T(to second)
    const game = makeGame({ splitAcesOneCard: false }, [c('A'), c('6'), c('A'), c('5'), c('4'), c('T')])
    game.placeBet(BET)
    game.deal()
    game.decide('split')
    expect(game.hands[0]!.stood).toBe(false)
    expect(game.hands[1]!.stood).toBe(true)
    expect(game.snapshot().activeIndex).toBe(0)
  })

  it('allows resplitting aces when configured', () => {
    // draw order: A(P), 6(up), A(P), 5(hole), A(to first), 4(to second)
    const game = makeGame({ splitAcesOneCard: false, resplitAces: true }, [c('A'), c('6'), c('A'), c('5'), c('A'), c('4')])
    game.placeBet(BET)
    game.deal()
    game.decide('split')
    expect(game.availableActions()).toContain('split')
  })
})

describe('action legality', () => {
  it('reports no actions outside the player phase', () => {
    const game = makeGame({}, [c('T'), c('6'), c('T'), c('8'), c('5')])
    expect(game.availableActions()).toEqual([])
    game.placeBet(BET)
    game.deal()
    game.decide('stand')
    expect(game.phase).toBe('settled')
    expect(game.availableActions()).toEqual([])
  })

  it('exposes the full action set for an initial two-card hand', () => {
    const game = makeGame({}, [c('T'), c('T'), c('6'), c('5')])
    game.placeBet(BET)
    game.deal()
    expect(game.availableActions()).toEqual(['hit', 'stand', 'double', 'surrender'])
  })

  it('blocks doubles for three-card hands, split hands without DAS, and restricted ranges', () => {
    const threeCards = makeGame({}, [c('T'), c('6'), c('2'), c('3'), c('4')])
    threeCards.placeBet(BET)
    threeCards.deal()
    threeCards.decide('hit')
    expect(threeCards.availableActions()).not.toContain('double')

    const noDAS = makeGame({ doubleAfterSplit: false }, [c('2'), c('6'), c('2'), c('3'), c('4'), c('5')])
    noDAS.placeBet(BET)
    noDAS.deal()
    noDAS.decide('split')
    expect(noDAS.availableActions()).not.toContain('double')

    const restricted = makeGame({ doubleOn: '10-11' }, [c('T'), c('6'), c('2'), c('9')])
    restricted.placeBet(BET)
    restricted.deal()
    expect(restricted.availableActions()).not.toContain('double')

    const softRestricted = makeGame({ doubleOn: '9-11' }, [c('A'), c('6'), c('4'), c('9')])
    softRestricted.placeBet(BET)
    softRestricted.deal()
    expect(softRestricted.availableActions()).not.toContain('double')

    const broke = makeGame({}, [c('T'), c('6'), c('5'), c('9')])
    broke.placeBet(BET)
    broke.deal()
    broke.bankroll = 5
    expect(broke.availableActions()).not.toContain('double')
  })

  it('blocks surrender for ENHC, post-split hands, and when disabled', () => {
    const enhc = makeGame({ peek: false }, [c('T'), c('T'), c('6')])
    enhc.placeBet(BET)
    enhc.deal()
    expect(enhc.availableActions()).not.toContain('surrender')

    const noLS = makeGame({ lateSurrender: false }, [c('T'), c('T'), c('6'), c('8')])
    noLS.placeBet(BET)
    noLS.deal()
    expect(noLS.availableActions()).not.toContain('surrender')
  })

  it('reports double range eligibility directly', () => {
    const game = makeGame({ doubleOn: '9-11' }, [])
    expect(game.doubleRangeOk(10, false)).toBe(true)
    expect(game.doubleRangeOk(8, false)).toBe(false)
    expect(game.doubleRangeOk(12, false)).toBe(false)
    expect(game.doubleRangeOk(15, true)).toBe(false)
  })

  it('rejects illegal decisions', () => {
    const game = makeGame({}, [c('T'), c('6'), c('5'), c('9'), c('2')])
    game.placeBet(BET)
    game.deal()
    expect(() => game.decide('split')).toThrow('illegal action')
    expect(() => game.decide('hit')).not.toThrow()
  })
})

describe('shoe lifecycle', () => {
  it('discards cards and resets state on nextRound', () => {
    // tiny penetration so the round trips the cut card and reshuffles
    const game = makeGame({ penetration: 1 }, [c('T'), c('6'), c('T'), c('8'), c('T')])
    playSimpleRound(game)
    expect(game.phase).toBe('settled')
    const remainingAfterRound = game.snapshot().remaining
    game.nextRound()
    expect(game.phase).toBe('betting')
    expect(game.bet).toBe(0)
    expect(game.snapshot().remaining).toBeGreaterThan(remainingAfterRound)
    expect(game.snapshot().shuffled).toBe(true)
    expect(() => game.nextRound()).toThrow('expected phase settled')
  })

  it('recycles the shoe after every round under a CSM and disables counting', () => {
    const game = makeGame({ csm: true, decks: 1 }, freshDecks(1), true)
    playSimpleRound(game)
    game.nextRound()
    expect(game.snapshot().remaining).toBe(52)
    expect(game.snapshot().count).toBeNull()
  })

  it('reshuffles at the cut card and resets the count', () => {
    // fixed one-deck sequence; 50% penetration forces a shuffle mid-session
    const game = makeGame({ decks: 1, penetration: 50 }, freshDecks(1), true)
    let shuffled = false
    for (let round = 0; round < 12 && !shuffled; round++) {
      game.placeBet(BET)
      game.deal()
      if (game.phase === 'insurance') game.resolveInsurance(false)
      if (game.phase === 'player') game.decide('stand')
      if (game.phase === 'player') game.decide('stand')
      game.nextRound()
      shuffled = game.snapshot().shuffled
    }
    expect(shuffled).toBe(true)
    expect(game.snapshot().count?.running).toBe(0)
  })

  it('tracks the running count of exposed cards only', () => {
    const game = makeGame({}, [c('T'), c('A'), c('5'), c('T')], true)
    game.placeBet(BET)
    game.deal()
    expect(game.snapshot().count?.running).toBe(-1)
    game.resolveInsurance(false)
    // the hole card joins the count when revealed
    expect(game.snapshot().count?.running).toBe(-2)
  })
})

describe('rule changes between rounds', () => {
  it('applies new rules and reshuffles in the betting phase', () => {
    const game = makeGame({}, [])
    game.setRules({ ...DEFAULT_RULES, decks: 2 }, mulberry32(2))
    expect(game.snapshot().shuffled).toBe(true)
    game.placeBet(BET)
    game.deal()
    expect(() => game.setRules({ ...DEFAULT_RULES }, mulberry32(3))).toThrow('expected phase betting')
  })
})

describe('payout integrity', () => {
  it('a doubled win pays double the original bet', () => {
    // 16 v 5: double → draws 5 for 21; dealer 8+9 = 17 stands
    const game = makeGame({}, [c('T'), c('5'), c('6'), c('3'), c('5'), c('9')])
    game.placeBet(BET)
    game.deal()
    game.decide('double')
    expect(game.snapshot().hands[0]?.result).toBe('win')
    expect(game.snapshot().bankroll).toBe(START_BANKROLL - 2 * BET + 4 * BET)
  })

  it('a doubled loss costs double the original bet', () => {
    // 16 v T: double → draws 3 for 19; dealer T+3 = 13 hits 8 → 21 wins
    const game = makeGame({}, [c('T'), c('T'), c('6'), c('3'), c('3'), c('8')])
    game.placeBet(BET)
    game.deal()
    game.decide('double')
    expect(game.snapshot().hands[0]?.result).toBe('lose')
    expect(game.snapshot().bankroll).toBe(START_BANKROLL - 2 * BET)
  })

  it('a doubled push returns both stakes', () => {
    // 16 v 6: double → draws 3 for 19; dealer 6+9 = 15 hits 4 → 19 pushes
    const game = makeGame({}, [c('T'), c('6'), c('6'), c('9'), c('3'), c('4')])
    game.placeBet(BET)
    game.deal()
    game.decide('double')
    expect(game.snapshot().hands[0]?.result).toBe('push')
    expect(game.snapshot().bankroll).toBe(START_BANKROLL)
  })

  it('a natural pays 3:2 on the original bet', () => {
    const game = makeGame({}, [c('A'), c('5'), c('K'), c('T')])
    game.placeBet(BET)
    game.deal()
    expect(game.snapshot().hands[0]?.result).toBe('blackjack')
    expect(game.snapshot().bankroll).toBe(START_BANKROLL - BET + 25)
  })
})
