import type { Card } from '../cards'
import { Counter } from '../counting'
import type { CountSystem } from '../counting'
import { handValue, isNatural, isPair } from '../hand'
import type { Rng } from '../rng'
import { normalizeRules } from '../rules'
import type { Rules } from '../rules'
import { Shoe } from '../shoe'
import type { Action } from '../strategy/correctPlay'

export type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'settled'

export type HandResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender'

export const START_BANKROLL = 1000

export interface PlayerHand {
  id: number
  cards: Card[]
  bet: number
  doubled: boolean
  fromSplit: boolean
  splitAces: boolean
  stood: boolean
  surrendered: boolean
  result: HandResult | null
}

export interface GameSnapshot {
  phase: Phase
  bankroll: number
  bet: number
  hands: readonly PlayerHand[]
  activeIndex: number
  dealerCards: readonly Card[]
  dealerHoleExposed: boolean
  insuranceTaken: boolean
  insuranceBet: number
  evenMoney: boolean
  message: string
  remaining: number
  roundNumber: number
  shuffled: boolean
  count: { running: number; trueCount: number } | null
}

export class Game {
  private shoe: Shoe
  private counter: Counter | null
  private rules: Rules
  phase: Phase = 'betting'
  bankroll = START_BANKROLL
  bet = 0
  hands: PlayerHand[] = []
  activeIndex = 0
  dealerCards: Card[] = []
  dealerHoleExposed = false
  insuranceBet = 0
  insuranceTaken = false
  message = ''
  roundNumber = 0
  private nextHandId = 1
  private shuffledFlag = false

  constructor(rules: Rules, rng: Rng, countSystem?: CountSystem, preset?: readonly Card[]) {
    this.rules = normalizeRules(rules)
    this.shoe = new Shoe(this.rules, rng, preset)
    this.counter = countSystem && !this.rules.csm ? new Counter(countSystem) : null
  }

  private assertPhase(phase: Phase): void {
    if (this.phase !== phase) throw new Error(`expected phase ${phase}, got ${this.phase}`)
  }

  private draw(): Card {
    return this.shoe.draw()
  }

  private expose(card: Card): void {
    this.counter?.observe(card)
  }

  /** Current rules (for store-level change detection between rounds). */
  get currentRules(): Rules {
    return this.rules
  }

  /** Active counting system id, or null when counting is off/CSM. */
  get countingId(): string | null {
    return this.counter?.system.id ?? null
  }

  setRules(rules: Rules, rng: Rng, countSystem?: CountSystem): void {
    this.assertPhase('betting')
    this.rules = normalizeRules(rules)
    this.shoe = new Shoe(this.rules, rng)
    this.counter = countSystem && !this.rules.csm ? new Counter(countSystem) : null
    this.shuffledFlag = true
    this.message = 'Shuffling…'
  }

  placeBet(amount: number): void {
    this.assertPhase('betting')
    if (amount < this.rules.minBet) throw new Error('bet below table minimum')
    if (this.rules.maxBet > 0 && amount > this.rules.maxBet) throw new Error('bet above table maximum')
    if (amount > this.bankroll) throw new Error('insufficient bankroll')
    this.bet = amount
  }

  topUp(): void {
    this.assertPhase('betting')
    this.bankroll = START_BANKROLL
  }

  private newHand(cards: Card[], bet: number): PlayerHand {
    return {
      id: this.nextHandId++,
      cards,
      bet,
      doubled: false,
      fromSplit: false,
      splitAces: false,
      stood: false,
      surrendered: false,
      result: null,
    }
  }

  deal(): void {
    this.assertPhase('betting')
    if (this.bet <= 0) throw new Error('no bet placed')
    this.bankroll -= this.bet
    this.roundNumber++
    this.shuffledFlag = false
    this.message = ''
    const first = this.draw()
    const up = this.draw()
    const second = this.draw()
    this.expose(first)
    this.expose(up)
    this.expose(second)
    this.hands = [this.newHand([first, second], this.bet)]
    this.activeIndex = 0
    this.dealerCards = [up]
    this.dealerHoleExposed = false
    this.insuranceBet = 0
    this.insuranceTaken = false
    if (this.rules.peek) {
      this.dealerCards.push(this.draw())
    }
    this.phase = 'player'
    if (up.rank === 'A' && this.rules.insurance && this.bankroll >= this.bet / 2) {
      this.phase = 'insurance'
      return
    }
    this.afterInsurance()
  }

  resolveInsurance(take: boolean): void {
    this.assertPhase('insurance')
    if (take) {
      this.insuranceBet = this.bet / 2
      this.bankroll -= this.insuranceBet
      this.insuranceTaken = true
    }
    this.afterInsurance()
  }

  private isDealerNatural(): boolean {
    return this.dealerCards.length === 2 && isNatural(this.dealerCards)
  }

  private revealHole(): void {
    if (!this.dealerHoleExposed) {
      this.dealerHoleExposed = true
      const hole = this.dealerCards[1]
      if (hole) this.expose(hole)
    }
  }

  private payNatural(hand: PlayerHand): void {
    hand.result = 'blackjack'
    this.bankroll += hand.bet * (1 + this.rules.blackjackPays)
  }

  private afterInsurance(): void {
    // deal() always creates the player hand before reaching this point
    const playerNatural = isNatural(this.hands[0]!.cards)
    if (this.rules.peek) {
      if (this.isDealerNatural()) {
        this.revealHole()
        if (this.insuranceTaken) this.bankroll += this.insuranceBet * 3
        for (const hand of this.hands) {
          hand.result = playerNatural ? 'push' : 'lose'
        }
        this.message = 'Dealer blackjack'
        this.phase = 'settled'
        return
      }
      if (playerNatural) {
        this.payNatural(this.hands[0]!)
        this.phase = 'settled'
        return
      }
      this.phase = 'player'
      return
    }
    // ENHC: player naturals are paid immediately, before the dealer checks.
    if (playerNatural) {
      this.payNatural(this.hands[0]!)
      this.phase = 'settled'
      return
    }
    this.phase = 'player'
  }

  private handDone(hand: PlayerHand): boolean {
    return hand.stood || hand.surrendered || hand.result === 'bust'
  }

  doubleRangeOk(total: number, soft: boolean): boolean {
    if (this.rules.doubleOn === 'any') return true
    if (soft) return false
    if (this.rules.doubleOn === '9-11') return total >= 9 && total <= 11
    return total >= 10 && total <= 11
  }

  actionLegal(hand: PlayerHand, action: Action): boolean {
    // callers (decide, availableActions) only run during the player phase
    const cards = hand.cards
    switch (action) {
      case 'hit':
      case 'stand':
        return true
      case 'double':
        return (
          cards.length === 2 &&
          (!hand.fromSplit || this.rules.doubleAfterSplit) &&
          this.bankroll >= hand.bet &&
          this.doubleRangeOk(handValue(cards).total, handValue(cards).soft)
        )
      case 'split':
        return (
          cards.length === 2 &&
          isPair(cards) &&
          this.hands.length < this.rules.maxHands &&
          (!hand.splitAces || this.rules.resplitAces) &&
          this.bankroll >= hand.bet
        )
      case 'surrender':
        return this.rules.lateSurrender && this.rules.peek && cards.length === 2 && !hand.fromSplit
    }
  }

  availableActions(): Action[] {
    if (this.phase !== 'player') return []
    // an active hand always exists in the player phase
    const hand = this.hands[this.activeIndex]!
    const all: Action[] = ['hit', 'stand', 'double', 'split', 'surrender']
    return all.filter((action) => this.actionLegal(hand, action))
  }

  decide(action: Action): void {
    this.assertPhase('player')
    // an active hand always exists in the player phase
    const hand = this.hands[this.activeIndex]!
    if (!this.actionLegal(hand, action)) throw new Error(`illegal action: ${action}`)
    switch (action) {
      case 'hit': {
        const card = this.draw()
        this.expose(card)
        hand.cards.push(card)
        this.afterCard(hand)
        break
      }
      case 'stand':
        hand.stood = true
        break
      case 'double': {
        this.bankroll -= hand.bet
        hand.bet *= 2
        hand.doubled = true
        const card = this.draw()
        this.expose(card)
        hand.cards.push(card)
        this.afterCard(hand)
        // a doubled hand always ends after its one card
        hand.stood = true
        break
      }
      case 'split': {
        this.bankroll -= hand.bet
        const isAces = hand.cards[0]!.rank === 'A'
        const moved = hand.cards.pop()!
        const newHand = this.newHand([moved], hand.bet)
        newHand.fromSplit = true
        newHand.splitAces = isAces
        hand.fromSplit = true
        hand.splitAces = isAces
        this.hands.splice(this.activeIndex + 1, 0, newHand)
        const toFirst = this.draw()
        this.expose(toFirst)
        hand.cards.push(toFirst)
        const toSecond = this.draw()
        this.expose(toSecond)
        newHand.cards.push(toSecond)
        if (isAces && this.rules.splitAcesOneCard) {
          hand.stood = true
          newHand.stood = true
        } else {
          this.afterCard(hand)
          if (!this.handDone(hand)) this.checkTwentyOne(newHand)
        }
        break
      }
      case 'surrender': {
        hand.surrendered = true
        this.bankroll += hand.bet / 2
        break
      }
    }
    // Advance only when the just-acted hand is finished; after a split the
    // first hand is still live and keeps the action.
    if (this.handDone(hand)) this.advance()
  }

  private checkTwentyOne(hand: PlayerHand): void {
    if (handValue(hand.cards).total === 21) hand.stood = true
  }

  private afterCard(hand: PlayerHand): void {
    const total = handValue(hand.cards).total
    if (total > 21) {
      hand.result = 'bust'
    } else if (total === 21) {
      hand.stood = true
    }
  }

  private advance(): void {
    let index = this.activeIndex + 1
    while (index < this.hands.length && this.handDone(this.hands[index]!)) index++
    if (index < this.hands.length) {
      this.activeIndex = index
      return
    }
    this.dealerPhase()
  }

  private dealerPhase(): void {
    this.phase = 'dealer'
    if (!this.rules.peek) {
      this.dealerCards.push(this.draw())
    }
    this.revealHole()
    if (this.insuranceTaken && this.isDealerNatural()) {
      this.bankroll += this.insuranceBet * 3
    }
    if (!this.rules.peek && this.isDealerNatural()) {
      for (const hand of this.hands) {
        if (hand.result === null && !hand.surrendered) hand.result = 'lose'
      }
      this.message = 'Dealer blackjack'
      this.settle()
      return
    }
    const live = this.hands.some(
      (hand) => !hand.surrendered && hand.result !== 'bust' && hand.result !== 'blackjack',
    )
    if (live) this.playDealer()
    this.settle()
  }

  private playDealer(): void {
    for (;;) {
      const { total, soft } = handValue(this.dealerCards)
      const mustHit = total < 17 || (total === 17 && soft && this.rules.hitSoft17)
      if (!mustHit) break
      const card = this.draw()
      this.expose(card)
      this.dealerCards.push(card)
    }
  }

  private settle(): void {
    const dealerTotal = handValue(this.dealerCards).total
    const dealerBust = dealerTotal > 21
    for (const hand of this.hands) {
      if (hand.surrendered) {
        hand.result = 'surrender'
        continue
      }
      if (hand.result !== null) continue
      const total = handValue(hand.cards).total
      if (dealerBust || total > dealerTotal) {
        hand.result = 'win'
        this.bankroll += hand.bet * 2
      } else if (total === dealerTotal) {
        hand.result = 'push'
        this.bankroll += hand.bet
      } else {
        hand.result = 'lose'
      }
    }
    this.phase = 'settled'
  }

  nextRound(): void {
    this.assertPhase('settled')
    const cards: Card[] = []
    for (const hand of this.hands) cards.push(...hand.cards)
    cards.push(...this.dealerCards)
    this.shoe.discard(cards)
    this.hands = []
    this.dealerCards = []
    this.dealerHoleExposed = false
    this.bet = 0
    this.insuranceBet = 0
    this.insuranceTaken = false
    if (this.rules.csm) {
      this.shoe.recycle()
    } else if (this.shoe.needsShuffle()) {
      this.shoe.reshuffle()
      this.counter?.reset()
      this.shuffledFlag = true
      this.message = 'Shuffling…'
    }
    this.phase = 'betting'
  }

  snapshot(): GameSnapshot {
    const dealerCards = this.dealerHoleExposed
      ? [...this.dealerCards]
      : this.dealerCards.slice(0, 1)
    const count = this.counter
      ? {
          running: this.counter.running,
          trueCount: this.counter.trueCount(this.shoe.remaining()),
        }
      : null
    return {
      phase: this.phase,
      bankroll: this.bankroll,
      bet: this.bet,
      hands: this.hands.map((hand) => ({ ...hand, cards: [...hand.cards] })),
      activeIndex: this.activeIndex,
      dealerCards,
      dealerHoleExposed: this.dealerHoleExposed,
      insuranceTaken: this.insuranceTaken,
      insuranceBet: this.insuranceBet,
      evenMoney: this.phase === 'insurance' && isNatural(this.hands[0]!.cards),
      message: this.message,
      remaining: this.shoe.remaining(),
      roundNumber: this.roundNumber,
      shuffled: this.shuffledFlag,
      count,
    }
  }
}
