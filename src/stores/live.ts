import { computed, ref } from 'vue'
import type { Card, Rank } from '../domain/cards'
import { Counter, HI_LO } from '../domain/counting'
import { handValue } from '../domain/hand'
import type { Action, DecisionContext } from '../domain/strategy/correctPlay'
import { correctPlay, insuranceAdvice } from '../domain/strategy/correctPlay'
import type { InsuranceAdvice } from '../domain/strategy/correctPlay'
import type { SettingsStore, TurnStyle } from './settings'

/** Where the next tapped card belongs: the active hand or the bank's upcard. */
export type EntrySlot = 'mine' | 'up'

/** What the round is telling the player right now. */
export type HandState = 'entry' | 'playing' | 'bust' | 'twentyone' | 'acesDone' | 'roundDone'

/** The basic-strategy suggestion for the active hand. */
export interface LiveAdvice {
  action: Action
}

/** Live Hi-Lo figures for the count row. */
export interface LiveCount {
  running: number
  trueCount: number
  remainingDecks: number
}

function cardOf(rank: Rank): Card {
  return { rank, suit: 'S' }
}

/**
 * Table-side suggestion engine for the Live Companion.
 *
 * Cards are entered rank-only, in the table's deal rhythm (turn style). Splits
 * spawn sub-hands up to the table's max; advice is read per active hand over
 * the shared table rules. Everything entered since the last shoe reset feeds
 * the card-count base for the count row and insurance/even-money advice.
 */
export function createLiveStore(settings: SettingsStore) {
  /** Split hands in table order; taps land on the active one. */
  const hands = ref<Rank[][]>([[]])
  const activeHand = ref(0)
  /** All hands have acted — the bank plays out; the log persists until a reset. */
  const roundDone = ref(false)
  /** The bank's upcard. */
  const dealer = ref<Rank | null>(null)
  /** Every rank entered since the last shoe reset; the count base. */
  const seen = ref<Rank[]>([])

  const turnStyle = computed<TurnStyle>(() => settings.state.live.turnStyle)

  // Invariant: readers guard on roundDone first, and the active index never
  // leaves the hands array (advancing the last hand sets roundDone instead).
  const activeCards = computed<Rank[]>(() => hands.value[activeHand.value]!)

  /** Cards a hand owns by birth: a fresh hand owns nothing, split hands keep their split card. */
  function baseOf(hand: number): number {
    return hand === 0 && hands.value.length === 1 ? 0 : 1
  }

  /** The slot the entry pad must fill next, given the turn style. */
  const nextNeeded = computed<EntrySlot | 'none'>(() => {
    if (roundDone.value) return 'none'
    const mine = activeCards.value.length
    if (turnStyle.value === 'p-p-b') {
      if (mine < 2) return 'mine'
      return dealer.value === null ? 'up' : 'none'
    }
    // Round-robin as dealt: player, bank, player, then follow-up cards.
    if (mine === 0) return 'mine'
    if (dealer.value === null) return 'up'
    if (mine < 2) return 'mine'
    return 'none'
  })

  /** Once the hand's first cards are up, further taps are follow-up cards. */
  const target = computed<EntrySlot>(() => (nextNeeded.value === 'none' ? 'mine' : nextNeeded.value))

  /** Decision-free totals finish the hand on their own; everything else waits on the player. */
  function assessActive(): 'playing' | 'bust' | 'twentyone' | 'acesDone' {
    const cards = activeCards.value
    const total = handValue(cards.map(cardOf)).total
    if (total > 21) return 'bust'
    if (total === 21) return 'twentyone'
    const splitAces = hands.value.length > 1 && cards[0] === 'A'
    if (splitAces && settings.state.rules.splitAcesOneCard) return 'acesDone'
    return 'playing'
  }

  function advance(): void {
    if (activeHand.value < hands.value.length - 1) activeHand.value++
    else roundDone.value = true
  }

  function pick(rank: Rank): void {
    if (roundDone.value) return
    if (target.value === 'up') dealer.value = rank
    else activeCards.value.push(rank)
    seen.value.push(rank)
    if (assessActive() !== 'playing') advance()
  }

  /** Splits the active pair hand; only offered when the chart says split. */
  function splitHand(): void {
    const cards = activeCards.value
    hands.value.splice(activeHand.value, 1, [cards[0]!], [cards[1]!])
  }

  /**
   * Steps back one tap: the newest removable card, a hand rewind when the
   * active hand is down to its base, or the bank's upcard on a fresh hand.
   * Split base cards are load-bearing — undo never removes them.
   */
  function undo(): void {
    if (roundDone.value) {
      roundDone.value = false
      return
    }
    if (activeCards.value.length > baseOf(activeHand.value)) {
      activeCards.value.pop()
      seen.value.pop()
      return
    }
    if (activeHand.value > 0) {
      activeHand.value--
      return
    }
    if (activeCards.value.length === 0 && dealer.value !== null) {
      dealer.value = null
      seen.value.pop()
    }
  }

  /** Whether undo has anything to step back to. */
  const canUndo = computed(() => {
    if (roundDone.value) return true
    for (let hand = activeHand.value; hand >= 0; hand--) {
      if (hands.value[hand]!.length > baseOf(hand)) return true
      if (hand === 0 && hands.value[hand]!.length === 0 && dealer.value !== null) return true
    }
    return false
  })

  /** Clears the hand(s) but keeps the count log across rounds. */
  function newRound(): void {
    hands.value = [[]]
    activeHand.value = 0
    roundDone.value = false
    dealer.value = null
  }

  function newShoe(): void {
    newRound()
    seen.value = []
  }

  /** Live Hi-Lo figures over the count base (null while counting is off). */
  const count = computed<LiveCount | null>(() => {
    if (!settings.state.practice.counting) return null
    const counter = new Counter(HI_LO)
    for (const rank of seen.value) counter.observe(cardOf(rank))
    const remaining = settings.state.rules.decks * 52 - seen.value.length
    return { running: counter.running, trueCount: counter.trueCount(remaining), remainingDecks: remaining / 52 }
  })

  /** Insurance / even money — shown whenever the bank shows an ace. */
  const insurance = computed<InsuranceAdvice | null>(() => {
    if (dealer.value !== 'A') return null
    return insuranceAdvice(settings.state.practice.counting, count.value?.trueCount ?? 0)
  })

  /** What the round is telling the player right now. */
  const handState = computed<HandState>(() => {
    if (roundDone.value) return 'roundDone'
    if (activeCards.value.length < 2 || dealer.value === null) return 'entry'
    return assessActive()
  })

  /** The chart's play for the active hand (null unless a decision exists). */
  const advice = computed<LiveAdvice | null>(() => {
    if (handState.value !== 'playing') return null
    const cards = activeCards.value
    const postSplit = hands.value.length > 1
    const context: DecisionContext = {
      cards: cards.map(cardOf),
      dealerUp: cardOf(dealer.value!),
      postSplit,
      splitAces: postSplit && cards[0] === 'A',
      numHands: hands.value.length,
      // Stakes are the player's call at the table; the chart assumes available.
      fundsForDouble: true,
    }
    return { action: correctPlay(context, settings.state.rules) }
  })

  return {
    hands,
    activeHand,
    roundDone,
    dealer,
    seen,
    activeCards,
    turnStyle,
    nextNeeded,
    target,
    handState,
    advice,
    insurance,
    count,
    canUndo,
    pick,
    undo,
    splitHand,
    advance,
    newRound,
    newShoe,
  }
}

export type LiveStore = ReturnType<typeof createLiveStore>
