<script setup lang="ts">
import type { PlayerHand } from '../domain/engine/game'
import type { GameStore } from '../stores/game'
import type { SettingsStore } from '../stores/settings'
import CardView from './CardView.vue'

const props = defineProps<{ game: GameStore; settings: SettingsStore }>()
const game = props.game
const settings = props.settings
const snapshot = game.snapshot

const RESULT_LABEL: Record<string, string> = {
  blackjack: 'Blackjack',
  win: 'Win',
  push: 'Push',
  lose: 'Lose',
  bust: 'Bust',
  surrender: 'Surrender',
}

/** Soft-aware total: "3 or 13" for usable aces, "Blackjack" for a natural. */
function totalLabel(cards: readonly { rank: string; suit: string }[]): string {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += card.rank === 'A' ? 11 : ['T', 'J', 'Q', 'K'].includes(card.rank) ? 10 : Number(card.rank)
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  if (cards.length === 2 && total === 21) return 'Blackjack'
  if (aces > 0) return `${total - 10} or ${total}`
  return String(total)
}

/** Result badge: label plus the net money for a resolved hand. */
function badgeText(hand: PlayerHand): string {
  const label = hand.result === null ? '' : RESULT_LABEL[hand.result]
  let net: number
  switch (hand.result) {
    case 'blackjack':
      net = Math.round(hand.bet * settings.state.rules.blackjackPays * 100) / 100
      break
    case 'win':
      net = hand.bet
      break
    case 'push':
      net = 0
      break
    case 'surrender':
      net = -hand.bet / 2
      break
    case null:
      return ''
    default:
      net = -hand.bet
  }
  return label + amountLabel(net)
}

function amountLabel(net: number): string {
  const money = Number.isInteger(net) ? `$${Math.abs(net)}` : `$${Math.abs(net).toFixed(2)}`
  return net > 0 ? ` +${money}` : net < 0 ? ` −${money}` : ''
}
</script>

<template>
  <div class="felt">
    <div class="dealer-area">
      <div class="area-label">Dealer{{ snapshot.dealerHoleExposed ? ` · ${totalLabel(snapshot.dealerCards)}` : '' }}</div>
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
          <span class="hand-total">{{ totalLabel(hand.cards) }}</span>
          <span class="hand-bet">${{ hand.bet }}{{ hand.doubled ? ' ×2' : '' }}</span>
          <span v-if="hand.result" class="result-badge" :data-result="hand.result">{{ badgeText(hand) }}</span>
        </div>
      </div>
    </div>

    <div class="shoe-info">
      Shoe: {{ snapshot.remaining }} cards · Round {{ snapshot.roundNumber }}
    </div>
  </div>
</template>
