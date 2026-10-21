# Blackjack Trainer

A GitHub Pages web app for practicing blackjack strategy play: grading decisions against basic strategy under configurable table rules, with an optional card-counting overlay.

## Language

### Modes

**App Mode**:
The top-level selection between Practice (graded tables) and Live (the Live Companion). Persists across reloads.

**Live Companion**:
A table-side helper for real games: entered table cards drive an instant basic-strategy and insurance suggestion, with an optional running-count overlay. No grading, no bankroll, no stats.
_Avoid_: live game, casino mode, second practice session

**Card Entry**:
Tapping the ranks that have appeared on the table. Rank-only: tens, jacks, queens, and kings are all entered as T; suits are never asked.

**Turn Style**:
The card-entry order, matching the table's deal rhythm: Player→Banker→Player (round-robin, as dealt) or Player→Player→Banker (player cards first). Entry order only; it never changes the strategy.

**Active Hand**:
The split hand currently awaiting a decision in the Live Companion. Hands play left to right; earlier hands are finished, later hands hold only their split card.

**Split Now**:
The action button shown when the chart says split for the active hand. It spawns a sub-hand from the pair, capped by the table's max hands; undo never un-splits (New round recovers).

**Round Over (live)**:
The state after every hand has acted — the bank plays out, the count log persists, and New round starts the next deal.

### Practice

**Practice Session**:
A stretch of continuous play from one shoe start to the next shoe start (or manual reset), the unit over which stats and mistakes are tallied.
_Avoid_: game, round

**Heads-Up Table**:
A one-player table: you versus the dealer only. No dummy seats exist.
_Avoid_: multiplayer, solo mode

**Basic Strategy**:
The mathematically correct Hit/Stand/Double/Split/Surrender decision for a given player hand against a given dealer upcard under the configured rules.

**Correct Play**:
The action the strategy engine grades as Basic Strategy for the current situation.

**Decision Spot**:
A remembered practice location: the (player hand type, dealer upcard, action-space) combination an error can be attributed to, used for accuracy stats.

**Mistake**:
A graded action that differs from the Correct Play.

### Feedback modes

**Feedback Mode**:
The user-selected rule for what happens on a Mistake. One of: Strict, Guide, Lenient, Silent.

**Strict**:
A Mistake is flagged instantly with the Correct Play shown and must be redone before the hand continues.

**Guide**:
A Feedback Mode that highlights the strategy-correct choice (accent ring) live while deciding, on action buttons and insurance prompts. Mistakes are still counted silently — no popup, no blocking.
_Avoid_: hint box, coach text

**Lenient**:
A Mistake is flagged instantly but the player's (wrong) action executes and the hand plays out.

**Silent**:
Mistakes are counted without interrupting play; surfaced in a session report.

**Session Report**:
The end-of-session summary of Mistakes and accuracy shown when Feedback Mode is Silent.

### Money

**Bankroll**:
The practice money balance for a session. Resets at session start by default.

**Chip Tray**:
The bet composer: tap configurable chip denominations to build the next wager.

**Default Bet**:
The per-session starting wager configured in settings; seeds the Last Bet for the first hand only.

**Last Bet**:
The wager most recently placed. Drives the hand loop: the Rebet button places it, auto-deal repeats it, and "Next hand" deals with it. Falls back to the betting screen (bet pre-filled) when unaffordable.
_Avoid_: default bet (for repeats), current bet

**Rebet**:
One-tap placement of the Last Bet.

**Stop**:
The control at a settled hand that cancels the pending auto-deal and returns to the betting screen; never aborts a hand in progress.

**Next Hand**:
The control at a settled hand that deals the following round immediately at the Last Bet.

**Skip Insurance**:
A practice toggle that auto-declines insurance and even money offers without grading them; the prompt is never shown.

**Skip Surrender**:
A practice toggle that removes Surrender from the offered actions and from grading; the strategy is quoted as the no-surrender fallback play.

### Table rules (configurable knobs)

**Shoe**:
The device holding the dealt cards across hands before reshuffle.

**Cut Card**:
The marker inserted into the shoe that triggers a reshuffle when reached.

**Penetration**:
How deeply into the shoe play proceeds before reshuffle, as a percentage.

**CSM (Continuous Shuffling Machine)**:
A device that returns cards to the shoe continuously, making each deal a fresh-deck draw. Renders counting useless.

**Peek**:
The dealer checks first (for Blackjack) when showing an Ace or ten before the player acts, and only original bets lose.

**ENHC (European No Hole Card)**:
The dealer checks last: players act against an unknown hole card, and if the dealer has Blackjack, all bets including Doubling and Splitting lose.

**H17 / S17**:
Dealer Hits / Stands on Soft 17.

**DAS (Double After Split)**:
Doubling is allowed on split hands.

**Late Surrender**:
Surrendering the hand and forfeiting half the bet, available only after the dealer has confirmed no Blackjack (Peek games).

**Resplit**:
Splitting again after a split, up to the configured hand limit.

### Counting

**Counting**:
Tracking the ratio of high to low cards remaining in the shoe to inform bet sizing and play deviations.

**Running Count**:
The Hi-Lo sum of tagged values of all cards exposed so far (−1, 0, +1).

**True Count**:
The Running Count divided by the estimated decks remaining in the shoe.

**Count Overlay**:
The optional UI layer exposing the count during play, hidden by default.

**Reveal**:
The tap that shows the hidden count for self-checking the mental Running/True Count.

**Always Show**:
The Count Overlay setting that displays the count permanently instead of requiring a Reveal.

**Even Money**:
The Insurance offer made when the player has Blackjack and the dealer shows an Ace; graded by the same insurance rule.

**Top-Up**:
The free bankroll refill offered when the Bankroll drops below the table minimum.
