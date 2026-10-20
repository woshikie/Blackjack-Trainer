<script setup lang="ts">
import { ref } from 'vue'
import { runSelfTest } from '../domain/strategy/selftest'
import type { Check } from '../domain/strategy/selftest'

defineProps<{ onClose: () => void }>()

const checks = ref<Check[] | null>(null)

function run(): void {
  checks.value = runSelfTest()
}
</script>

<template>
  <section class="sheet">
    <header class="sheet-header">
      <h2>Strategy self-test</h2>
      <button class="link" @click="onClose">Close</button>
    </header>
    <p>Verifies chart structure and a suite of reference plays for every deck family and dealer rule.</p>
    <button class="primary" @click="run">Run self-test</button>
    <ul v-if="checks" class="selftest-list">
      <li v-for="check in checks" :key="check.name" :class="check.ok ? 'pass' : 'fail'">
        {{ check.ok ? '✓' : '✗' }} {{ check.name }}
      </li>
    </ul>
  </section>
</template>
