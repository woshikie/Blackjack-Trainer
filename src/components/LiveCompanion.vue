<script setup lang="ts">
import { computed } from 'vue'
import type { Card, Rank } from '../domain/cards'
import { handValue, isNatural } from '../domain/hand'
import { ACTION_LABELS } from '../stores/game'
import type { LiveStore } from '../stores/live'
import type { SettingsStore } from '../stores/settings'

const props = defineProps<{ live: LiveStore; settings: SettingsStore }>()

// Destructured so the template sees plain refs (auto-unwrapped).
const { entries, player, dealer, seen, turnStyle, nextNeeded, advice, insurance, pick, undo, newRound, newShoe } =
  props.live

const RANK_PAD: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A']

function padLabel(rank: Rank): string {
  return rank === 'T' ? '10' : rank
}

function cardOf(rank: Rank): Card {
  return { rank, suit: 'S' }
}

const slotHint = computed(() => {
  if (nextNeeded.value === 'up') return 'Bank upcard'
  if (nextNeeded.value === 'mine') return `Your card ${player.value.length + 1}`
  return 'Add cards as you act'
})

const handTotal = computed(() => {
  if (player.value.length === 0) return ''
  const value = handValue(player.value.map(cardOf))
  if (player.value.length === 2 && value.total === 21) return 'Blackjack'
  return value.soft ? `${value.total - 10} or ${value.total}` : String(value.total)
})

const insuranceLabel = computed(() => {
  if (insurance.value === null) return ''
  const wording = isNatural(player.value.map(cardOf)) ? 'even money' : 'insurance'
  return `${insurance.value.label.replace('insurance', wording)}${
    props.settings.state.practice.counting ? '' : ' (count off)'
  }`
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
        v-for="(entry, index) in entries"
        :key="index"
        class="chip"
        :class="entry.where"
      >{{ padLabel(entry.rank) }}</span>
      <span v-if="entries.length === 0" class="muted">Tap the cards as they land.</span>
    </div>

    <div class="live-status">
      <div v-if="dealer !== null" class="up-row">
        <span class="muted">Bank shows</span>
        <strong>{{ padLabel(dealer) }}</strong>
      </div>
      <div v-if="handTotal" class="up-row">
        <span class="muted">Your hand</span>
        <strong>{{ handTotal }}</strong>
      </div>
      <div class="up-row">
        <span class="muted">Next</span>
        <strong>{{ slotHint }}</strong>
      </div>
    </div>

    <div class="suggestion" :class="advice?.action ?? 'waiting'">
      <template v-if="advice">
        {{ ACTION_LABELS[advice.action] }}
      </template>
      <template v-else>
        {{ entries.length === 0 ? 'Enter the first cards' : slotHint }}
      </template>
    </div>

    <p v-if="insurance" class="insurance-row" :class="insurance.take ? 'ok' : 'decline'">
      {{ insuranceLabel }}
    </p>

    <div class="rank-pad">
      <button v-for="rank in RANK_PAD" :key="rank" class="rank" @click="pick(rank)">
        {{ padLabel(rank) }}
      </button>
    </div>
    <p class="pad-note muted">T covers J, Q, K — suits never matter.</p>

    <div class="live-controls">
      <button class="control" :disabled="entries.length === 0" @click="undo">Undo</button>
      <button class="control" :disabled="entries.length === 0" @click="newRound">New round</button>
      <button class="control" :disabled="seen.length === 0" @click="newShoe">New shoe</button>
    </div>
  </section>
</template>
