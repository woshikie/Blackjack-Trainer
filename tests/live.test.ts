import { describe, expect, it } from 'vitest'
import { createLiveStore } from '../src/stores/live'
import { createSettingsStore } from '../src/stores/settings'

function makeLive() {
  const settings = createSettingsStore(null)
  const live = createLiveStore(settings)
  return { settings, live }
}

describe('live store — card entry', () => {
  it('walks P→B→P slots and advises surrender on hard 16 vs a ten', () => {
    const { live } = makeLive()
    expect(live.turnStyle.value).toBe('p-b-p')
    expect(live.nextNeeded.value).toBe('mine')
    live.pick('T')
    expect(live.nextNeeded.value).toBe('up')
    live.pick('T')
    expect(live.nextNeeded.value).toBe('mine')
    live.pick('6')
    expect(live.nextNeeded.value).toBe('none')
    expect(live.player.value).toEqual(['T', '6'])
    expect(live.dealer.value).toBe('T')
    expect(live.advice.value?.action).toBe('surrender')
  })

  it('walks P→P→B slots to the same play', () => {
    const { settings, live } = makeLive()
    settings.updateLive({ turnStyle: 'p-p-b' })
    expect(live.turnStyle.value).toBe('p-p-b')
    expect(live.nextNeeded.value).toBe('mine')
    live.pick('T')
    expect(live.nextNeeded.value).toBe('mine')
    live.pick('6')
    expect(live.nextNeeded.value).toBe('up')
    live.pick('T')
    expect(live.nextNeeded.value).toBe('none')
    expect(live.player.value).toEqual(['T', '6'])
    expect(live.dealer.value).toBe('T')
    expect(live.advice.value?.action).toBe('surrender')
  })

  it('advises nothing until the hand and upcard are complete', () => {
    const { live } = makeLive()
    live.pick('T')
    expect(live.advice.value).toBeNull()
    live.pick('7')
    expect(live.advice.value).toBeNull()
    live.pick('6')
    expect(live.advice.value?.action).toBe('hit')
  })

  it('treats taps after the deal as follow-up player cards and re-derives the advice', () => {
    const { live } = makeLive()
    live.pick('T')
    live.pick('T')
    live.pick('6')
    expect(live.advice.value?.action).toBe('surrender')
    live.pick('5')
    expect(live.player.value).toEqual(['T', '6', '5'])
    expect(live.dealer.value).toBe('T')
    expect(live.advice.value?.action).toBe('stand')
  })
})

describe('live store — insurance', () => {
  it('shows an insurance row only against an ace', () => {
    const { live } = makeLive()
    live.pick('4')
    live.pick('9')
    expect(live.insurance.value).toBeNull()
    live.undo()
    live.undo()
    live.pick('4')
    live.pick('A')
    expect(live.insurance.value?.take).toBe(false)
  })

  it('takes insurance when counting says the true count is high', () => {
    const { settings, live } = makeLive()
    // Thirteen logged rounds of low cards on a single deck.
    settings.updateRules({ decks: 1 })
    for (let round = 0; round < 13; round++) {
      live.pick('6')
      live.pick('6')
      live.newRound()
    }
    settings.updatePractice({ counting: true })
    live.pick('4')
    live.pick('A')
    // 26 sixes logged: +26 running, 24 cards left → TC far past +3.
    expect(live.seen.value).toHaveLength(28)
    expect(live.insurance.value?.take).toBe(true)
    expect(live.insurance.value?.label).toBe('Take insurance')
  })
})

describe('live store — corrections and resets', () => {
  it('undo pops the newest entry from its slot and the count log together', () => {
    const { live } = makeLive()
    live.undo()
    expect(live.entries.value).toHaveLength(0)
    live.pick('T')
    live.pick('6')
    live.pick('9')
    live.undo()
    expect(live.player.value).toEqual(['T'])
    expect(live.dealer.value).toBe('6')
    expect(live.seen.value).toEqual(['T', '6'])
    expect(live.nextNeeded.value).toBe('mine')
    live.undo()
    expect(live.dealer.value).toBeNull()
    expect(live.seen.value).toEqual(['T'])
    expect(live.nextNeeded.value).toBe('up')
    live.undo()
    expect(live.entries.value).toHaveLength(0)
    expect(live.seen.value).toEqual([])
    expect(live.nextNeeded.value).toBe('mine')
  })

  it('new round keeps the count log; new shoe clears everything', () => {
    const { live } = makeLive()
    live.pick('T')
    live.pick('T')
    live.pick('6')
    live.newRound()
    expect(live.entries.value).toHaveLength(0)
    expect(live.seen.value).toEqual(['T', 'T', '6'])
    expect(live.advice.value).toBeNull()
    // A fresh hand still counts: the log only clears on a shoe reset.
    live.pick('5')
    live.pick('9')
    expect(live.seen.value).toEqual(['T', 'T', '6', '5', '9'])
    live.newShoe()
    expect(live.entries.value).toHaveLength(0)
    expect(live.seen.value).toEqual([])
    expect(live.nextNeeded.value).toBe('mine')
  })
})
