<script setup lang="ts">
import { computed } from 'vue'
import type { Card, Rank } from '../domain/cards'
import { deckFamily } from '../domain/strategy/charts'
import { correctPlay } from '../domain/strategy/correctPlay'
import type { Action } from '../domain/strategy/correctPlay'
import type { SettingsStore } from '../stores/settings'

const props = defineProps<{ settings: SettingsStore; onClose: () => void }>()

const HARD_TOTALS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const HARD_UPS: Rank[] = ['9', 'T', 'A']
const PAIR_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T']
const PAIR_UPS: Rank[] = ['T', 'A']

function cardOf(rank: Rank): Card {
  return { rank, suit: 'S' }
}

/** Canonical two-card hand per hard total; 14 uses 8+6 (no composition exception). */
function hardHand(total: number): Card[] {
  if (total === 14) return [cardOf('8'), cardOf('6')]
  if (total <= 11) return [cardOf('2'), cardOf(String(total - 2) as Rank)]
  return [cardOf('T'), cardOf(String(total - 10) as Rank)]
}

function play(cards: Card[], up: Rank): Action {
  return correctPlay(
    {
      cards,
      dealerUp: cardOf(up),
      postSplit: false,
      splitAces: false,
      numHands: 1,
      fundsForDouble: true,
    },
    props.settings.state.rules,
  )
}

const LETTER: Record<Action, string> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'X' }

const modeLabel = computed(() =>
  props.settings.state.rules.earlySurrender
    ? 'Early'
    : props.settings.state.rules.lateSurrender
      ? 'Late'
      : 'Off',
)

const tableLabel = computed(() => {
  const family = deckFamily(props.settings.state.rules.decks)
  const decks = family === '1' ? 'single deck' : family === '2' ? 'double deck' : '4+ decks'
  return `${decks} · ${props.settings.state.rules.hitSoft17 ? 'H17' : 'S17'}`
})

const hardCells = computed<Action[][]>(() =>
  HARD_TOTALS.map((total) => HARD_UPS.map((up) => play(hardHand(total), up))),
)

const pairCells = computed<Action[][]>(() =>
  PAIR_RANKS.map((rank) => PAIR_UPS.map((up) => play([cardOf(rank), cardOf(rank)], up))),
)

function upLabel(up: Rank): string {
  return up === 'T' ? '10' : up
}
</script>

<template>
  <section class="sheet">
    <header class="sheet-header">
      <h2>Help</h2>
      <button class="link" @click="onClose">Close</button>
    </header>

    <h3>Goal</h3>
    <p>Play blackjack heads-up against the dealer. Every decision is graded against
      basic strategy for the configured table rules. Mistakes are flagged according to
      your feedback mode.</p>

    <h3>Feedback modes</h3>
    <ul>
      <li><strong>Strict</strong> — a wrong play is not executed; the correct play is shown and you try again.</li>
      <li><strong>Lenient</strong> — the wrong play executes so the hand plays out; the mistake is still recorded.</li>
      <li><strong>Silent</strong> — play uninterrupted; review your mistakes in Stats afterwards.</li>
    </ul>

    <h3>Keyboard shortcuts</h3>
    <ul>
      <li><strong>H</strong> hit · <strong>S</strong> stand · <strong>D</strong> double · <strong>P</strong> split · <strong>X</strong> surrender</li>
      <li><strong>Y</strong>/<strong>N</strong> take/decline insurance · <strong>R</strong> rebet · <strong>Space</strong> deal / next hand</li>
    </ul>

    <h3>Counting (Hi-Lo)</h3>
    <p>2–6 count +1, 7–9 count 0, 10–A count −1. The running count is the sum of all
      exposed cards; the true count is the running count divided by the decks remaining.
      Insurance becomes correct at a true count of +3 or higher. With a continuous
      shuffling machine the count is meaningless, so the overlay is disabled.</p>

    <h3>Surrender chart</h3>
    <p class="muted">{{ modeLabel }} surrender · {{ tableLabel }} (your current table rules)</p>
    <template v-if="modeLabel !== 'Off'">
      <table class="strat-chart">
        <thead>
          <tr><th scope="col">Hard</th><th v-for="up in HARD_UPS" :key="up" scope="col">{{ upLabel(up) }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(total, row) in HARD_TOTALS" :key="total">
            <th scope="row">{{ total }}</th>
            <td v-for="(up, col) in HARD_UPS" :key="up" :class="{ surr: hardCells[row]![col] === 'surrender' }">
              {{ LETTER[hardCells[row]![col]!] }}
            </td>
          </tr>
        </tbody>
      </table>
      <table class="strat-chart">
        <thead>
          <tr><th scope="col">Pair</th><th v-for="up in PAIR_UPS" :key="up" scope="col">{{ upLabel(up) }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(rank, row) in PAIR_RANKS" :key="rank">
            <th scope="row">{{ rank === 'T' ? '10,10' : `${rank},${rank}` }}</th>
            <td v-for="(up, col) in PAIR_UPS" :key="up" :class="{ surr: pairCells[row]![col] === 'surrender' }">
              {{ LETTER[pairCells[row]![col]!] }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted">X = surrender, computed live from the same engine that grades you.
        Hard 14 vs 10 uses 8+6 here; single-deck T+4 and 9+5, and double-deck T+4,
        play out instead. Single-deck 8,8 vs 10 splits when DAS is allowed.</p>
    </template>
    <p v-else class="muted">Surrender is off — pick Late or Early under Settings → Table rules (needs Peek on).</p>

    <h3>Rules glossary</h3>
    <ul>
      <li><strong>Peek</strong> — dealer checks for blackjack first; you only lose your original bet.</li>
      <li><strong>ENHC</strong> — dealer checks last; doubles and splits lose everything to a dealer blackjack.</li>
      <li><strong>OBBO</strong> — no-peek tables where a dealer natural takes one unit per live hand (doubles refunded); busted hands lose everything.</li>
      <li><strong>Late surrender</strong> — forfeit half after the peek clears (e.g. 16 vs 10).</li>
      <li><strong>Early surrender</strong> — forfeit half before the peek, even vs ace/ten (e.g. 14 vs 10, 6 vs ace).</li>
      <li><strong>DAS</strong> — double after split allowed. <strong>H17</strong> — dealer hits soft 17.</li>
      <li><strong>Penetration</strong> — how deeply the shoe is dealt before reshuffling.</li>
    </ul>
  </section>
</template>
