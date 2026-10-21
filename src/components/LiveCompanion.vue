<script setup lang="ts">
import { computed } from 'vue'
import type { Card, Rank } from '../domain/cards'
import { handValue, isNatural } from '../domain/hand'
import { ACTION_LABELS } from '../stores/game'
import type { LiveStore } from '../stores/live'
import type { SettingsStore } from '../stores/settings'

const props = defineProps<{ live: LiveStore; settings: SettingsStore }>()

// Destructured so the template sees plain refs (auto-unwrapped).
const {
  hands,
  activeHand,
  roundDone,
  dealer,
  seen,
  activeCards,
  turnStyle,
  nextNeeded,
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
} = props.live

const RANK_PAD: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A']

function padLabel(rank: Rank): string {
  return rank === 'T' ? '10' : rank
}

function cardOf(rank: Rank): Card {
  return { rank, suit: 'S' }
}

const pristine = computed(() => hands.value.length === 1 && hands.value[0]!.length === 0 && dealer.value === null)

const slotHint = computed(() => {
  if (nextNeeded.value === 'up') return 'Bank upcard'
  if (nextNeeded.value === 'mine') return `Your card ${activeCards.value.length + 1}`
  return 'Add cards as you act'
})

const handTotal = computed(() => {
  if (activeCards.value.length === 0) return ''
  const value = handValue(activeCards.value.map(cardOf))
  // Two-card 21 is only a natural (and only worth the name) before any split.
  if (activeCards.value.length === 2 && value.total === 21 && hands.value.length === 1) return 'Blackjack'
  return value.soft ? `${value.total - 10} or ${value.total}` : String(value.total)
})

const suggestionText = computed(() => {
  if (advice.value) return ACTION_LABELS[advice.value.action]
  if (handState.value === 'roundDone') return 'Round over — dealer plays'
  if (handState.value === 'bust') return 'Bust'
  if (handState.value === 'twentyone') return 'Twenty-one'
  if (handState.value === 'acesDone') return 'One card on split aces'
  return pristine.value ? 'Enter the first cards' : slotHint.value
})

const insuranceLabel = computed(() => {
  if (insurance.value === null) return ''
  // Even money only exists for a natural on an unsplit hand.
  const natural = hands.value.length === 1 && isNatural(activeCards.value.map(cardOf))
  const wording = natural ? 'even money' : 'insurance'
  const suffix = props.settings.state.practice.counting ? '' : ' (count off)'
  return `${insurance.value.label.replace('insurance', wording)}${suffix}`
})

const countRow = computed(() => {
  if (count.value === null) return ''
  return `RC ${count.value.running} · TC ${count.value.trueCount.toFixed(1)} · ${count.value.remainingDecks.toFixed(1)} decks left`
})
</script>

<template>
  <section class="live-companion">
    <div class="turn-style" role="group" aria-label="Turn style">
      <button
        class="style"
        :class="{ on: turnStyle === 'p-b-p' }"
        @click="settings.updateLive({ turnStyle: 'p-b-p' })"
      >P→B→P <span class="muted">(as dealt)</span></button>
      <button
        class="style"
        :class="{ on: turnStyle === 'p-p-b' }"
        @click="settings.updateLive({ turnStyle: 'p-p-b' })"
      >P→P→B <span class="muted">(cards first)</span></button>
    </div>

    <div class="table-cards">
      <span
        v-for="(rank, index) in activeCards"
        :key="index"
        class="chip"
      >{{ padLabel(rank) }}</span>
      <span v-if="dealer !== null" class="chip up" title="Bank upcard">{{ padLabel(dealer) }}</span>
      <span v-if="pristine" class="muted">Tap the cards as they land.</span>
    </div>

    <div v-if="hands.length > 1" class="hand-strip">
      <div
        v-for="(cards, index) in hands"
        :key="index"
        class="hand"
        :class="{ active: index === activeHand && !roundDone }"
      >
        <span class="hand-label muted">H{{ index + 1 }}</span>
        <span v-for="(rank, cardIndex) in cards" :key="cardIndex" class="chip mini">{{ padLabel(rank) }}</span>
        <span v-if="index === activeHand && cards.length < 2" class="chip mini ghost">?</span>
      </div>
    </div>

    <div class="live-status">
      <div v-if="dealer !== null" class="up-row">
        <span class="muted">Bank shows</span>
        <strong>{{ padLabel(dealer) }}</strong>
      </div>
      <div v-if="handTotal" class="up-row">
        <span class="muted">{{ hands.length > 1 ? `Hand ${activeHand + 1}` : 'Your hand' }}</span>
        <strong>{{ handTotal }}</strong>
      </div>
      <div class="up-row">
        <span class="muted">Next</span>
        <strong>{{ slotHint }}</strong>
      </div>
    </div>

    <div class="suggestion" :class="advice?.action ?? 'waiting'">
      {{ suggestionText }}
    </div>

    <p v-if="insurance" class="insurance-row" :class="insurance.take ? 'ok' : 'decline'">
      {{ insuranceLabel }}
    </p>

    <p v-if="count" class="live-count">{{ countRow }}</p>

    <button v-if="advice?.action === 'split'" class="split-now" @click="splitHand">
      Split the hand
    </button>

    <div class="rank-pad">
      <button v-for="rank in RANK_PAD" :key="rank" class="rank" :disabled="roundDone" @click="pick(rank)">
        {{ padLabel(rank) }}
      </button>
    </div>
    <p class="pad-note muted">T covers J, Q, K — suits never matter.</p>

    <div class="live-controls">
      <button class="control" :disabled="!canUndo" @click="undo">Undo</button>
      <button v-if="hands.length > 1 && !roundDone" class="control" @click="advance">Next hand</button>
      <button
        class="control"
        :disabled="pristine && !roundDone"
        @click="newRound"
      >New round</button>
      <button class="control" :disabled="seen.length === 0" @click="newShoe">New shoe</button>
    </div>
  </section>
</template>
