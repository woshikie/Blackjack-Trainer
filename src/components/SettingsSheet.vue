<script setup lang="ts">
import type { DeckCount, DoubleRule } from '../domain/rules'
import type { AutoDeal, FeedbackMode, SettingsStore } from '../stores/settings'
import { ref } from 'vue'

const props = defineProps<{ settings: SettingsStore; onClose: () => void }>()
const settings = props.settings
const state = settings.state

const FEEDBACK_MODES: FeedbackMode[] = ['strict', 'guide', 'lenient', 'silent']
const AUTO_MODES: AutoDeal[] = ['off', 'slow', 'normal', 'fast']
const DECK_OPTIONS: DeckCount[] = [1, 2, 4, 6, 8]
const DOUBLE_OPTIONS: DoubleRule[] = ['any', '9-11', '10-11']

const version = __APP_VERSION__
const versionNote = ref<string | null>(null)

/** Compare the running version against the freshly served version.json. */
async function checkVersion(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    const remote = (await res.json()) as { version: string }
    versionNote.value =
      remote.version === version
        ? `up to date (v${version})`
        : `newer version available (v${remote.version}) — force update`
  } catch {
    versionNote.value = 'version check failed'
  }
}

/** Sweeper: unregister the service worker, drop caches, reload fresh. */
async function forceUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  window.location.reload()
}

function onDenominationsChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const parsed = target.value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
  settings.updatePractice({ chipDenominations: parsed.length > 0 ? parsed : [5] })
}
</script>

<template>
  <section class="sheet">
    <header class="sheet-header">
      <h2>Settings</h2>
      <button class="link" @click="onClose">Close</button>
    </header>

    <h3>Table rules</h3>
    <div class="form-grid">
      <label>Decks
        <select v-model.number="state.rules.decks">
          <option v-for="option in DECK_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
      <label>Blackjack pays
        <select :value="String(state.rules.blackjackPays)" @change="settings.updateRules({ blackjackPays: Number(($event.target as HTMLSelectElement).value) as 1.5 | 1.2 })">
          <option value="1.5">3:2</option>
          <option value="1.2">6:5</option>
        </select>
      </label>
      <label>Double on
        <select v-model="state.rules.doubleOn">
          <option v-for="option in DOUBLE_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
      <label>Split up to
        <select v-model.number="state.rules.maxHands">
          <option :value="2">2 hands</option>
          <option :value="3">3 hands</option>
          <option :value="4">4 hands</option>
        </select>
      </label>
      <label>Table minimum
        <input type="number" :min="1" :value="state.rules.minBet" @change="settings.updateRules({ minBet: Math.max(1, Number(($event.target as HTMLInputElement).value) || 1) })" />
      </label>
      <label>Table maximum (0 = none)
        <input type="number" :min="0" :value="state.rules.maxBet" @change="settings.updateRules({ maxBet: Math.max(0, Number(($event.target as HTMLInputElement).value) || 0) })" />
      </label>
    </div>

    <div class="check-grid">
      <label><input v-model="state.rules.hitSoft17" type="checkbox" /> Dealer hits soft 17 (H17)</label>
      <label><input v-model="state.rules.doubleAfterSplit" type="checkbox" /> Double after split (DAS)</label>
      <label><input v-model="state.rules.splitAcesOneCard" type="checkbox" /> Split aces receive one card</label>
      <label><input v-model="state.rules.resplitAces" type="checkbox" /> Resplit aces</label>
      <label><input v-model="state.rules.insurance" type="checkbox" /> Insurance offered</label>
      <label>
        <input v-model="state.rules.peek" type="checkbox" /> Dealer checks for blackjack first (peek)
        <small>Unchecked = European no hole card; surrender is not offered</small>
      </label>
      <label :class="{ disabled: !state.rules.peek }">
        <input v-model="state.rules.lateSurrender" type="checkbox" :disabled="!state.rules.peek" /> Late surrender
      </label>
      <label>
        <input v-model="state.rules.csm" type="checkbox" /> Continuous shuffling machine (CSM)
        <small>Disables counting; cards return to the shoe every round</small>
      </label>
      <label :class="{ disabled: state.rules.csm }">
        Penetration {{ state.rules.penetration }}%
        <input type="range" min="10" max="95" :value="state.rules.penetration" :disabled="state.rules.csm" @change="settings.updateRules({ penetration: Number(($event.target as HTMLInputElement).value) })" />
      </label>
    </div>

    <template v-if="state.mode === 'practice'">
      <h3>Practice</h3>
      <div class="form-grid">
        <label>Feedback on mistakes
          <select v-model="state.practice.feedbackMode">
            <option v-for="mode in FEEDBACK_MODES" :key="mode" :value="mode">{{ mode }}</option>
          </select>
        </label>
        <label>Auto-deal next hand
          <select v-model="state.practice.autoDeal">
            <option v-for="mode in AUTO_MODES" :key="mode" :value="mode">{{ mode }}</option>
          </select>
        </label>
        <label>Default bet (first hand)
          <input type="number" :min="1" :value="state.practice.defaultBet" @change="settings.updatePractice({ defaultBet: Math.max(1, Number(($event.target as HTMLInputElement).value) || 1) })" />
        </label>
        <label>Chip denominations (comma separated)
          <input type="text" :value="state.practice.chipDenominations.join(', ')" @change="onDenominationsChange" />
        </label>
      </div>
      <div class="check-grid">
        <label :class="{ disabled: state.rules.csm }">
          <input v-model="state.practice.counting" type="checkbox" :disabled="state.rules.csm" /> Hi-Lo counting overlay
        </label>
        <label :class="{ disabled: !state.practice.counting || state.rules.csm }">
          <input v-model="state.practice.alwaysShowCount" type="checkbox" :disabled="!state.practice.counting || state.rules.csm" /> Always show count
        </label>
        <label>
          <input v-model="state.practice.skipInsurance" type="checkbox" /> Skip insurance offers
          <small>Auto-declines insurance and even money without grading</small>
        </label>
        <label>
          <input v-model="state.practice.skipSurrender" type="checkbox" /> Skip surrender
          <small>Surrender is not offered or graded; play the fallback move</small>
        </label>
      </div>
    </template>
    <template v-else>
      <h3>Live</h3>
      <div class="check-grid">
        <label :class="{ disabled: state.rules.csm }">
          <input v-model="state.practice.counting" type="checkbox" :disabled="state.rules.csm" /> Hi-Lo counting
          <small>Drives the live count row and insurance / even-money advice</small>
        </label>
      </div>
    </template>

    <footer class="sheet-footer">
      <div class="version-row">
        <span class="version-label">v{{ version }}<template v-if="versionNote"> · {{ versionNote }}</template></span>
        <button class="link" @click="checkVersion">Check version</button>
        <button class="link" @click="forceUpdate">Force update</button>
      </div>
      <button class="secondary" @click="settings.reset()">Reset settings</button>
    </footer>
  </section>
</template>
