<script setup lang="ts">
import { ref } from 'vue'
import type { StatsStore } from '../stores/stats'

const props = defineProps<{ stats: StatsStore; onClose: () => void }>()
const stats = props.stats
const confirming = ref(false)

function onReset(): void {
  if (!confirming.value) {
    confirming.value = true
    return
  }
  stats.reset()
  confirming.value = false
}
</script>

<template>
  <section class="sheet">
    <header class="sheet-header">
      <h2>Stats</h2>
      <button class="link" @click="onClose">Close</button>
    </header>

    <div class="stat-grid">
      <div class="stat"><span class="stat-value">{{ stats.stats.value.hands }}</span><span class="stat-label">hands</span></div>
      <div class="stat">
        <span class="stat-value">{{ stats.accuracy() === null ? '—' : `${Math.round(stats.accuracy()! * 100)}%` }}</span>
        <span class="stat-label">accuracy</span>
      </div>
      <div class="stat"><span class="stat-value">{{ stats.stats.value.streak }}</span><span class="stat-label">streak</span></div>
      <div class="stat"><span class="stat-value">{{ stats.stats.value.bestStreak }}</span><span class="stat-label">best streak</span></div>
    </div>

    <h3>Worst spots</h3>
    <ul class="spot-list">
      <li v-for="spot in stats.worstSpots()" :key="spot.key">
        <span>{{ spot.key }}</span>
        <span>{{ Math.round(spot.accuracy * 100) }}% over {{ spot.seen }}</span>
      </li>
      <li v-if="stats.worstSpots().length === 0" class="empty">Play a few hands to see your weak spots.</li>
    </ul>

    <footer class="sheet-footer">
      <button class="secondary" @click="onReset">{{ confirming ? 'Really reset stats?' : 'Reset stats' }}</button>
    </footer>
  </section>
</template>
