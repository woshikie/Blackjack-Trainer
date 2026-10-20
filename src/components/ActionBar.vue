<script setup lang="ts">
import type { Action } from '../domain/strategy/correctPlay'
import { ACTION_LABELS, AUTO_DEAL_DELAY } from '../stores/game'
import type { AutoDeal } from '../stores/settings'
import type { GameStore } from '../stores/game'
import type { SettingsStore } from '../stores/settings'
import ChipTray from './ChipTray.vue'

const props = defineProps<{ game: GameStore; settings: SettingsStore }>()
const game = props.game
const snapshot = game.snapshot
const pendingBet = game.pendingBet
const availableActions = game.availableActions
const needsTopUp = game.needsTopUp

const SHORTCUTS: Partial<Record<Action, string>> = {
  hit: 'H',
  stand: 'S',
  double: 'D',
  split: 'P',
  surrender: 'X',
}

const AUTO_LABEL: Record<Exclude<AutoDeal, 'off'>, string> = {
  slow: 'slow',
  normal: 'normal',
  fast: 'fast',
}
</script>

<template>
  <div class="action-bar">
    <template v-if="snapshot.phase === 'betting'">
      <div v-if="needsTopUp" class="prompt">
        Bankroll below table minimum.
        <button class="primary" @click="game.topUp()">Top-Up</button>
      </div>
      <template v-else>
        <div class="bet-row">
          <span class="bet-amount">Bet: ${{ pendingBet }}</span>
          <button class="secondary" @click="game.rebet()">Rebet ${{ settings.state.practice.defaultBet }}</button>
        </div>
        <ChipTray
          :denominations="settings.state.practice.chipDenominations"
          :pending="pendingBet"
          :bankroll="snapshot.bankroll"
          @add="game.addChip"
          @clear="game.clearBet"
        />
        <button class="primary deal" :disabled="!game.betLegal(pendingBet)" @click="game.startRound(pendingBet)">
          Deal (Space)
        </button>
      </template>
    </template>

    <template v-else-if="snapshot.phase === 'insurance'">
      <div class="prompt">
        {{ snapshot.evenMoney ? 'Even money?' : 'Insurance?' }}
        <button class="primary" @click="game.resolveInsurance(true)">Take (Y)</button>
        <button class="secondary" @click="game.resolveInsurance(false)">Decline (N)</button>
      </div>
    </template>

    <template v-else-if="snapshot.phase === 'player'">
      <div class="actions">
        <button
          v-for="action in availableActions"
          :key="action"
          class="primary"
          @click="game.playerDecide(action)"
        >
          {{ ACTION_LABELS[action] }}<small v-if="SHORTCUTS[action]"> {{ SHORTCUTS[action] }}</small>
        </button>
      </div>
    </template>

    <template v-else-if="snapshot.phase === 'dealer'">
      <div class="prompt">Dealer plays…</div>
    </template>

    <template v-else>
      <div class="prompt settled-row">
        <span>
          Hand complete
          <template v-if="settings.state.practice.autoDeal !== 'off'">
            · next in {{ AUTO_DEAL_DELAY[settings.state.practice.autoDeal] / 1000 }}s ({{ AUTO_LABEL[settings.state.practice.autoDeal] }})
          </template>
        </span>
        <button class="primary" @click="game.nextHand()">Next hand (Space)</button>
      </div>
    </template>
  </div>
</template>
