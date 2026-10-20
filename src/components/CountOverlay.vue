<script setup lang="ts">
import type { GameStore } from '../stores/game'

const props = defineProps<{ game: GameStore }>()
const snapshot = props.game.snapshot
const countVisible = props.game.countVisible
const countRevealed = props.game.countRevealed
</script>

<template>
  <div v-if="snapshot.count !== null" class="count-overlay">
    <template v-if="countVisible">
      <span class="count-value">RC {{ snapshot.count.running }} · TC {{ snapshot.count.trueCount.toFixed(1) }}</span>
      <button v-if="countRevealed" class="link" @click="countRevealed = false">Hide</button>
    </template>
    <button v-else class="link" @click="countRevealed = true">Reveal count</button>
  </div>
</template>
