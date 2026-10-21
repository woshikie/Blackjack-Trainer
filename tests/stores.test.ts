import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Card, Rank, Suit } from '../src/domain/cards'
import { HI_LO } from '../src/domain/counting'
import { Game, START_BANKROLL } from '../src/domain/engine/game'
import { mulberry32 } from '../src/domain/rng'
import { DEFAULT_RULES } from '../src/domain/rules'
import type { Rules } from '../src/domain/rules'
import { createGameStore } from '../src/stores/game'
import { createSettingsStore } from '../src/stores/settings'
import { createStatsStore } from '../src/stores/stats'
import { insuranceAdvice } from '../src/domain/strategy/correctPlay'

function c(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit }
}

function shoeOf(...order: Card[]): Card[] {
  return [...order].reverse()
}

function factoryFor(rules: Rules, order: Card[], counting = false): () => Game {
  const preset = shoeOf(...order)
  return () => new Game(rules, mulberry32(99), counting ? HI_LO : undefined, preset)
}

function makeStores(order: Card[], options: { counting?: boolean } = {}, rules: Rules = { ...DEFAULT_RULES }) {
  const settings = createSettingsStore(null)
  settings.state.rules = rules
  if (options.counting !== undefined) {
    settings.updatePractice({ counting: options.counting })
  }
  const stats = createStatsStore(null)
  const game = createGameStore(settings, stats, factoryFor(settings.state.rules, order, settings.state.practice.counting))
  return { settings, stats, game }
}

const BET = 10

describe('settings store', () => {
  const KEY = 'bj-trainer-settings-v1'

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when there is no storage', () => {
    const store = createSettingsStore(null)
    expect(store.state.rules).toEqual(DEFAULT_RULES)
    expect(store.state.practice.chipDenominations).toEqual([5, 25, 100, 500])
  })

  it('returns defaults for absent, corrupt, or partial stored data', () => {
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    localStorage.setItem(KEY, 'not json')
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    localStorage.setItem(KEY, '5')
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    localStorage.setItem(KEY, 'null')
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    localStorage.setItem(KEY, JSON.stringify({ rules: null, practice: null }))
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    localStorage.setItem(KEY, JSON.stringify({ rules: 5, practice: { defaultBet: 12 } }))
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    localStorage.setItem(KEY, JSON.stringify({ rules: { decks: 1 }, practice: 'nope' }))
    // an invalid practice section falls back to full defaults
    expect(load().rules.decks).toBe(DEFAULT_RULES.decks)
    expect(load().practice.feedbackMode).toBe('strict')
    localStorage.setItem(KEY, JSON.stringify({ rules: { decks: 1 }, practice: { defaultBet: 12 } }))
    const loaded = load()
    expect(loaded.rules.decks).toBe(1)
    expect(loaded.practice.defaultBet).toBe(12)
    // untouched fields fall back to defaults, ENHC constraint re-applied
    expect(loaded.practice.chipDenominations).toEqual([5, 25, 100, 500])
    expect(loaded.rules.lateSurrender).toBe(true)

    function load(): ReturnType<typeof createSettingsStore>['state'] {
      // createSettingsStore(live storage) reads through the key
      const store = createSettingsStore(localStorage)
      return store.state
    }
  })

  it('persists rule and practice changes', () => {
    const store = createSettingsStore(localStorage)
    store.updateRules({ decks: 2, maxBet: 50 })
    store.updatePractice({ defaultBet: 12, feedbackMode: 'lenient' })
    const raw = JSON.parse(localStorage.getItem(KEY)!) as {
      rules: Rules
      practice: { defaultBet: number; feedbackMode: string }
    }
    expect(raw.rules.decks).toBe(2)
    expect(raw.rules.maxBet).toBe(50)
    expect(raw.practice.defaultBet).toBe(12)
    expect(raw.practice.feedbackMode).toBe('lenient')
  })

  it('forces late surrender off under ENHC and normalizes on every change', () => {
    const store = createSettingsStore(null)
    store.updateRules({ peek: false })
    expect(store.state.rules.lateSurrender).toBe(false)
    store.updateRules({ peek: true, lateSurrender: true })
    expect(store.state.rules.lateSurrender).toBe(true)
  })

  it('resets to defaults', () => {
    const store = createSettingsStore(null)
    store.updateRules({ decks: 1 })
    store.updatePractice({ defaultBet: 77 })
    store.reset()
    expect(store.state.rules.decks).toBe(DEFAULT_RULES.decks)
    expect(store.state.practice.defaultBet).toBe(25)
    expect(store.state.mode).toBe('practice')
  })

  it('switches and persists the app mode, rejecting unknown modes', () => {
    const store = createSettingsStore(localStorage)
    expect(store.state.mode).toBe('practice')
    store.setMode('live')
    expect(JSON.parse(localStorage.getItem(KEY)!)['mode']).toBe('live')
    // re-loading stored state restores the live mode
    const reloaded = createSettingsStore(localStorage)
    expect(reloaded.state.mode).toBe('live')
    localStorage.setItem(KEY, JSON.stringify({ rules: { decks: 1 }, practice: null, mode: 'banana' }))
    expect(createSettingsStore(localStorage).state.mode).toBe('practice')
  })
})

describe('stats store', () => {
  const KEY = 'bj-trainer-stats-v1'

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty stats when there is no storage', () => {
    const store = createStatsStore(null)
    expect(store.stats.value.hands).toBe(0)
    expect(store.accuracy()).toBeNull()
    expect(store.worstSpots()).toEqual([])
  })

  it('returns empty stats for absent, corrupt, or partial data', () => {
    expect(createStatsStore(localStorage).stats.value.decisions).toBe(0)
    localStorage.setItem(KEY, 'nope')
    expect(createStatsStore(localStorage).stats.value.decisions).toBe(0)
    localStorage.setItem(KEY, '3')
    expect(createStatsStore(localStorage).stats.value.decisions).toBe(0)
    localStorage.setItem(KEY, 'null')
    expect(createStatsStore(localStorage).stats.value.decisions).toBe(0)
    localStorage.setItem(KEY, JSON.stringify({ decisions: 2 }))
    const handsMissing = createStatsStore(localStorage)
    expect(handsMissing.stats.value.hands).toBe(0)
    expect(handsMissing.stats.value.decisions).toBe(2)
    localStorage.setItem(KEY, JSON.stringify({ hands: 7, decisions: 'x', spots: null }))
    const store = createStatsStore(localStorage)
    expect(store.stats.value.hands).toBe(7)
    expect(store.stats.value.decisions).toBe(0)
    expect(store.stats.value.spots).toEqual({})
  })

  it('restores a complete saved record', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        hands: 3,
        decisions: 10,
        mistakes: 2,
        streak: 1,
        bestStreak: 4,
        spots: { 'h16 v T': { seen: 4, mistakes: 3 } },
      }),
    )
    const store = createStatsStore(localStorage)
    expect(store.stats.value.hands).toBe(3)
    expect(store.stats.value.decisions).toBe(10)
    expect(store.stats.value.mistakes).toBe(2)
    expect(store.stats.value.streak).toBe(1)
    expect(store.stats.value.bestStreak).toBe(4)
    expect(store.worstSpots(5)[0]?.key).toBe('h16 v T')
  })

  it('persists recorded decisions and hands', () => {
    const store = createStatsStore(localStorage)
    store.recordDecision('h16 v T', false)
    store.recordHand()
    const raw = JSON.parse(localStorage.getItem(KEY)!) as { hands: number; mistakes: number }
    expect(raw.hands).toBe(1)
    expect(raw.mistakes).toBe(1)
    expect(store.accuracy()).toBeCloseTo(0)
  })

  it('resets and recomputes helpers', () => {
    const store = createStatsStore(null)
    for (let i = 0; i < 4; i++) store.recordDecision('h16 v T', false)
    store.recordHand()
    expect(store.worstSpots(1)[0]?.key).toBe('h16 v T')
    store.recordDecision('s18 v 6', true)
    expect(store.stats.value.bestStreak).toBe(1)
    store.reset()
    expect(store.stats.value.hands).toBe(0)
  })
})

describe('insuranceAdvice', () => {
  it('derives both the decision and its wording', () => {
    expect(insuranceAdvice(false, 10)).toEqual({ take: false, label: 'Decline insurance' })
    expect(insuranceAdvice(true, 2)).toEqual({ take: false, label: 'Decline insurance' })
    expect(insuranceAdvice(true, 3.5)).toEqual({ take: true, label: 'Take insurance' })
  })
})

describe('game store grading', () => {
  it('strict mode blocks a wrong play until the correct one is chosen', () => {
    const { stats, game } = makeStores([c('T'), c('T'), c('6'), c('5')])
    game.startRound(BET)
    expect(game.snapshot.value.phase).toBe('player')
    game.playerDecide('hit')
    expect(game.notice.value).toEqual({ kind: 'mistake', text: 'Correct play: Surrender' })
    expect(game.snapshot.value.phase).toBe('player')
    expect(game.snapshot.value.hands[0]?.cards).toHaveLength(2)
    expect(stats.stats.value.decisions).toBe(1)
    expect(stats.stats.value.mistakes).toBe(1)
    game.playerDecide('surrender')
    expect(game.snapshot.value.phase).toBe('settled')
    expect(game.notice.value).toBeNull()
    expect(stats.stats.value.decisions).toBe(2)
    expect(stats.stats.value.mistakes).toBe(1)
  })

  it('executes the correct play in strict mode without a notice', () => {
    const { game } = makeStores([c('T'), c('T'), c('6'), c('5')])
    game.startRound(BET)
    game.playerDecide('surrender')
    expect(game.notice.value).toBeNull()
    expect(game.snapshot.value.phase).toBe('settled')
  })

  it('lenient mode flags but executes', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ feedbackMode: 'lenient' })
    const stats = createStatsStore(null)
    const game = createGameStore(
      settings,
      stats,
      factoryFor(settings.state.rules, [c('T'), c('T'), c('6'), c('5'), c('5'), c('T')]),
    )
    game.startRound(BET)
    game.playerDecide('hit')
    expect(game.notice.value).toEqual({ kind: 'mistake', text: 'Correct play: Surrender' })
    expect(game.snapshot.value.phase).toBe('settled')
    expect(game.snapshot.value.hands[0]?.result).toBe('win')
  })

  it('silent mode tallies the mistake without a notice', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ feedbackMode: 'silent' })
    const stats = createStatsStore(null)
    const game = createGameStore(
      settings,
      stats,
      factoryFor(settings.state.rules, [c('T'), c('T'), c('6'), c('5'), c('2')]),
    )
    game.startRound(BET)
    game.playerDecide('hit')
    expect(game.notice.value).toBeNull()
    expect(stats.stats.value.mistakes).toBe(1)
  })

  it('ignores decisions outside the player phase', () => {
    const { stats, game } = makeStores([])
    game.playerDecide('hit')
    expect(stats.stats.value.decisions).toBe(0)
  })

  it('strict mode blocks insurance overpayment and accepts the decline', () => {
    const { game } = makeStores([c('5'), c('A'), c('T'), c('8')])
    game.startRound(BET)
    expect(game.snapshot.value.phase).toBe('insurance')
    expect(game.availableActions.value).toEqual([])
    expect(game.activeHand.value).toBeNull()
    game.resolveInsurance(true)
    expect(game.notice.value).toEqual({ kind: 'mistake', text: 'Correct play: Decline insurance' })
    expect(game.snapshot.value.phase).toBe('insurance')
    expect(game.snapshot.value.bankroll).toBe(START_BANKROLL - BET)
    game.resolveInsurance(false)
    expect(game.snapshot.value.phase).toBe('player')
    expect(game.snapshot.value.insuranceTaken).toBe(false)
    expect(game.availableActions.value).toContain('surrender')
    expect(game.activeHand.value?.cards).toHaveLength(2)
  })

  it('grades insurance against the live count when counting is on', () => {
    const { game } = makeStores([c('5'), c('A'), c('T'), c('8')], { counting: true })
    game.startRound(BET)
    expect(game.snapshot.value.phase).toBe('insurance')
    expect(game.snapshot.value.count).not.toBeNull()
    // deeply negative count: declining is correct and executes silently
    game.resolveInsurance(false)
    expect(game.notice.value).toBeNull()
    expect(game.snapshot.value.phase).toBe('player')
  })
})

describe('game store betting helpers', () => {
  const { settings, game } = makeStores([])
  it('validates legal bets against the configured limits', () => {
    expect(game.betLegal(4)).toBe(false)
    expect(game.betLegal(5)).toBe(true)
    settings.updateRules({ maxBet: 50 })
    expect(game.betLegal(50)).toBe(true)
    expect(game.betLegal(51)).toBe(false)
    expect(game.betLegal(2000)).toBe(false)
  })

  it('manages the pending bet with chips, clear, and rebet', () => {
    game.addChip(5)
    game.addChip(25)
    expect(game.pendingBet.value).toBe(30)
    game.clearBet()
    expect(game.pendingBet.value).toBe(0)
    game.rebet()
    expect(game.pendingBet.value).toBe(25)
  })

  it('rebets the last played bet, not the configured default', () => {
    const { game: g2 } = makeStores([c('T'), c('6'), c('8'), c('T'), c('8')])
    g2.startRound(40)
    g2.playerDecide('stand')
    g2.stopPlaying()
    expect(g2.snapshot.value.phase).toBe('betting')
    g2.clearBet()
    g2.rebet()
    expect(g2.pendingBet.value).toBe(40)
  })

  it('reseeds the last bet from the default bet on a new session', () => {
    const { game: g2 } = makeStores([c('T'), c('T'), c('6'), c('5')])
    g2.startRound(40)
    g2.playerDecide('surrender')
    g2.resetSession()
    g2.rebet()
    expect(g2.pendingBet.value).toBe(25)
  })

  it('leaves the betting phase alone when stop is pressed outside a settled round', () => {
    const { game: g2 } = makeStores([])
    g2.addChip(25)
    g2.stopPlaying()
    expect(g2.snapshot.value.phase).toBe('betting')
    expect(g2.pendingBet.value).toBe(25)
  })

  it('exposes actions only during the player phase', () => {
    expect(game.availableActions.value).toEqual([])
    expect(game.activeHand.value).toBeNull()
  })

  it('flags a bankroll below the table minimum and tops up', () => {
    // hard 17 v T: stand is correct, dealer 20 wins, full bet lost (no insurance: broke)
    const topUpStores = makeStores([c('T'), c('T'), c('7'), c('T')])
    const { game: g2 } = topUpStores
    g2.startRound(1000)
    g2.playerDecide('stand')
    g2.nextHand()
    expect(g2.needsTopUp.value).toBe(true)
    g2.topUp()
    expect(g2.snapshot.value.bankroll).toBe(START_BANKROLL)
    expect(g2.needsTopUp.value).toBe(false)
  })

  it('resets the session cleanly', () => {
    const { game: g2 } = makeStores([c('T'), c('T'), c('6'), c('5')])
    g2.startRound(BET)
    g2.playerDecide('surrender')
    g2.rebet()
    g2.resetSession()
    expect(g2.snapshot.value.phase).toBe('betting')
    expect(g2.snapshot.value.bankroll).toBe(START_BANKROLL)
    expect(g2.pendingBet.value).toBe(0)
    expect(g2.notice.value).toBeNull()
  })

  it('builds a default engine when no factory is given', () => {
    const settings = createSettingsStore(null)
    const stats = createStatsStore(null)
    const game = createGameStore(settings, stats)
    expect(game.snapshot.value.phase).toBe('betting')
    expect(game.snapshot.value.bankroll).toBe(START_BANKROLL)
    expect(game.snapshot.value.remaining).toBe(312)
  })

  it('rebuilds the engine when the rules change between rounds', () => {
    const { settings, game } = makeStores([c('T'), c('6'), c('8'), c('T'), c('8')])
    game.startRound(BET)
    game.playerDecide('stand')
    game.stopPlaying()
    settings.updateRules({ decks: 2 })
    game.startRound(BET)
    // fresh 2-deck shoe proves the rebuild (the preset shoe had 1 card left)
    expect(game.snapshot.value.remaining).toBe(104 - 4)
  })

  it('rebuilds the engine when counting toggles between rounds', () => {
    const { settings, game } = makeStores([c('T'), c('6'), c('8'), c('T'), c('8')])
    expect(game.snapshot.value.count).toBeNull()
    game.startRound(BET)
    game.playerDecide('stand')
    game.stopPlaying()
    settings.updatePractice({ counting: true })
    game.startRound(BET)
    expect(game.snapshot.value.remaining).toBe(312 - 4)
    expect(game.snapshot.value.count).not.toBeNull()
  })
})

describe('game store counting overlay', () => {
  it('hides the count until revealed or pinned on', () => {
    const { settings, game } = makeStores([c('T'), c('T'), c('6'), c('5')], { counting: true })
    expect(game.countVisible.value).toBe(false)
    game.countRevealed.value = true
    expect(game.countVisible.value).toBe(true)
    settings.updatePractice({ alwaysShowCount: true })
    game.countRevealed.value = false
    expect(game.countVisible.value).toBe(true)
  })

  it('shows nothing when counting is off', () => {
    const { game } = makeStores([])
    expect(game.snapshot.value.count).toBeNull()
    expect(game.countVisible.value).toBe(false)
  })
})

describe('game store auto-deal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function fastStores(order: Card[], defaults: { autoDeal?: 'fast' | 'off' } = {}) {
    const settings = createSettingsStore(null)
    settings.updatePractice({ autoDeal: defaults.autoDeal ?? 'fast', feedbackMode: 'silent', defaultBet: 25 })
    const stats = createStatsStore(null)
    const game = createGameStore(settings, stats, factoryFor(settings.state.rules, order, false))
    return { settings, stats, game }
  }

  it('starts the next round automatically at the last bet after the configured delay', () => {
    const { stats, game } = fastStores([c('T'), c('6'), c('8'), c('T'), c('8')])
    game.startRound(BET)
    game.playerDecide('stand')
    expect(game.snapshot.value.phase).toBe('settled')
    expect(stats.stats.value.hands).toBe(0)
    vi.advanceTimersByTime(600)
    expect(stats.stats.value.hands).toBe(1)
    expect(game.snapshot.value.phase).toBe('player')
    // 1000 - 10 bet + 20 win, then the auto deal repeats the last bet (10), not the default (25)
    expect(game.snapshot.value.bankroll).toBe(START_BANKROLL)
  })

  it('deals the next round automatically when a player natural settles at deal', () => {
    // first 4 cards settle round 1 at deal (A+K natural); the rest deal round 2
    const { stats, game } = fastStores([c('A'), c('5'), c('K'), c('T'), c('T'), c('6'), c('8'), c('T')])
    game.startRound(BET)
    // the natural settles during deal(); no player decision ever happens
    expect(game.snapshot.value.phase).toBe('settled')
    expect(stats.stats.value.hands).toBe(0)
    expect(game.snapshot.value.bankroll).toBe(START_BANKROLL - BET + 25)
    vi.advanceTimersByTime(600)
    expect(stats.stats.value.hands).toBe(1)
    expect(game.snapshot.value.phase).toBe('player')
    expect(game.snapshot.value.roundNumber).toBe(2)
    expect(game.snapshot.value.bankroll).toBe(START_BANKROLL - BET + 25 - BET)
  })

  it('is stopped by the stop button, which returns to betting, and is then inert', () => {
    const { game } = fastStores([c('T'), c('6'), c('8'), c('T'), c('8')])
    game.startRound(BET)
    game.playerDecide('stand')
    game.stopPlaying()
    expect(game.snapshot.value.phase).toBe('betting')
    expect(game.pendingBet.value).toBe(BET)
    game.nextHand()
    vi.advanceTimersByTime(2500)
    expect(game.snapshot.value.phase).toBe('betting')
    expect(game.pendingBet.value).toBe(BET)
  })

  it('deals the next hand manually at the last bet', () => {
    const { stats, game } = fastStores([c('T'), c('6'), c('8'), c('T'), c('8')])
    game.startRound(BET)
    game.playerDecide('stand')
    game.nextHand()
    expect(game.snapshot.value.phase).toBe('player')
    expect(game.snapshot.value.roundNumber).toBe(2)
    expect(stats.stats.value.hands).toBe(1)
    expect(game.snapshot.value.bankroll).toBe(START_BANKROLL)
  })

  it('leaves the round pending when the last bet is not affordable', () => {
    const { stats, game } = fastStores([c('T'), c('T'), c('6'), c('T')])
    game.startRound(1000)
    game.playerDecide('stand')
    expect(game.snapshot.value.phase).toBe('settled')
    vi.advanceTimersByTime(600)
    expect(game.snapshot.value.phase).toBe('settled')
    expect(stats.stats.value.hands).toBe(1)
  })

  it('falls back to the betting screen when the last bet is unaffordable', () => {
    const { game } = fastStores([c('T'), c('T'), c('6'), c('T')])
    game.startRound(1000)
    game.playerDecide('stand')
    game.nextHand()
    const sn = game.snapshot.value
    expect(sn.phase).toBe('betting')
    expect(sn.bankroll).toBe(0)
    expect(game.needsTopUp.value).toBe(true)
    expect(game.pendingBet.value).toBe(1000)
  })

  it('does not schedule anything when auto-deal is off', () => {
    const { game } = fastStores([c('T'), c('6'), c('8'), c('T'), c('8')], { autoDeal: 'off' })
    game.startRound(BET)
    game.playerDecide('stand')
    vi.advanceTimersByTime(5000)
    expect(game.snapshot.value.phase).toBe('settled')
  })
})

describe('game store guide mode and skip toggles', () => {
  it('guide mode highlights the correct play and counts mistakes silently', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ feedbackMode: 'guide' })
    const stats = createStatsStore(null)
    const game = createGameStore(settings, stats, factoryFor(settings.state.rules, [c('T'), c('T'), c('6'), c('5'), c('2'), c('2')]))
    game.startRound(BET)
    expect(game.snapshot.value.phase).toBe('player')
    expect(game.availableActions.value).toContain('surrender')
    expect(game.guide.value).toBe('surrender')
    game.playerDecide('hit')
    // graded silently: no popup, no block, hand continues (16 hits to 18)
    expect(game.notice.value).toBeNull()
    expect(stats.stats.value.mistakes).toBe(1)
    expect(game.guide.value).toBe('stand')
    game.playerDecide('stand')
    expect(game.notice.value).toBeNull()
    expect(stats.stats.value.mistakes).toBe(1)
  })

  it('hides the highlight outside decision prompts', () => {
    const { game } = makeStores([])
    expect(game.guide.value).toBeNull()
  })

  it('highlights the counting-based insurance advice', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ feedbackMode: 'guide', counting: true })
    const stats = createStatsStore(null)
    // round 1: 13 v 5 stands; the dealt lows (5,5) plus neutral 8/7 tags put
    // the running count +2. round 2 (no hole yet on A up): 2, A, 2 → running
    // +3 with 2 cards left → decks-remaining floor 0.5 → true count 6 → take
    const game = createGameStore(settings, stats, factoryFor(settings.state.rules, [c('5'), c('5'), c('8'), c('7'), c('8'), c('2'), c('A'), c('2'), c('T')], true))
    game.startRound(BET)
    game.playerDecide('stand') // hard 13 v 5: the correct play
    game.nextHand() // deals round 2: A up → insurance prompt
    expect(game.snapshot.value.phase).toBe('insurance')
    expect(game.guide.value).toBe('take')
    game.resolveInsurance(true)
    expect(stats.stats.value.mistakes).toBe(0)
  })

  it('shows the decline highlight when counting is off', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ feedbackMode: 'guide' })
    const stats = createStatsStore(null)
    const game = createGameStore(settings, stats, factoryFor(settings.state.rules, [c('5'), c('A'), c('T'), c('8')]))
    game.startRound(BET)
    expect(game.snapshot.value.phase).toBe('insurance')
    expect(game.guide.value).toBe('decline')
    game.resolveInsurance(false)
    expect(stats.stats.value.mistakes).toBe(0)
  })

  it('removes surrender and grades against the fallback when skipping surrender', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ skipSurrender: true })
    const stats = createStatsStore(null)
    const game = createGameStore(settings, stats, factoryFor(settings.state.rules, [c('T'), c('T'), c('6'), c('5'), c('2'), c('2')]))
    game.startRound(BET)
    expect(game.availableActions.value).not.toContain('surrender')
    expect(game.availableActions.value).toContain('hit')
    expect(game.availableActions.value).toContain('stand')
    expect(game.guide.value).toBe('hit')
    game.playerDecide('hit')
    // burning a card is the correct fallback (16 v T: hit without surrender)
    expect(stats.stats.value.mistakes).toBe(0)
    game.playerDecide('stand')
  })

  it('auto-declines and does not grade skipped insurance', () => {
    const settings = createSettingsStore(null)
    settings.updatePractice({ skipInsurance: true })
    const stats = createStatsStore(null)
    const game = createGameStore(settings, stats, factoryFor(settings.state.rules, [c('K'), c('A'), c('Q'), c('6')]))
    game.startRound(BET)
    // the prompt is never shown; play continues immediately
    expect(game.snapshot.value.phase).toBe('player')
    expect(game.snapshot.value.insuranceTaken).toBe(false)
    expect(stats.stats.value.decisions).toBe(0)
    game.playerDecide('stand')
    expect(game.snapshot.value.phase).toBe('settled')
    expect(game.snapshot.value.hands[0]?.result).toBe('win')
  })

  it('keeps the insurance prompt when the skip toggle is off', () => {
    const { game } = makeStores([c('K'), c('A'), c('Q'), c('6')])
    game.startRound(BET)
    expect(game.snapshot.value.phase).toBe('insurance')
  })
})
