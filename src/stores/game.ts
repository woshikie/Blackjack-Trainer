import { computed, ref } from 'vue'
import { HI_LO } from '../domain/counting'
import type { CountSystem } from '../domain/counting'
import { Game, START_BANKROLL } from '../domain/engine/game'
import type { GameSnapshot } from '../domain/engine/game'
import { decisionSpot } from '../domain/stats'
import type { Action, DecisionContext } from '../domain/strategy/correctPlay'
import { correctPlay, insuranceAdvice } from '../domain/strategy/correctPlay'
import type { Rules } from '../domain/rules'
import type { AutoDeal, SettingsStore } from './settings'
import type { StatsStore } from './stats'

export type Notice = { kind: 'mistake' | 'info'; text: string } | null

export const ACTION_LABELS: Record<Action, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
}

export const AUTO_DEAL_DELAY: Record<Exclude<AutoDeal, 'off'>, number> = {
  slow: 2500,
  normal: 1400,
  fast: 600,
}

function countSystemFor(settings: SettingsStore): CountSystem | undefined {
  return settings.state.practice.counting && !settings.state.rules.csm ? HI_LO : undefined
}

function sameRules(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function createGameStore(settings: SettingsStore, stats: StatsStore, engineFactory?: () => Game) {
  const makeEngine = engineFactory ?? (() => new Game(settings.state.rules, Math.random, countSystemFor(settings)))
  let engine = makeEngine()
  const snapshot = ref<GameSnapshot>(engine.snapshot())
  const notice = ref<Notice>(null)
  const pendingBet = ref(0)
  // The bet to repeat: seeded from the settings' default bet, then follows the player.
  const lastBet = ref(settings.state.practice.defaultBet)
  const countRevealed = ref(false)
  let autoTimer: ReturnType<typeof setTimeout> | null = null

  function refresh(): void {
    snapshot.value = engine.snapshot()
  }

  function cancelAuto(): void {
    if (autoTimer !== null) {
      clearTimeout(autoTimer)
      autoTimer = null
    }
  }

  function syncEngine(): void {
    const system = countSystemFor(settings)
    const rulesChanged = !sameRules(engine.currentRules, settings.state.rules)
    const countingChanged = engine.countingId !== (system?.id ?? null)
    if (rulesChanged || countingChanged) {
      engine.setRules(settings.state.rules, Math.random, system)
    }
  }

  function betLegal(bet: number): boolean {
    const { minBet, maxBet } = settings.state.rules
    return (
      bet >= minBet && (maxBet === 0 || bet <= maxBet) && bet <= snapshot.value.bankroll
    )
  }

  function startRound(bet: number): void {
    cancelAuto()
    syncEngine()
    engine.placeBet(bet)
    engine.deal()
    lastBet.value = bet
    notice.value = null
    // afterChange (not just refresh): a natural or dealer blackjack settles
    // during deal(), and that outcome must still schedule the auto-deal.
    afterChange()
  }

  function grade(correct: boolean, spot: string, correctLabel: string): void {
    stats.recordDecision(spot, correct)
    if (correct) {
      notice.value = null
      return
    }
    const mode = settings.state.practice.feedbackMode
    // silent counts quietly; guide already surfaces the correct play via highlights
    if (mode !== 'silent' && mode !== 'guide') {
      notice.value = { kind: 'mistake', text: `Correct play: ${correctLabel}` }
    }
  }

  function blockedStrict(correct: boolean): boolean {
    return settings.state.practice.feedbackMode === 'strict' && !correct
  }

  /** Practice rules: the skip-surrender option removes surrender from grading too. */
  function practiceRules(): Rules {
    const rules = settings.state.rules
    return settings.state.practice.skipSurrender ? { ...rules, lateSurrender: false } : rules
  }

  /** Decision context of the hand the player currently acts on. */
  function activeContext(): DecisionContext {
    const hand = engine.hands[engine.activeIndex]!
    const up = engine.dealerCards[0]!
    return {
      cards: hand.cards,
      dealerUp: up,
      postSplit: hand.fromSplit,
      splitAces: hand.splitAces,
      numHands: engine.hands.length,
      fundsForDouble: engine.bankroll >= hand.bet,
    }
  }

  type Guide = Action | 'take' | 'decline'
  const guide = computed<Guide | null>(() => {
    if (snapshot.value.phase === 'insurance') {
      const trueCount = snapshot.value.count?.trueCount ?? 0
      return insuranceAdvice(settings.state.practice.counting, trueCount).take ? 'take' : 'decline'
    }
    if (snapshot.value.phase !== 'player') return null
    return correctPlay(activeContext(), practiceRules())
  })

  function playerDecide(action: Action): void {
    cancelAuto()
    if (snapshot.value.phase !== 'player') return
    const correct = correctPlay(activeContext(), practiceRules())
    const isCorrect = action === correct
    grade(isCorrect, decisionSpot(engine.hands[engine.activeIndex]!.cards, engine.dealerCards[0]!), ACTION_LABELS[correct])
    if (blockedStrict(isCorrect)) {
      refresh()
      return
    }
    engine.decide(action)
    afterChange()
  }

  function resolveInsurance(take: boolean): void {
    cancelAuto()
    const trueCount = snapshot.value.count?.trueCount ?? 0
    const advice = insuranceAdvice(settings.state.practice.counting, trueCount)
    grade(take === advice.take, 'insurance v A', advice.label)
    if (blockedStrict(take === advice.take)) {
      refresh()
      return
    }
    engine.resolveInsurance(take)
    afterChange()
  }

  function afterChange(): void {
    refresh()
    // the "skip insurance" practice option auto-declines without grading
    if (snapshot.value.phase === 'insurance' && settings.state.practice.skipInsurance) {
      engine.resolveInsurance(false)
      refresh()
    }
    maybeAutoDeal()
  }

  function maybeAutoDeal(): void {
    const mode = settings.state.practice.autoDeal
    if (mode === 'off' || snapshot.value.phase !== 'settled') return
    autoTimer = setTimeout(() => {
      autoTimer = null
      autoAdvance()
    }, AUTO_DEAL_DELAY[mode])
  }

  function autoAdvance(): void {
    // every transition out of the settled phase cancels the timer first,
    // so the callback only ever fires on a settled round
    stats.recordHand()
    if (betLegal(lastBet.value)) {
      engine.nextRound()
      startRound(lastBet.value)
    }
  }

  function toBetting(): void {
    pendingBet.value = lastBet.value
    engine.nextRound()
    notice.value = null
    refresh()
  }

  /** Leave the settled round and deal the next one at the last bet. */
  function nextHand(): void {
    cancelAuto()
    if (snapshot.value.phase !== 'settled') return
    stats.recordHand()
    if (betLegal(lastBet.value)) {
      engine.nextRound()
      startRound(lastBet.value)
    } else {
      // cannot afford the repeat: fall back to the betting screen
      toBetting()
    }
  }

  /** Cancel the pending auto-deal and return to the betting screen. */
  function stopPlaying(): void {
    cancelAuto()
    if (snapshot.value.phase !== 'settled') return
    stats.recordHand()
    toBetting()
  }

  function addChip(value: number): void {
    pendingBet.value += value
  }

  function clearBet(): void {
    pendingBet.value = 0
  }

  function rebet(): void {
    pendingBet.value = lastBet.value
  }

  function topUp(): void {
    engine.topUp()
    refresh()
  }

  function resetSession(): void {
    cancelAuto()
    engine = makeEngine()
    pendingBet.value = 0
    lastBet.value = settings.state.practice.defaultBet
    notice.value = null
    refresh()
  }

  const availableActions = computed<Action[]>(() => {
    if (snapshot.value.phase !== 'player') return []
    const all = engine.availableActions()
    return settings.state.practice.skipSurrender ? all.filter((action) => action !== 'surrender') : all
  })

  const activeHand = computed(() => {
    const state = snapshot.value
    // a live hand always exists in the player phase
    return state.phase === 'player' ? state.hands[state.activeIndex]! : null
  })

  const countVisible = computed(
    () =>
      snapshot.value.count !== null &&
      (settings.state.practice.alwaysShowCount || countRevealed.value),
  )

  const needsTopUp = computed(
    () => snapshot.value.phase === 'betting' && snapshot.value.bankroll < settings.state.rules.minBet,
  )

  return {
    snapshot,
    notice,
    pendingBet,
    lastBet,
    countRevealed,
    availableActions,
    guide,
    activeHand,
    countVisible,
    needsTopUp,
    betLegal,
    startRound,
    playerDecide,
    resolveInsurance,
    nextHand,
    stopPlaying,
    addChip,
    clearBet,
    rebet,
    topUp,
    resetSession,
  }
}

export type GameStore = ReturnType<typeof createGameStore>

export { START_BANKROLL }
