import type { Card } from '../cards'
import type { Rules } from '../rules'
import { DEFAULT_RULES } from '../rules'
import { CHARTS, UP_ORDER, deckFamily } from './charts'
import type { ChartSet, DeckFamily, DealerRule } from './charts'
import { correctPlay } from './correctPlay'
import type { DecisionContext } from './correctPlay'

export interface Check {
  name: string
  ok: boolean
}

const VALID_CHARS = new Set(['H', 'S', 'P', 'D', 'T'])

function card(rank: string, suit = 'S'): Card {
  return { rank: rank as Card['rank'], suit: suit as Card['suit'] }
}

function ctx(partial: Partial<DecisionContext>): DecisionContext {
  return {
    cards: [card('T'), card('6')],
    dealerUp: card('T'),
    postSplit: false,
    splitAces: false,
    numHands: 1,
    fundsForDouble: true,
    ...partial,
  }
}

function rules(partial: Partial<Rules>): Rules {
  return { ...DEFAULT_RULES, ...partial }
}

/** Structural checks for one chart; injectable so failure paths are testable. */
export function checkChartRows(name: string, chart: ChartSet): Check[] {
  const hardTotals = Object.keys(chart.hard).map(Number)
  const softTotals = Object.keys(chart.soft).map(Number)
  const pairRanks = Object.keys(chart.pairs)
  const hardRowsOk = hardTotals.length === 18 && hardTotals.every((total) => chart.hard[total]!.length === UP_ORDER.length)
  const softRowsOk = softTotals.length === 10 && softTotals.every((total) => chart.soft[total]!.length === UP_ORDER.length)
  const pairRowsOk = pairRanks.length === 10 && pairRanks.every((rank) => chart.pairs[rank]!.length === UP_ORDER.length)
  const allRows = [...Object.values(chart.hard), ...Object.values(chart.soft), ...Object.values(chart.pairs)]
  const cellsOk = allRows.every((row) => [...row].every((ch) => VALID_CHARS.has(ch)))
  return [
    { name: `${name}: hard rows 4-21 x 10 upcards`, ok: hardRowsOk },
    { name: `${name}: soft rows 12-21 x 10 upcards`, ok: softRowsOk },
    { name: `${name}: pair rows A,2-10 x 10 upcards`, ok: pairRowsOk },
    { name: `${name}: valid cells only`, ok: cellsOk },
  ]
}

function structuralChecks(): Check[] {
  const checks: Check[] = []
  const families: DeckFamily[] = ['1', '2', '4+']
  for (const family of families) {
    for (const dealerRule of ['S17', 'H17'] as DealerRule[]) {
      checks.push(...checkChartRows(`${family} ${dealerRule}`, CHARTS[family][dealerRule]))
    }
  }
  return checks
}

interface SpotCheck {
  name: string
  cards: Card[]
  up: string
  rules: Partial<Rules>
  context?: Partial<DecisionContext>
  expect: ReturnType<typeof correctPlay>
}

const SPOT_CHECKS: SpotCheck[] = [
  { name: 'hard 16 v 10 surrenders (LS on)', cards: [card('T'), card('6')], up: 'T', rules: {}, expect: 'surrender' },
  { name: 'hard 16 v 10 hits (LS off)', cards: [card('T'), card('6')], up: 'T', rules: { lateSurrender: false }, expect: 'hit' },
  { name: 'hard 15 v A surrenders in H17', cards: [card('T'), card('5')], up: 'A', rules: { hitSoft17: true }, expect: 'surrender' },
  { name: 'hard 15 v A hits in S17', cards: [card('T'), card('5')], up: 'A', rules: {}, expect: 'hit' },
  { name: 'hard 17 v A surrenders only in H17', cards: [card('T'), card('7')], up: 'A', rules: { hitSoft17: true }, expect: 'surrender' },
  { name: 'hard 17 v A stands in S17', cards: [card('T'), card('7')], up: 'A', rules: {}, expect: 'stand' },
  { name: 'hard 11 v A doubles in H17', cards: [card('5'), card('6')], up: 'A', rules: { hitSoft17: true }, expect: 'double' },
  { name: 'hard 11 v A hits in S17 (4+ decks)', cards: [card('5'), card('6')], up: 'A', rules: {}, expect: 'hit' },
  { name: 'hard 11 v A doubles in S17 (1 deck)', cards: [card('5'), card('6')], up: 'A', rules: { decks: 1 }, expect: 'double' },
  { name: 'soft 18 (A,7) v 2 stands in S17', cards: [card('A'), card('7')], up: '2', rules: {}, expect: 'stand' },
  { name: 'soft 18 (A,7) v 2 doubles in H17', cards: [card('A'), card('7')], up: '2', rules: { hitSoft17: true }, expect: 'double' },
  { name: 'soft 19 (A,8) v 6 doubles in H17', cards: [card('A'), card('8')], up: '6', rules: { hitSoft17: true }, expect: 'double' },
  { name: 'soft 19 (A,8) v 6 stands in S17', cards: [card('A'), card('8')], up: '6', rules: {}, expect: 'stand' },
  { name: '8,8 v A surrenders in H17 with LS', cards: [card('8'), card('8')], up: 'A', rules: { hitSoft17: true }, expect: 'surrender' },
  { name: '8,8 v A splits in H17 without LS', cards: [card('8'), card('8')], up: 'A', rules: { hitSoft17: true, lateSurrender: false }, expect: 'split' },
  { name: '2,2 v 2 splits with DAS', cards: [card('2'), card('2')], up: '2', rules: {}, expect: 'split' },
  { name: '2,2 v 2 hits without DAS', cards: [card('2'), card('2')], up: '2', rules: { doubleAfterSplit: false }, expect: 'hit' },
  { name: '2,2 v 6 splits without DAS (override does not apply)', cards: [card('2'), card('2')], up: '6', rules: { doubleAfterSplit: false }, expect: 'split' },
  { name: '6,6 v 2 splits without DAS (1 deck)', cards: [card('6'), card('6')], up: '2', rules: { decks: 1, doubleAfterSplit: false }, expect: 'split' },
  { name: '4,4 v 6 splits with DAS', cards: [card('4'), card('4')], up: '6', rules: {}, expect: 'split' },
  { name: '4,4 v 6 hits without DAS', cards: [card('4'), card('4')], up: '6', rules: { doubleAfterSplit: false }, expect: 'hit' },
  { name: '5,5 v 5 doubles (plays as hard 10)', cards: [card('5'), card('5')], up: '5', rules: {}, expect: 'double' },
  { name: '5,5 v 10 hits', cards: [card('5'), card('5')], up: 'T', rules: {}, expect: 'hit' },
  { name: 'T,T stands', cards: [card('T'), card('K')], up: '6', rules: {}, expect: 'stand' },
  { name: '9,9 v 7 stands', cards: [card('9'), card('9')], up: '7', rules: {}, expect: 'stand' },
  { name: 'double 10-11 blocks soft doubles', cards: [card('A'), card('4')], up: '5', rules: { doubleOn: '10-11' }, expect: 'hit' },
  { name: 'double 9-11 keeps hard 9 doubles', cards: [card('3'), card('6')], up: '5', rules: { doubleOn: '9-11' }, expect: 'double' },
  { name: 'double 9-11 keeps hard 10 doubles', cards: [card('6'), card('4')], up: '5', rules: { doubleOn: '9-11' }, expect: 'double' },
  { name: 'double 9-11 blocks hard 12 doubles', cards: [card('T'), card('2')], up: '5', rules: { doubleOn: '9-11' }, expect: 'stand' },
  { name: 'Ds falls back to stand without funds', cards: [card('A'), card('7')], up: '4', rules: {}, context: { fundsForDouble: false }, expect: 'stand' },
  { name: 'Dh falls back to hit without funds', cards: [card('T'), card('2')], up: '2', rules: {}, context: { fundsForDouble: false }, expect: 'hit' },
  { name: 'ENHC: 11 v 10 hits', cards: [card('5'), card('6')], up: 'T', rules: { peek: false }, expect: 'hit' },
  { name: 'ENHC: 10 v 10 hits', cards: [card('6'), card('4')], up: 'T', rules: { peek: false }, expect: 'hit' },
  { name: 'ENHC: 8,8 v 10 hits', cards: [card('8'), card('8')], up: 'T', rules: { peek: false }, expect: 'hit' },
  { name: 'ENHC: A,A v 10 still splits', cards: [card('A'), card('A')], up: 'T', rules: { peek: false }, expect: 'split' },
  { name: 'ENHC: A,A v A hits', cards: [card('A'), card('A')], up: 'A', rules: { peek: false }, expect: 'hit' },
  { name: 'ENHC: 11 v 6 still doubles', cards: [card('5'), card('6')], up: '6', rules: { peek: false }, expect: 'double' },
  {
    name: 'A,A resplit-exhausted doubles v 6 (4+ decks, drawing allowed)',
    cards: [card('A'), card('A')],
    up: '6',
    rules: { splitAcesOneCard: false },
    context: { postSplit: true, splitAces: true, numHands: 4 },
    expect: 'double',
  },
  {
    name: 'A,A resplit-exhausted doubles v 5 (1 deck)',
    cards: [card('A'), card('A')],
    up: '5',
    rules: { decks: 1, splitAcesOneCard: false },
    context: { postSplit: true, splitAces: true, numHands: 2 },
    expect: 'double',
  },
  {
    name: 'A,A resplit-exhausted hits v 7',
    cards: [card('A'), card('A')],
    up: '7',
    rules: { splitAcesOneCard: false },
    context: { postSplit: true, splitAces: true, numHands: 4 },
    expect: 'hit',
  },
  {
    name: 'A,A resplit-exhausted hits without funds',
    cards: [card('A'), card('A')],
    up: '6',
    rules: { splitAcesOneCard: false },
    context: { postSplit: true, splitAces: true, numHands: 4, fundsForDouble: false },
    expect: 'hit',
  },
  {
    name: 'A,A resplit-exhausted hits under the one-card rule',
    cards: [card('A'), card('A')],
    up: '6',
    rules: { splitAcesOneCard: true },
    context: { postSplit: true, splitAces: true, numHands: 4 },
    expect: 'hit',
  },
  { name: 'hard 12 v 3 hits', cards: [card('T'), card('2')], up: '3', rules: {}, expect: 'hit' },
  { name: 'hard 12 v 4 stands', cards: [card('T'), card('2')], up: '4', rules: {}, expect: 'stand' },
  { name: 'hard 12 v 3 hits with three cards (no double possible)', cards: [card('T'), card('2')], up: '3', rules: {}, context: { cards: [card('7'), card('3'), card('2')] }, expect: 'hit' },
  { name: 'soft 21 stands', cards: [card('A'), card('T')], up: 'T', rules: {}, expect: 'stand' },
  { name: 'post-split hard 16 v 10 hits (no surrender after split)', cards: [card('T'), card('6')], up: 'T', rules: {}, context: { postSplit: true }, expect: 'hit' },
]

export function runSelfTest(): Check[] {
  return [...structuralChecks(), ...SPOT_CHECKS.map((spot) => ({
    name: spot.name,
    ok:
      correctPlay(ctx({ cards: spot.cards, dealerUp: card(spot.up), ...spot.context }), rules(spot.rules)) ===
      spot.expect,
  }))]
}

export { card as testCard, ctx as testContext, rules as testRules, deckFamily }
