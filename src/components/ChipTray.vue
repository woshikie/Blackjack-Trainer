<script setup lang="ts">
defineProps<{
  denominations: number[]
  pending: number
  bankroll: number
}>()

const emit = defineEmits<{ add: [value: number]; clear: [] }>()
</script>

<template>
  <div class="chip-tray">
    <button
      v-for="value in denominations"
      :key="value"
      class="chip"
      :disabled="pending + value > bankroll"
      @click="emit('add', value)"
    >
      ${{ value }}
    </button>
    <button class="chip clear" :disabled="pending === 0" @click="emit('clear')">Clear</button>
  </div>
</template>
