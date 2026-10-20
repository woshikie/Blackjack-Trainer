import { describe, expect, it } from 'vitest'
import { CHARTS, NO_DAS_OVERRIDES, SURRENDER_OVERRIDES, UP_ORDER, cellAt, deckFamily } from '../src/domain/strategy/charts'
import { checkChartRows, runSelfTest } from '../src/domain/strategy/selftest'

describe('deckFamily', () => {
  it('maps deck counts to chart families', () => {
    expect(deckFamily(1)).toBe('1')
    expect(deckFamily(2)).toBe('2')
    expect(deckFamily(4)).toBe('4+')
    expect(deckFamily(6)).toBe('4+')
    expect(deckFamily(8)).toBe('4+')
  })
})

describe('cellAt', () => {
  it('reads cells in upcard order', () => {
    expect(cellAt('HSHHHHHHHH', '2')).toBe('H')
    expect(cellAt('HSHHHHHHHH', '3')).toBe('S')
    expect(cellAt('HSHHHHHHHH', 'A')).toBe('H')
  })

  it('throws on a malformed row', () => {
    expect(() => cellAt('HH', 'T')).toThrow('malformed chart row')
  })
})

describe('chart structure', () => {
  it('passes structural checks for every family and dealer rule', () => {
    for (const check of runSelfTest()) {
      if (!check.name.includes(':')) continue
      expect(check.ok, check.name).toBe(true)
    }
  })

  it('detects broken charts', () => {
    const broken = {
      hard: { ...CHARTS['4+'].S17.hard, 16: 'SSSSS' },
      soft: { ...CHARTS['4+'].S17.soft, 18: 'STTTTXSHH' },
      pairs: { ...CHARTS['4+'].S17.pairs, '8': 'PPPPPPPPP' },
    }
    const checks = checkChartRows('broken', broken)
    expect(checks.find((check) => check.name.includes('hard'))?.ok).toBe(false)
    expect(checks.find((check) => check.name.includes('soft'))?.ok).toBe(false)
    expect(checks.find((check) => check.name.includes('pair'))?.ok).toBe(false)
    expect(checks.find((check) => check.name.includes('valid cells'))?.ok).toBe(false)
  })

  it('detects missing rows', () => {
    const { 16: _droppedHard, ...hard } = CHARTS['4+'].S17.hard
    const { 18: _droppedSoft, ...soft } = CHARTS['4+'].S17.soft
    const { '8': _droppedPair, ...pairs } = CHARTS['4+'].S17.pairs
    const checks = checkChartRows('missing', { hard, soft, pairs })
    expect(checks.find((check) => check.name.includes('hard'))?.ok).toBe(false)
    expect(checks.find((check) => check.name.includes('soft'))?.ok).toBe(false)
    expect(checks.find((check) => check.name.includes('pair'))?.ok).toBe(false)
    expect(checks.find((check) => check.name.includes('valid cells'))?.ok).toBe(true)
  })

  it('covers the full upcard column set in every row', () => {
    for (const family of ['1', '2', '4+'] as const) {
      for (const rule of ['S17', 'H17'] as const) {
        const chart = CHARTS[family][rule]
        for (const row of [...Object.values(chart.hard), ...Object.values(chart.soft), ...Object.values(chart.pairs)]) {
          expect(row).toHaveLength(UP_ORDER.length)
        }
      }
    }
  })
})

describe('override tables', () => {
  it('lists surrender cells for every family and dealer rule', () => {
    for (const family of ['1', '2', '4+'] as const) {
      expect(SURRENDER_OVERRIDES[family].S17.length).toBeGreaterThan(0)
      expect(SURRENDER_OVERRIDES[family].H17.length).toBeGreaterThan(0)
      expect(SURRENDER_OVERRIDES[family].H17.length).toBeGreaterThanOrEqual(SURRENDER_OVERRIDES[family].S17.length)
    }
  })

  it('lists no-DAS pair overrides', () => {
    expect(NO_DAS_OVERRIDES['4+']['2']).toContain('2')
    expect(NO_DAS_OVERRIDES['1']['6']).toEqual([])
  })
})

describe('reference plays (all spot checks)', () => {
  it('passes every spot check', () => {
    for (const check of runSelfTest()) {
      if (check.name.includes(':')) continue
      expect(check.ok, check.name).toBe(true)
    }
  })
})
