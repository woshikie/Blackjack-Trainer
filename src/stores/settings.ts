import { reactive, watch } from 'vue'
import { DEFAULT_RULES, normalizeRules } from '../domain/rules'
import type { Rules } from '../domain/rules'

export type FeedbackMode = 'strict' | 'guide' | 'lenient' | 'silent'
export type AutoDeal = 'off' | 'slow' | 'normal' | 'fast'
export type AppMode = 'practice' | 'live'
export type TurnStyle = 'p-b-p' | 'p-p-b'

export interface PracticeSettings {
  feedbackMode: FeedbackMode
  counting: boolean
  alwaysShowCount: boolean
  autoDeal: AutoDeal
  chipDenominations: number[]
  defaultBet: number
  skipInsurance: boolean
  skipSurrender: boolean
}

export interface LiveSettings {
  turnStyle: TurnStyle
}

export interface SettingsState {
  mode: AppMode
  rules: Rules
  practice: PracticeSettings
  live: LiveSettings
}

const STORAGE_KEY = 'bj-trainer-settings-v1'

export const DEFAULT_PRACTICE: PracticeSettings = {
  feedbackMode: 'strict',
  counting: false,
  alwaysShowCount: false,
  autoDeal: 'normal',
  chipDenominations: [5, 25, 100, 500],
  defaultBet: 25,
  skipInsurance: false,
  skipSurrender: false,
}

export const DEFAULT_LIVE: LiveSettings = { turnStyle: 'p-b-p' }

function sanitize(raw: unknown): SettingsState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<SettingsState>
  if (typeof source.rules !== 'object' || source.rules === null) return null
  if (typeof source.practice !== 'object' || source.practice === null) return null
  return {
    mode: source.mode === 'live' ? 'live' : 'practice',
    rules: normalizeRules({ ...DEFAULT_RULES, ...source.rules }),
    live: {
      turnStyle: source.live?.turnStyle === 'p-p-b' ? 'p-p-b' : 'p-b-p',
    },
    practice: {
      ...DEFAULT_PRACTICE,
      ...source.practice,
      chipDenominations: [...(source.practice.chipDenominations ?? DEFAULT_PRACTICE.chipDenominations)],
    },
  }
}

function defaults(): SettingsState {
  return {
    mode: 'practice',
    rules: normalizeRules({ ...DEFAULT_RULES }),
    practice: { ...DEFAULT_PRACTICE, chipDenominations: [...DEFAULT_PRACTICE.chipDenominations] },
    live: { ...DEFAULT_LIVE },
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

  function updateLive(partial: Partial<LiveSettings>): void {
    Object.assign(state.live, partial)
  }

  function reset(): void {
    state.mode = 'practice'
    state.rules = { ...DEFAULT_RULES }
    Object.assign(state.practice, DEFAULT_PRACTICE)
    Object.assign(state.live, DEFAULT_LIVE)
  }

  /** Top-level Practice / Live switch; persists across reloads. */
  function setMode(mode: AppMode): void {
    state.mode = mode
  }

  return { state, updateRules, updatePractice, updateLive, setMode, reset }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>
