<script setup lang="ts">
defineProps<{ onClose: () => void }>()
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

    <h3>Rules glossary</h3>
    <ul>
      <li><strong>Peek</strong> — dealer checks for blackjack first; you only lose your original bet.</li>
      <li><strong>ENHC</strong> — dealer checks last; doubles and splits lose everything to a dealer blackjack.</li>
      <li><strong>DAS</strong> — double after split allowed. <strong>H17</strong> — dealer hits soft 17.</li>
      <li><strong>Penetration</strong> — how deeply the shoe is dealt before reshuffling.</li>
    </ul>
  </section>
</template>
