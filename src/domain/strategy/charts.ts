import type { DeckCount } from '../rules'

/**
 * Chart cell semantics (Wizard of Odds conventions):
 *  H = hit, S = stand, P = split,
 *  D = double (else hit), T = double (else stand).
 * Surrender is an override layer (SURRENDER_OVERRIDES), not a base cell.
 *
 * Column order in every row string: 2 3 4 5 6 7 8 9 T A
 */
export type Cell = 'H' | 'S' | 'P' | 'D' | 'T'

export const UP_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'] as const
export type Up = (typeof UP_ORDER)[number]

export type DeckFamily = '1' | '2' | '4+'
export type DealerRule = 'S17' | 'H17'

export interface ChartSet {
  hard: Record<number, string>
  soft: Record<number, string>
  pairs: Record<string, string>
}

export function deckFamily(decks: DeckCount): DeckFamily {
  if (decks === 1) return '1'
  if (decks === 2) return '2'
  return '4+'
}

const S_ALL = 'SSSSSSSSSS'
const H_ALL = 'HHHHHHHHHH'

const PAIRS_4_PLUS: Record<string, string> = {
  A: 'PPPPPPPPPP',
  '2': 'PPPPPPHHHH',
  '3': 'PPPPPPHHHH',
  '4': 'HHHPPHHHHH',
  '5': 'DDDDDDDDHH',
  '6': 'PPPPPHHHHH',
  '7': 'PPPPPPPHHH',
  '8': 'PPPPPPPPPP',
  '9': 'PPPPPSPPSS',
  T: S_ALL,
}

const HARD_4_PLUS_S17: Record<number, string> = {
  4: H_ALL,
  5: H_ALL,
  6: H_ALL,
  7: H_ALL,
  8: H_ALL,
  9: 'HHDDDDHHHH',
  10: 'DDDDDDDDHH',
  11: 'DDDDDDDDDH',
  12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH',
  14: 'SSSSSHHHHH',
  15: 'SSSSSHHHHH',
  16: 'SSSSSHHHHH',
  17: S_ALL,
  18: S_ALL,
  19: S_ALL,
  20: S_ALL,
  21: S_ALL,
}

const SOFT_4_PLUS_S17: Record<number, string> = {
  12: H_ALL,
  13: 'HHHDDHHHHH',
  14: 'HHHDDHHHHH',
  15: 'HHDDDHHHHH',
  16: 'HHDDDHHHHH',
  17: 'HDDDDHHHHH',
  18: 'STTTTSSHHH',
  19: S_ALL,
  20: S_ALL,
  21: S_ALL,
}

const HARD_2_S17: Record<number, string> = {
  ...HARD_4_PLUS_S17,
  8: 'HHHDDHHHHH',
  9: 'DDDDDHHHHH',
  11: 'DDDDDDDDDD',
}

const SOFT_2_S17: Record<number, string> = {
  ...SOFT_4_PLUS_S17,
  13: 'HHDDDHHHHH',
  14: 'HHDDDHHHHH',
  15: 'HHDDDHHHHH',
  16: 'HHDDDHHHHH',
}

const HARD_1_S17: Record<number, string> = { ...HARD_2_S17 }

const SOFT_1_S17: Record<number, string> = {
  ...SOFT_2_S17,
  17: 'DDDDDHHHHH',
  18: 'TTTTTSSHHH',
  19: 'SSSSTSSSSS',
}

const PAIRS_1: Record<string, string> = {
  ...PAIRS_4_PLUS,
  '3': 'PPPPPPPHHH',
  '4': 'HHPPPHHHHH',
  '7': 'PPPPPPHHSH',
}

export const CHARTS: Record<DeckFamily, Record<DealerRule, ChartSet>> = {
  '4+': {
    S17: { hard: HARD_4_PLUS_S17, soft: SOFT_4_PLUS_S17, pairs: PAIRS_4_PLUS },
    H17: {
      hard: { ...HARD_4_PLUS_S17, 11: 'DDDDDDDDDD' },
      soft: { ...SOFT_4_PLUS_S17, 18: 'TTTTTSSHHH', 19: 'SSSSTSSSSS' },
      pairs: PAIRS_4_PLUS,
    },
  },
  '2': {
    S17: { hard: HARD_2_S17, soft: SOFT_2_S17, pairs: PAIRS_4_PLUS },
    H17: {
      hard: HARD_2_S17,
      soft: { ...SOFT_2_S17, 18: 'TTTTTSSHHH', 19: 'SSSSTSSSSS' },
      pairs: PAIRS_4_PLUS,
    },
  },
  '1': {
    S17: { hard: HARD_1_S17, soft: SOFT_1_S17, pairs: PAIRS_1 },
    H17: {
      hard: { ...HARD_1_S17, 10: 'DDDDDDDDDH' },
      soft: SOFT_1_S17,
      pairs: PAIRS_1,
    },
  },
}

/** Late-surrender cells per family/dealer rule; key 'hN' = hard total N, 'p8' = pair of eights. */
export const SURRENDER_OVERRIDES: Record<DeckFamily, Record<DealerRule, readonly (readonly [string, Up])[]>> = {
  '4+': {
    S17: [
      ['h15', 'T'],
      ['h16', '9'],
      ['h16', 'T'],
      ['h16', 'A'],
    ],
    H17: [
      ['h15', 'T'],
      ['h15', 'A'],
      ['h16', '9'],
      ['h16', 'T'],
      ['h16', 'A'],
      ['h17', 'A'],
      ['p8', 'A'],
    ],
  },
  '2': {
    S17: [
      ['h15', 'T'],
      ['h16', '9'],
      ['h16', 'T'],
      ['h16', 'A'],
    ],
    H17: [
      ['h15', 'T'],
      ['h15', 'A'],
      ['h16', '9'],
      ['h16', 'T'],
      ['h16', 'A'],
      ['h17', 'A'],
    ],
  },
  '1': {
    S17: [
      ['h15', 'T'],
      ['h16', '9'],
      ['h16', 'T'],
      ['h16', 'A'],
    ],
    H17: [
      ['h15', 'T'],
      ['h15', 'A'],
      ['h16', '9'],
      ['h16', 'T'],
      ['h16', 'A'],
      ['h17', 'A'],
    ],
  },
}

/**
 * Pair cells that revert to hit when double-after-split is not offered.
 * Single-deck 6,6 vs 2 splits regardless of DAS (composition-dependent).
 */
export const NO_DAS_OVERRIDES: Record<DeckFamily, Record<string, readonly Up[]>> = {
  '4+': { '2': ['2', '3'], '3': ['2', '3'], '4': ['5', '6'], '6': ['2'] },
  '2': { '2': ['2', '3'], '3': ['2', '3'], '4': ['5', '6'], '6': ['2'] },
  '1': { '2': ['2', '3'], '3': ['2', '3'], '4': ['5', '6'], '6': [] },
}

/** Look up a cell in a row string. Rows are structurally validated by the self-test. */
export function cellAt(row: string, up: Up): Cell {
  const idx = UP_ORDER.indexOf(up)
  const cell = row[idx] as Cell | undefined
  if (!cell) throw new Error(`malformed chart row "${row}" for up ${up}`)
  return cell
}
