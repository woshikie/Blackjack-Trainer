import { computed, ref } from 'vue'
import type { Card, Rank } from '../domain/cards'
import { Counter, HI_LO } from '../domain/counting'
import type { Action, DecisionContext } from '../domain/strategy/correctPlay'
import { correctPlay, insuranceAdvice } from '../domain/strategy/correctPlay'
import type { InsuranceAdvice } from '../domain/strategy/correctPlay'
import type { SettingsStore, TurnStyle } from './settings'

/** Where the next tapped card belongs: the player's hand or the bank's upcard. */
export type EntrySlot = 'mine' | 'up'

export interface LiveEntry {
  where: EntrySlot
  rank: Rank
}

/** The basic-strategy suggestion for the entered hand. */
export interface LiveAdvice {
  action: Action
}

function cardOf(rank: Rank): Card {
  return { rank, suit: 'S' }
}

/**
 * Table-side suggestion engine for the Live Companion.
 *
 * Cards are entered rank-only, in the table's deal rhythm (turn style). The
 * suggestion never grades — it just reads the basic-strategy chart over the
 * shared table rules. Everything entered since the last shoe reset feeds the
 * card-count base for insurance/even-money advice.
 */
export function createLiveStore(settings: SettingsStore) {
  /** Cards entered this round, in tap order — undo pops from here. */
  const entries = ref<LiveEntry[]>([])
  /** Every rank entered since the last shoe reset; the count base. */
  const seen = ref<Rank[]>([])

  const player = computed<Rank[]>(() =>
    entries.value.filter((entry) => entry.where === 'mine').map((entry) => entry.rank),
  )
  const dealer = computed<Rank | null>(() => entries.value.find((entry) => entry.where === 'up')?.rank ?? null)

  const turnStyle = computed<TurnStyle>(() => settings.state.live.turnStyle)

  /** The slot the entry pad must fill next, given the turn style. */
  const nextNeeded = computed<EntrySlot | 'none'>(() => {
    const mine = player.value.length
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

  /** Once the first two cards are up, further taps are follow-up player cards. */
  const target = computed<EntrySlot>(() => (nextNeeded.value === 'none' ? 'mine' : nextNeeded.value))

  function pick(rank: Rank): void {
    entries.value.push({ where: target.value, rank })
    seen.value.push(rank)
  }

  /** Pops the newest entry and its count-log twin in parallel. */
  function undo(): void {
    const last = entries.value.pop()
    if (last === undefined) return
    seen.value.pop()
  }

  /** Clears the hand but keeps the count log across rounds. */
  function newRound(): void {
    entries.value = []
  }

  function newShoe(): void {
    entries.value = []
    seen.value = []
  }

  /** True count over everything entered, against the shoe's remaining depth. */
  function liveTrueCount(): number {
    const counter = new Counter(HI_LO)
    for (const rank of seen.value) counter.observe(cardOf(rank))
    const remaining = settings.state.rules.decks * 52 - seen.value.length
    return counter.trueCount(remaining)
  }

  /** Insurance / even money — shown whenever the bank shows an ace. */
  const insurance = computed<InsuranceAdvice | null>(() => {
    if (dealer.value !== 'A') return null
    return insuranceAdvice(settings.state.practice.counting, liveTrueCount())
  })

  const advice = computed<LiveAdvice | null>(() => {
    if (player.value.length < 2 || dealer.value === null) return null
    const context: DecisionContext = {
      cards: player.value.map(cardOf),
      dealerUp: cardOf(dealer.value),
      // A fresh table hand: no split state, funds assumed available.
      postSplit: false,
      splitAces: false,
      numHands: 1,
      fundsForDouble: true,
    }
    return { action: correctPlay(context, settings.state.rules) }
  })

  return { entries, player, dealer, seen, turnStyle, nextNeeded, target, pick, undo, newRound, newShoe, advice, insurance }
}

export type LiveStore = ReturnType<typeof createLiveStore>
