import { ref, watch } from 'vue'
import {
  accuracy as accuracyOf,
  emptyStats,
  recordDecision as trackDecision,
  recordHand as trackHand,
  worstSpots as worstSpotsOf,
} from '../domain/stats'
import type { Stats } from '../domain/stats'

const STORAGE_KEY = 'bj-trainer-stats-v1'

export function loadStats(storage: Storage | null = globalThis.localStorage): Stats {
  if (!storage) return emptyStats()
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyStats()
    const base = emptyStats()
    const source = parsed as Partial<Stats>
    return {
      hands: typeof source.hands === 'number' ? source.hands : base.hands,
      decisions: typeof source.decisions === 'number' ? source.decisions : base.decisions,
      mistakes: typeof source.mistakes === 'number' ? source.mistakes : base.mistakes,
      streak: typeof source.streak === 'number' ? source.streak : base.streak,
      bestStreak: typeof source.bestStreak === 'number' ? source.bestStreak : base.bestStreak,
      spots: typeof source.spots === 'object' && source.spots !== null ? source.spots : base.spots,
    }
  } catch {
    return emptyStats()
  }
}

export function saveStats(stats: Stats, storage: Storage | null = globalThis.localStorage): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(stats))
}

export function createStatsStore(storage: Storage | null = globalThis.localStorage) {
  const stats = ref<Stats>(loadStats(storage))

  if (storage) {
    watch(
      stats,
      () => {
        saveStats(stats.value, storage)
      },
      { deep: true, flush: 'sync' },
    )
  }

  function recordDecision(key: string, correct: boolean): void {
    trackDecision(stats.value, key, correct)
  }

  function recordHand(): void {
    trackHand(stats.value)
  }

  function reset(): void {
    stats.value = emptyStats()
  }

  return {
    stats,
    recordDecision,
    recordHand,
    reset,
    accuracy: () => accuracyOf(stats.value),
    worstSpots: (limit?: number) => worstSpotsOf(stats.value, limit),
  }
}

export type StatsStore = ReturnType<typeof createStatsStore>
