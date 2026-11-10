import type { Card } from '../cards'
import { rankValue } from '../cards'
import { handValue, isPair } from '../hand'
import type { Rules } from '../rules'
import {
  CHARTS,
  NO_DAS_OVERRIDES,
  SURRENDER_OVERRIDES,
  cellAt,
  deckFamily,
} from './charts'
import type { DealerRule, DeckFamily, Up } from './charts'

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender'

export interface DecisionContext {
  cards: readonly Card[]
  dealerUp: Card
  /** Hand was created by a split. */
  postSplit: boolean
  /** Hand is an ace from split aces (playing on when drawing is allowed). */
  splitAces: boolean
  /** Total player hands in this round. */
  numHands: number
  /** Bankroll can cover the additional double/split wager. */
  fundsForDouble: boolean
}

function upOf(card: Card): Up {
  const value = rankValue(card.rank)
  if (value === 11) return 'A'
  if (value === 10) return 'T'
  return String(value) as Up
}

function pairRankKey(cards: readonly Card[]): string {
  const value = rankValue(cards[0]!.rank)
  if (value === 11) return 'A'
  if (value === 10) return 'T'
  return String(value)
}

function doublePermitted(
  rules: Rules,
  total: number,
  soft: boolean,
  cardsLen: number,
  postSplit: boolean,
  funds: boolean,
): boolean {
  if (cardsLen !== 2) return false
  if (postSplit && !rules.doubleAfterSplit) return false
  if (!funds) return false
  if (rules.doubleOn === 'any') return true
  // Reno/European restrictions apply to hard totals only.
  if (soft) return false
  if (rules.doubleOn === '9-11') return total >= 9 && total <= 11
  return total >= 10 && total <= 11
}

function enhcUpBlocked(up: Up): boolean {
  return up === 'T' || up === 'A'
}

function surrenderMatches(
  family: DeckFamily,
  dealerRule: DealerRule,
  up: Up,
  total: number,
  soft: boolean,
): boolean {
  if (soft) return false
  for (const [key, overrideUp] of SURRENDER_OVERRIDES[family][dealerRule]) {
    if (overrideUp !== up) continue
    // 'p8' applies only to a splittable pair of 8s (see pairSurrender).
    if (key === 'p8') continue
    if (total === Number(key.slice(1))) return true
  }
  return false
}

/** Pair-specific surrender (8,8 vs A under H17) — total overrides must not fire on splittable pairs. */
function pairSurrender(family: DeckFamily, dealerRule: DealerRule, up: Up): boolean {
  return SURRENDER_OVERRIDES[family][dealerRule].some(
    ([key, overrideUp]) => key === 'p8' && overrideUp === up,
  )
}

/**
 * Early-surrender pair carve-out (Wizard of Odds): only the ace/ten upcards
 * differ from late surrender. Pairs whose chart cell is hit/stand still
 * surrender early (e.g. 7,7 vs T), so the pair block consults the total
 * matcher before the chart — except single-deck 8,8 vs T with DAS,
 * which splits.
 */
function earlyPairCarveOut(
  up: Up,
  pairKey: string,
  family: DeckFamily,
  doubleAfterSplit: boolean,
): boolean {
  return up === 'T' && pairKey === '8' && family === '1' && doubleAfterSplit
}

/**
 * Early-surrender hard totals (Wizard of Odds): vs an ace, hard 5-7 and
 * 12-17 (plus a pair of 2s under H17); vs a ten, hard 14-16.
 * Composition exceptions vs a ten: single-deck T+4 and 9+5 play out,
 * double-deck T+4 plays out. Soft hands never surrender.
 */
function earlySurrenderMatches(
  family: DeckFamily,
  dealerRule: DealerRule,
  up: Up,
  total: number,
  soft: boolean,
  cards: readonly Card[],
  pairKey: string | null,
): boolean {
  if (soft) return false
  if (up === 'A') {
    if (total >= 5 && total <= 7) return true
    if (total >= 12 && total <= 17) return true
    return pairKey === '2' && dealerRule === 'H17'
  }
  if (up === 'T') {
    if (total === 15 || total === 16) return true
    if (total !== 14) return false
    const ranks = cards.map((card) => card.rank)
    const tenFour = ranks.some((rank) => rankValue(rank) === 10) && ranks.includes('4')
    const nineFive = ranks.includes('9') && ranks.includes('5')
    if (family === '1' && (tenFour || nineFive)) return false
    if (family === '2' && tenFour) return false
    return true
  }
  return false
}

export function correctPlay(ctx: DecisionContext, rules: Rules): Action {
  const family = deckFamily(rules.decks)
  const dealerRule: DealerRule = rules.hitSoft17 ? 'H17' : 'S17'
  const chart = CHARTS[family][dealerRule]
  const up = upOf(ctx.dealerUp)
  const value = handValue(ctx.cards)
  const pair = isPair(ctx.cards)
  const pairKey = pair ? pairRankKey(ctx.cards) : null
  const canSplit =
    pair &&
    ctx.numHands < rules.maxHands &&
    (!ctx.splitAces || rules.resplitAces)

  if (canSplit) {
    const key = pairRankKey(ctx.cards)
    if (
      rules.earlySurrender &&
      rules.peek &&
      !ctx.postSplit &&
      earlySurrenderMatches(family, dealerRule, up, value.total, value.soft, ctx.cards, pairKey) &&
      !earlyPairCarveOut(up, key, family, rules.doubleAfterSplit)
    ) {
      return 'surrender'
    }
    let cell = cellAt(chart.pairs[key]!, up)
    if (!rules.doubleAfterSplit) {
      const blocked = NO_DAS_OVERRIDES[family][key]
      if (blocked && blocked.includes(up)) cell = 'H'
    }
    if (cell === 'P') {
      if (!(!rules.peek && enhcUpBlocked(up) && !(key === 'A' && up === 'T'))) {
        if (
          rules.lateSurrender &&
          rules.peek &&
          pairSurrender(family, dealerRule, up)
        ) {
          return 'surrender'
        }
        return 'split'
      }
      // ENHC: fall through and evaluate as a total hand.
    } else if (cell === 'S') {
      return 'stand'
    } else if (cell === 'H') {
      // The pair chart is authoritative (e.g. 4,4 vs 5 without DAS hits
      // even though a plain hard 8 would double).
      return 'hit'
    }
    // 'D', 'T' fall through to the total evaluation (equivalent semantics).
  }

  // Pair of aces that cannot be resplit while drawing to split aces is allowed.
  if (
    pairKey === 'A' &&
    !canSplit &&
    ctx.cards.length === 2 &&
    !rules.splitAcesOneCard
  ) {
    const wantsDouble =
      family === '4+' ? up === '6' : up === '5' || up === '6'
    if (
      wantsDouble &&
      doublePermitted(rules, value.total, value.soft, ctx.cards.length, ctx.postSplit, ctx.fundsForDouble)
    ) {
      return 'double'
    }
    return 'hit'
  }

  const row = value.soft ? chart.soft[value.total]! : chart.hard[value.total]!
  const cell = cellAt(row, up)

  if (
    rules.earlySurrender &&
    rules.peek &&
    !ctx.postSplit &&
    ctx.cards.length === 2 &&
    earlySurrenderMatches(family, dealerRule, up, value.total, value.soft, ctx.cards, pairKey)
  ) {
    return 'surrender'
  }

  if (
    rules.lateSurrender &&
    rules.peek &&
    !ctx.postSplit &&
    ctx.cards.length === 2 &&
    surrenderMatches(family, dealerRule, up, value.total, value.soft)
  ) {
    return 'surrender'
  }

  if (
    (cell === 'D' || cell === 'T') &&
    doublePermitted(rules, value.total, value.soft, ctx.cards.length, ctx.postSplit, ctx.fundsForDouble) &&
    // No-peek games block doubles vs T/A (the extra wager is exposed) —
    // unless OBBO caps the loss at the original unit, which restores peek
    // doubling exactly (a basic-strategy double can never bust its one card).
    !(!rules.peek && !rules.obbo && enhcUpBlocked(up))
  ) {
    return 'double'
  }

  return cell === 'S' || cell === 'T' ? 'stand' : 'hit'
}

/** Insurance (and even money) grading. Count-dependent when the overlay is on. */
export function insuranceCorrect(counting: boolean, trueCount: number): boolean {
  if (!counting) return false
  return trueCount >= 3
}

/** Decision plus its display wording, so the UI never re-derives the label. */
export interface InsuranceAdvice {
  take: boolean
  label: string
}

export function insuranceAdvice(counting: boolean, trueCount: number): InsuranceAdvice {
  const take = insuranceCorrect(counting, trueCount)
  return { take, label: take ? 'Take insurance' : 'Decline insurance' }
}
