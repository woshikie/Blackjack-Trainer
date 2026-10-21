<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ delayMs: number; label: string }>()
const remaining = ref(props.delayMs)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const started = performance.now()
  timer = setInterval(() => {
    remaining.value = Math.max(0, props.delayMs - (performance.now() - started))
  }, 100)
})

onUnmounted(() => {
  if (timer !== null) clearInterval(timer)
})

const seconds = computed(() => (remaining.value / 1000).toFixed(1))
</script>

<template>
  <span>· next in {{ seconds }}s ({{ label }})</span>
</template>
