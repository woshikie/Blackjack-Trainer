<script setup lang="ts">
import type { GameStore } from '../stores/game'
import CardView from './CardView.vue'

const props = defineProps<{ game: GameStore }>()
const snapshot = props.game.snapshot

const RESULT_LABEL: Record<string, string> = {
  blackjack: 'Blackjack',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
  bust: 'Bust',
  surrender: 'Surrender',
}

function total(cards: readonly { rank: string; suit: string }[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    const value = card.rank === 'A' ? 11 : ['T', 'J', 'Q', 'K'].includes(card.rank) ? 10 : Number(card.rank)
    total += value
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}
</script>

<template>
  <div class="felt">
    <div class="dealer-area">
      <div class="area-label">Dealer{{ snapshot.dealerHoleExposed ? ` · ${total(snapshot.dealerCards)}` : '' }}</div>
      <div class="cards">
        <CardView v-for="(card, i) in snapshot.dealerCards" :key="i" :card="card" />
      </div>
    </div>

    <div v-if="snapshot.message" class="table-message">{{ snapshot.message }}</div>

    <div class="player-area">
      <div
        v-for="(hand, index) in snapshot.hands"
        :key="hand.id"
        class="hand"
        :class="{ active: snapshot.phase === 'player' && index === snapshot.activeIndex }"
      >
        <div class="cards">
          <CardView v-for="(card, i) in hand.cards" :key="i" :card="card" />
        </div>
        <div class="hand-info">
          <span class="hand-total">{{ total(hand.cards) }}</span>
          <span class="hand-bet">${{ hand.bet }}{{ hand.doubled ? ' ×2' : '' }}</span>
          <span v-if="hand.result" class="result-badge" :data-result="hand.result">
            {{ RESULT_LABEL[hand.result] }}
          </span>
        </div>
      </div>
    </div>

    <div class="shoe-info">
      Shoe: {{ snapshot.remaining }} cards · Round {{ snapshot.roundNumber }}
    </div>
  </div>
</template>
