import { reactive, watch } from 'vue'
import { DEFAULT_RULES, normalizeRules } from '../domain/rules'
import type { Rules } from '../domain/rules'

export type FeedbackMode = 'strict' | 'lenient' | 'silent'
export type AutoDeal = 'off' | 'slow' | 'normal' | 'fast'

export interface PracticeSettings {
  feedbackMode: FeedbackMode
  counting: boolean
  alwaysShowCount: boolean
  autoDeal: AutoDeal
  chipDenominations: number[]
  defaultBet: number
}

export interface SettingsState {
  rules: Rules
  practice: PracticeSettings
}

const STORAGE_KEY = 'bj-trainer-settings-v1'

export const DEFAULT_PRACTICE: PracticeSettings = {
  feedbackMode: 'strict',
  counting: false,
  alwaysShowCount: false,
  autoDeal: 'normal',
  chipDenominations: [5, 25, 100, 500],
  defaultBet: 25,
}

function sanitize(raw: unknown): SettingsState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<SettingsState>
  if (typeof source.rules !== 'object' || source.rules === null) return null
  if (typeof source.practice !== 'object' || source.practice === null) return null
  return {
    rules: normalizeRules({ ...DEFAULT_RULES, ...source.rules }),
    practice: {
      ...DEFAULT_PRACTICE,
      ...source.practice,
      chipDenominations: [...(source.practice.chipDenominations ?? DEFAULT_PRACTICE.chipDenominations)],
    },
  }
}

function defaults(): SettingsState {
  return {
    rules: normalizeRules({ ...DEFAULT_RULES }),
    practice: { ...DEFAULT_PRACTICE, chipDenominations: [...DEFAULT_PRACTICE.chipDenominations] },
  }
}

export function loadSettings(storage: Storage | null = globalThis.localStorage): SettingsState {
  if (!storage) return defaults()
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    return sanitize(JSON.parse(raw)) ?? defaults()
  } catch {
    return defaults()
  }
}

export function saveSettings(state: SettingsState, storage: Storage | null = globalThis.localStorage): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createSettingsStore(storage: Storage | null = globalThis.localStorage) {
  const state = reactive<SettingsState>(loadSettings(storage))

  if (storage) {
    watch(
      state,
      () => {
        saveSettings(state, storage)
      },
      { deep: true, flush: 'sync' },
    )
  }

  function updateRules(partial: Partial<Rules>): void {
    state.rules = normalizeRules({ ...state.rules, ...partial })
  }

  function updatePractice(partial: Partial<PracticeSettings>): void {
    Object.assign(state.practice, partial)
  }

  function reset(): void {
    state.rules = { ...DEFAULT_RULES }
    Object.assign(state.practice, DEFAULT_PRACTICE)
  }

  return { state, updateRules, updatePractice, reset }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>
