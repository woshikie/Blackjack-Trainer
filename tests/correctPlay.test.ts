import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '../src/domain/cards'
import { rankValue } from '../src/domain/cards'
import { handValue, isPair } from '../src/domain/hand'
import { DEFAULT_RULES } from '../src/domain/rules'
import type { DeckCount, DoubleRule, Rules } from '../src/domain/rules'
import { CHARTS, NO_DAS_OVERRIDES, SURRENDER_OVERRIDES, UP_ORDER, cellAt, deckFamily } from '../src/domain/strategy/charts'
import type { DeckFamily, Up } from '../src/domain/strategy/charts'
import { correctPlay, insuranceCorrect } from '../src/domain/strategy/correctPlay'
import type { Action, DecisionContext } from '../src/domain/strategy/correctPlay'

function c(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit }
}

function upOf(card: Card): Up {
  const value = rankValue(card.rank)
  if (value === 11) return 'A'
  if (value === 10) return 'T'
  return String(value) as Up
}

function pairKeyOf(cards: readonly Card[]): string {
  const value = rankValue(cards[0]!.rank)
  if (value === 11) return 'A'
  if (value === 10) return 'T'
  return String(value)
}

function cardsForHard(total: number): Card[] {
  if (total >= 5 && total <= 11) return [c('2'), c(String(total - 2) as Rank)]
  if (total >= 12 && total <= 19) return [c('T'), c(String(total - 10) as Rank)]
  if (total === 20) return [c('T'), c('5'), c('5')]
  return [c('T'), c('8'), c('3')]
}

function cardsForSoft(total: number): Card[] {
  if (total === 21) return [c('A'), c('T')]
  return [c('A'), c(String(total - 12) as Rank)]
}

function cardsForPair(rank: string): Card[] {
  return [c(rank as Rank), c(rank as Rank)]
}

function surrenders(
  family: DeckFamily,
  rule: 'S17' | 'H17',
  up: Up,
  total: number,
): boolean {
  return SURRENDER_OVERRIDES[family][rule].some(
    ([key, overrideUp]) => overrideUp === up && key !== 'p8' && total === Number(key.slice(1)),
  )
}

/** Independent mini-interpreter of the chart data used to cross-check the resolver. */
function expected(ctx: DecisionContext, rules: Rules): Action {
  const family = deckFamily(rules.decks)
  const rule = rules.hitSoft17 ? 'H17' : 'S17'
  const chart = CHARTS[family][rule]
  const up = upOf(ctx.dealerUp)
  const value = handValue(ctx.cards)
  const pair = isPair(ctx.cards)
  const key = pair ? pairKeyOf(ctx.cards) : ''

  if (pair) {
    let cell = cellAt(chart.pairs[key]!, up)
    if (!rules.doubleAfterSplit && (NO_DAS_OVERRIDES[family][key] ?? []).includes(up)) cell = 'H'
    if (cell === 'P') {
      const enhcBlocked = !rules.peek && (up === 'T' || up === 'A') && !(key === 'A' && up === 'T')
      if (!enhcBlocked) {
        if (
          rules.lateSurrender &&
          rules.peek &&
          SURRENDER_OVERRIDES[family][rule].some(([k, o]) => k === 'p8' && o === up)
        ) {
          return 'surrender'
        }
        return 'split'
      }
    } else if (cell === 'S') {
      return 'stand'
    } else if (cell === 'H') {
      return 'hit'
    }
  }

  const row = (value.soft ? chart.soft[value.total] : chart.hard[value.total])!
  const cell = cellAt(row, up)
  if (
    rules.lateSurrender &&
    rules.peek &&
    !value.soft &&
    surrenders(family, rule, up, value.total)
  ) {
    return 'surrender'
  }
  const inRange =
    rules.doubleOn === '9-11' ? value.total >= 9 && value.total <= 11 : value.total >= 10 && value.total <= 11
  const canDouble =
    ctx.cards.length === 2 &&
    (!ctx.postSplit || rules.doubleAfterSplit) &&
    ctx.fundsForDouble &&
    (rules.doubleOn === 'any' || (!value.soft && inRange))
  if ((cell === 'D' || cell === 'T') && canDouble && !(!rules.peek && (up === 'T' || up === 'A'))) {
    return 'double'
  }
  return cell === 'S' || cell === 'T' ? 'stand' : 'hit'
}

function context(cards: Card[], up: Rank, partial: Partial<DecisionContext> = {}): DecisionContext {
  return {
    cards,
    dealerUp: c(up),
    postSplit: false,
    splitAces: false,
    numHands: 1,
    fundsForDouble: true,
    ...partial,
  }
}

function baseRules(partial: Partial<Rules>): Rules {
  return { ...DEFAULT_RULES, ...partial }
}

const DECKS: DeckCount[] = [1, 2, 6]
const HARD_TOTALS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const SOFT_TOTALS = [13, 14, 15, 16, 17, 18, 19, 20, 21]
const PAIR_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T']

describe('correctPlay against chart data (canonical rules)', () => {
  for (const decks of DECKS) {
    for (const hitSoft17 of [false, true]) {
      const rules = baseRules({ decks, hitSoft17 })
      const label = `${decks} deck${decks === 1 ? '' : 's'} ${hitSoft17 ? 'H17' : 'S17'}`

      it(`matches every hard total cell (${label})`, () => {
        for (const total of HARD_TOTALS) {
          for (const up of UP_ORDER) {
            const cards = cardsForHard(total)
            expect(correctPlay(context(cards, up), rules), `hard ${total} v ${up}`).toBe(
              expected(context(cards, up), rules),
            )
          }
        }
      })

      it(`matches every soft total cell (${label})`, () => {
        for (const total of SOFT_TOTALS) {
          for (const up of UP_ORDER) {
            const cards = cardsForSoft(total)
            expect(correctPlay(context(cards, up), rules), `soft ${total} v ${up}`).toBe(
              expected(context(cards, up), rules),
            )
          }
        }
      })

      it(`matches every pair cell (${label})`, () => {
        for (const rank of PAIR_RANKS) {
          for (const up of UP_ORDER) {
            const cards = cardsForPair(rank)
            expect(correctPlay(context(cards, up), rules), `pair ${rank} v ${up}`).toBe(
              expected(context(cards, up), rules),
            )
          }
        }
      })
    }
  }
})

describe('correctPlay rule-conditioned variants', () => {
  it('never surrenders when late surrender is off', () => {
    const rules = baseRules({ lateSurrender: false })
    for (const total of [15, 16, 17]) {
      for (const up of UP_ORDER) {
        const cards = cardsForHard(total)
        expect(correctPlay(context(cards, up), rules)).not.toBe('surrender')
      }
    }
  })

  it('never surrenders under ENHC', () => {
    const rules = baseRules({ peek: false })
    for (const total of [15, 16, 17]) {
      const cards = cardsForHard(total)
      expect(correctPlay(context(cards, 'T'), rules)).not.toBe('surrender')
    }
  })

  it('applies no-DAS pair overrides across families', () => {
    for (const decks of DECKS) {
      const rules = baseRules({ decks, doubleAfterSplit: false })
      for (const rank of PAIR_RANKS) {
        for (const up of UP_ORDER) {
          const cards = cardsForPair(rank)
          expect(correctPlay(context(cards, up), rules), `pair ${rank} v ${up} no DAS`).toBe(
            expected(context(cards, up), rules),
          )
        }
      }
    }
  })

  it('applies double restrictions', () => {
    for (const doubleOn of ['9-11', '10-11'] as DoubleRule[]) {
      const rules = baseRules({ doubleOn })
      for (const total of HARD_TOTALS) {
        for (const up of UP_ORDER) {
          const cards = cardsForHard(total)
          expect(correctPlay(context(cards, up), rules), `hard ${total} v ${up} double ${doubleOn}`).toBe(
            expected(context(cards, up), rules),
          )
        }
      }
      for (const total of SOFT_TOTALS) {
        for (const up of UP_ORDER) {
          const cards = cardsForSoft(total)
          expect(correctPlay(context(cards, up), rules), `soft ${total} v ${up} double ${doubleOn}`).toBe(
            expected(context(cards, up), rules),
          )
        }
      }
    }
  })

  it('blocks doubles without funds', () => {
    const rules = baseRules({})
    for (const total of [9, 10, 11]) {
      for (const up of UP_ORDER) {
        const cards = cardsForHard(total)
        const result = correctPlay(context(cards, up, { fundsForDouble: false }), rules)
        expect(result === 'hit' || result === 'stand').toBe(true)
      }
    }
  })

  it('falls back to totals after ENHC split blocks', () => {
    const rules = baseRules({ peek: false })
    for (const rank of PAIR_RANKS) {
      for (const up of ['T', 'A'] as Up[]) {
        const cards = cardsForPair(rank)
        const result = correctPlay(context(cards, up), rules)
        if (rank === 'A' && up === 'T') {
          expect(result).toBe('split')
        } else {
          expect(result).not.toBe('split')
        }
      }
    }
  })

  it('treats a three-card hand as hit/stand only', () => {
    const rules = baseRules({})
    // soft 17 (A,2,4) v 5 would double with two cards; with three it must hit
    expect(correctPlay(context([c('A'), c('2'), c('4')], '5'), rules)).toBe('hit')
  })

  it('grades post-split hands without split or surrender options', () => {
    const open = baseRules({})
    // hard 11 v 6 doubles with DAS even after a split
    expect(correctPlay(context([c('5'), c('6')], '6', { postSplit: true }), open)).toBe('double')
    const noDAS = baseRules({ doubleAfterSplit: false })
    // ...but only hits without it
    expect(correctPlay(context([c('5'), c('6')], '6', { postSplit: true }), noDAS)).toBe('hit')
    // hard 15 v T would surrender; post-split it just hits
    expect(correctPlay(context([c('T'), c('5')], 'T', { postSplit: true }), open)).toBe('hit')
  })

  it('honors split-aces flags', () => {
    // A,A v 6 splits when resplitting aces is allowed
    expect(
      correctPlay(context([c('A'), c('A')], '6', { splitAces: true }), baseRules({ resplitAces: true })),
    ).toBe('split')
    // ...otherwise the pair is played as soft 12
    expect(
      correctPlay(context([c('A'), c('A')], '6', { splitAces: true }), baseRules({})),
    ).toBe('hit')
  })

  it('resolves no-DAS pair cells directly from the pair chart', () => {
    const rules = baseRules({ doubleAfterSplit: false })
    expect(correctPlay(context([c('2'), c('2')], '2'), rules)).toBe('hit')
    expect(correctPlay(context([c('2'), c('2')], '7'), rules)).toBe('split')
    expect(correctPlay(context([c('A'), c('A')], '6'), rules)).toBe('split')
    expect(correctPlay(context([c('4'), c('4')], '5'), rules)).toBe('hit')
    const das = baseRules({})
    expect(correctPlay(context([c('4'), c('4')], '5'), das)).toBe('split')
  })

  it('plays a maxed-out pair of aces as a drawing hand when allowed', () => {
    const drawing = { numHands: 4, splitAces: true }
    // 4+ decks: double only against a 6
    expect(correctPlay(context([c('A'), c('A')], '6', drawing), baseRules({ decks: 6, splitAcesOneCard: false }))).toBe(
      'double',
    )
    expect(correctPlay(context([c('A'), c('A')], '5', drawing), baseRules({ decks: 6, splitAcesOneCard: false }))).toBe(
      'hit',
    )
    // 1-2 decks: double against 5 or 6
    expect(correctPlay(context([c('A'), c('A')], '5', drawing), baseRules({ decks: 1, splitAcesOneCard: false }))).toBe(
      'double',
    )
    expect(correctPlay(context([c('A'), c('A')], '6', drawing), baseRules({ decks: 2, splitAcesOneCard: false }))).toBe(
      'double',
    )
    expect(correctPlay(context([c('A'), c('A')], '7', drawing), baseRules({ decks: 1, splitAcesOneCard: false }))).toBe(
      'hit',
    )
    // ...but never without the funds
    expect(
      correctPlay(context([c('A'), c('A')], '5', { ...drawing, fundsForDouble: false }), baseRules({ decks: 1, splitAcesOneCard: false })),
    ).toBe('hit')
  })
})

describe('early surrender', () => {
  function early(partial: Partial<Rules> = {}): Rules {
    return baseRules({ earlySurrender: true, ...partial })
  }

  it('surrenders hard 5-7 vs an ace', () => {
    expect(correctPlay(context([c('3'), c('2')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('4'), c('2')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('5'), c('2')], 'A'), early())).toBe('surrender')
  })

  it('leaves hard 8-11 vs an ace alone', () => {
    expect(correctPlay(context([c('5'), c('3')], 'A'), early())).toBe('hit')
    expect(correctPlay(context([c('6'), c('4')], 'A'), early())).toBe('hit')
    expect(correctPlay(context([c('6'), c('5')], 'A'), early())).toBe('hit')
    // ...while H17 hard 11 vs ace still doubles
    expect(correctPlay(context([c('6'), c('5')], 'A'), early({ hitSoft17: true }))).toBe('double')
  })

  it('surrenders hard 12-17 vs an ace but stands 18+', () => {
    expect(correctPlay(context([c('T'), c('2')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('T'), c('7')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('T'), c('8')], 'A'), early())).toBe('stand')
  })

  it('surrenders small pairs vs an ace, 2s only in H17', () => {
    expect(correctPlay(context([c('3'), c('3')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('6'), c('6')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('7'), c('7')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('8'), c('8')], 'A'), early())).toBe('surrender')
    expect(correctPlay(context([c('2'), c('2')], 'A'), early({ hitSoft17: true }))).toBe('surrender')
    expect(correctPlay(context([c('2'), c('2')], 'A'), early())).toBe('hit')
    expect(correctPlay(context([c('9'), c('9')], 'A'), early())).toBe('stand')
    expect(correctPlay(context([c('8'), c('8')], '6'), early())).toBe('split')
  })

  it('surrenders hard 14-16 vs a ten with single/double-deck exceptions', () => {
    const six = early()
    expect(correctPlay(context([c('9'), c('6')], 'T'), six)).toBe('surrender')
    expect(correctPlay(context([c('T'), c('6')], 'T'), six)).toBe('surrender')
    expect(correctPlay(context([c('9'), c('5')], 'T'), six)).toBe('surrender')
    expect(correctPlay(context([c('7'), c('7')], 'T'), six)).toBe('surrender')
    expect(correctPlay(context([c('8'), c('8')], 'T'), six)).toBe('surrender')
    const one = early({ decks: 1 })
    expect(correctPlay(context([c('T'), c('4')], 'T'), one)).toBe('hit')
    expect(correctPlay(context([c('9'), c('5')], 'T'), one)).toBe('hit')
    expect(correctPlay(context([c('K'), c('4')], 'T'), one)).toBe('hit')
    expect(correctPlay(context([c('7'), c('7')], 'T'), one)).toBe('surrender')
    expect(correctPlay(context([c('8'), c('8')], 'T'), early({ decks: 1, doubleAfterSplit: false }))).toBe(
      'surrender',
    )
    const two = early({ decks: 2 })
    expect(correctPlay(context([c('T'), c('4')], 'T'), two)).toBe('hit')
    expect(correctPlay(context([c('9'), c('5')], 'T'), two)).toBe('surrender')
    expect(correctPlay(context([c('T'), c('3')], 'T'), six)).toBe('hit')
    expect(correctPlay(context([c('T'), c('7')], 'T'), six)).toBe('stand')
  })

  it('leaves the late game alone on other upcards', () => {
    expect(correctPlay(context([c('T'), c('6')], '9'), early())).toBe('surrender')
  })

  it('never surrenders soft hands early', () => {
    expect(correctPlay(context([c('A'), c('7')], 'A'), early())).toBe('hit')
    expect(correctPlay(context([c('A'), c('8')], 'A'), early())).toBe('stand')
    expect(correctPlay(context([c('A'), c('6')], 'T'), early())).toBe('hit')
  })

  it('never surrenders early without a peek, post-split, or with three cards', () => {
    expect(correctPlay(context([c('T'), c('6')], 'T'), early({ peek: false }))).toBe('hit')
    expect(correctPlay(context([c('8'), c('8')], 'A'), early({ peek: false }))).toBe('hit')
    expect(correctPlay(context([c('T'), c('6')], 'T', { postSplit: true }), early())).toBe('hit')
    expect(correctPlay(context([c('3'), c('3')], 'A', { postSplit: true }), early())).toBe('hit')
    expect(correctPlay(context([c('5'), c('5'), c('6')], 'A'), early())).toBe('hit')
  })
})

describe('insuranceCorrect', () => {
  it('declines insurance without counting', () => {
    expect(insuranceCorrect(false, 10)).toBe(false)
  })

  it('declines insurance below the index', () => {
    expect(insuranceCorrect(true, 2.9)).toBe(false)
  })

  it('takes insurance at the index or above', () => {
    expect(insuranceCorrect(true, 3)).toBe(true)
    expect(insuranceCorrect(true, 5.5)).toBe(true)
  })
})
