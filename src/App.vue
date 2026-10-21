<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Action } from './domain/strategy/correctPlay'
import ActionBar from './components/ActionBar.vue'
import CountOverlay from './components/CountOverlay.vue'
import HelpSheet from './components/HelpSheet.vue'
import LiveCompanion from './components/LiveCompanion.vue'
import SelfTestSheet from './components/SelfTestSheet.vue'
import SettingsSheet from './components/SettingsSheet.vue'
import StatsSheet from './components/StatsSheet.vue'
import TableFelt from './components/TableFelt.vue'
import { createGameStore } from './stores/game'
import { createLiveStore } from './stores/live'
import { createSettingsStore } from './stores/settings'
import { createStatsStore } from './stores/stats'

const settings = createSettingsStore()
const stats = createStatsStore()
const game = createGameStore(settings, stats)
// One live session for the app's lifetime: switching modes keeps entered cards.
const live = createLiveStore(settings)

const { snapshot, notice, needsTopUp } = game

type SheetName = 'settings' | 'stats' | 'help' | 'selftest'
const sheet = ref<SheetName | null>(null)

function toggleSheet(name: SheetName): void {
  sheet.value = sheet.value === name ? null : name
}

function closeSheet(): void {
  sheet.value = null
}

const KEY_ACTIONS: Record<string, Action> = {
  h: 'hit',
  s: 'stand',
  d: 'double',
  p: 'split',
  x: 'surrender',
}

function onKey(event: KeyboardEvent): void {
  if (sheet.value !== null) return
  const key = event.key.toLowerCase()
  const phase = snapshot.value.phase
  if (phase === 'player') {
    const action = KEY_ACTIONS[key]
    if (action && game.availableActions.value.includes(action)) {
      event.preventDefault()
      game.playerDecide(action)
    }
    return
  }
  if (phase === 'insurance') {
    if (key === 'y') {
      event.preventDefault()
      game.resolveInsurance(true)
    } else if (key === 'n') {
      event.preventDefault()
      game.resolveInsurance(false)
    }
    return
  }
  if (phase === 'betting') {
    if (key === 'r') {
      event.preventDefault()
      game.rebet()
    } else if (key === ' ' && game.betLegal(game.pendingBet.value)) {
      event.preventDefault()
      game.startRound(game.pendingBet.value)
    }
    return
  }
  if (phase === 'settled' && key === ' ') {
    event.preventDefault()
    game.nextHand()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <header class="topbar">
      <h1>Blackjack Trainer</h1>
      <div class="mode-switch" role="tablist">
        <button
          class="mode"
          :class="{ on: settings.state.mode === 'practice' }"
          @click="settings.setMode('practice')"
        >Practice</button>
        <button
          class="mode"
          :class="{ on: settings.state.mode === 'live' }"
          @click="settings.setMode('live')"
        >Live</button>
      </div>
      <div class="bank-controls" v-if="settings.state.mode === 'practice'">
        <div class="bankroll" :class="{ low: needsTopUp }">Bankroll ${{ snapshot.bankroll }}</div>
        <button class="link" @click="game.topUp()">Reset bank</button>
        <button class="link" @click="game.resetSession()">New session</button>
      </div>
      <nav>
        <button class="icon" title="Settings" @click="toggleSheet('settings')">⚙</button>
        <button class="icon" title="Stats" @click="toggleSheet('stats')">📊</button>
        <button class="icon" title="Self-test" @click="toggleSheet('selftest')">✓</button>
        <button class="icon" title="Help" @click="toggleSheet('help')">?</button>
      </nav>
    </header>

    <CountOverlay v-if="settings.state.mode === 'practice'" :game="game" />
    <LiveCompanion v-else :live="live" :settings="settings" />

    <template v-if="settings.state.mode === 'practice'">
      <TableFelt :game="game" :settings="settings" />

      <div v-if="notice" class="notice" :class="notice.kind">{{ notice.text }}</div>

      <ActionBar :game="game" :settings="settings" />
    </template>

    <SettingsSheet v-if="sheet === 'settings'" :settings="settings" :on-close="closeSheet" />
    <StatsSheet v-else-if="sheet === 'stats'" :stats="stats" :on-close="closeSheet" />
    <HelpSheet v-else-if="sheet === 'help'" :on-close="closeSheet" />
    <SelfTestSheet v-else-if="sheet === 'selftest'" :on-close="closeSheet" />
  </div>
</template>
