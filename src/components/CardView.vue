<script setup lang="ts">
import type { Card } from '../domain/cards'

defineProps<{ card: Card | null }>()
const SUIT_GLYPH: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const RANK_LABEL: Record<string, string> = { A: 'A', T: '10', J: 'J', Q: 'Q', K: 'K' }

function rankLabel(rank: string): string {
  return RANK_LABEL[rank] ?? rank
}

function isRed(card: Card): boolean {
  return card.suit === 'H' || card.suit === 'D'
}
</script>

<template>
  <div class="card" :class="{ red: card !== null && isRed(card), back: card === null }">
    <template v-if="card">
      <span class="corner top">{{ rankLabel(card.rank) }}<i>{{ SUIT_GLYPH[card.suit] }}</i></span>
      <span class="pip">{{ SUIT_GLYPH[card.suit] }}</span>
      <span class="corner bottom">{{ rankLabel(card.rank) }}<i>{{ SUIT_GLYPH[card.suit] }}</i></span>
    </template>
  </div>
</template>
